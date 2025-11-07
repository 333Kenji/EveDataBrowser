import React, { useRef, useState, useEffect, useMemo, useLayoutEffect } from 'react';
import { useMarketHistoryQuery } from '../../hooks/api/useMarketHistoryQuery';
import type { MarketHistoryApiResponse } from '../../services/market-history-client';
import { useMarketHistoryStore } from './marketHistoryStore';
// @ts-ignore CSS module declaration provided in .d.ts
import styles from './MarketHistoryChart.module.scss';
import type { MarketHistoryToggles } from './marketHistoryStore';

// Unified model structures (subset of backend contract)
// Keeping fields we render; additional fields ignored.
interface UnifiedSnapshot {
  typeId: number | string;
  source?: string;
  buy?: { price?: number; fivePercent?: number; volume?: number; changePct?: number | null };
  sell?: { price?: number; fivePercent?: number; volume?: number; changePct?: number | null };
}
interface UnifiedHistoryPoint { date: string; volume: number; buyAvg?: number; sellAvg?: number; buyLow?: number; sellHigh?: number; buyHigh?: number; sellLow?: number; sma5?: number; sma20?: number; median?: number | null; donchian_top?: number | null; donchian_bottom?: number | null }
interface UnifiedMarketModel { typeId: string | number; days: UnifiedHistoryPoint[]; snapshot?: UnifiedSnapshot }

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function toFiniteNumber(value: unknown): number | undefined {
  if (isFiniteNumber(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function sanitizePrice(value: unknown): number | undefined {
  const num = toFiniteNumber(value);
  if (num == null) return undefined;
  return num > 0 ? num : undefined;
}

function toNonNegativeNumber(value: unknown): number | undefined {
  const num = toFiniteNumber(value);
  if (num == null) return undefined;
  return num >= 0 ? num : undefined;
}

interface DayBounds {
  min?: number;
  max?: number;
}

function clampToBounds(value: number | undefined | null, bounds?: DayBounds): number | undefined {
  if (!isFiniteNumber(value)) return undefined;
  if (!bounds) return value;
  let { min, max } = bounds;
  min = isFiniteNumber(min) ? min : undefined;
  max = isFiniteNumber(max) ? max : undefined;
  if (min == null && max == null) return value;
  if (min != null && max != null && min > max) {
    const tmp = min;
    min = max;
    max = tmp;
  }
  let clamped = value;
  if (min != null) clamped = Math.max(clamped, min);
  if (max != null) clamped = Math.min(clamped, max);
  return clamped;
}

function deriveDayBounds(day: UnifiedHistoryPoint): DayBounds {
  const primaryLows = [day.buyLow, day.sellLow].filter(isFiniteNumber);
  const fallbackLows = [day.buyAvg, day.sellAvg, day.median].filter(isFiniteNumber);
  const primaryHighs = [day.sellHigh, day.buyHigh].filter(isFiniteNumber);
  const fallbackHighs = [day.sellAvg, day.buyAvg, day.median].filter(isFiniteNumber);
  let min = primaryLows.length ? Math.min(...primaryLows)
    : (fallbackLows.length ? Math.min(...fallbackLows) : undefined);
  let max = primaryHighs.length ? Math.max(...primaryHighs)
    : (fallbackHighs.length ? Math.max(...fallbackHighs) : undefined);
  if (min == null && max != null) min = max;
  if (max == null && min != null) max = min;
  if (min != null && max != null && min > max) {
    const tmp = min;
    min = max;
    max = tmp;
  }
  return { min, max };
}

function resolveClosingPrice(day: UnifiedHistoryPoint): number | undefined {
  if (isFiniteNumber(day.median)) return day.median as number;
  if (isFiniteNumber(day.sellAvg)) return day.sellAvg as number;
  if (isFiniteNumber(day.buyAvg)) return day.buyAvg as number;
  if (isFiniteNumber(day.sellHigh) && isFiniteNumber(day.sellLow)) {
    return ((day.sellHigh as number) + (day.sellLow as number)) / 2;
  }
  if (isFiniteNumber(day.buyHigh) && isFiniteNumber(day.buyLow)) {
    return ((day.buyHigh as number) + (day.buyLow as number)) / 2;
  }
  return undefined;
}

function applySimpleMovingAverage(days: UnifiedHistoryPoint[], period: number, key: 'sma5' | 'sma20'): void {
  if (!Array.isArray(days) || days.length === 0) {
    return;
  }

  const window: Array<number | undefined> = [];
  let sum = 0;
  let count = 0;

  for (let index = 0; index < days.length; index += 1) {
    const price = resolveClosingPrice(days[index]);
    window.push(price);
    if (price != null) {
      sum += price;
      count += 1;
    }

    if (window.length > period) {
      const removed = window.shift();
      if (removed != null) {
        sum -= removed;
        count -= 1;
      }
    }

    if (window.length === period && count === period) {
      (days[index] as UnifiedHistoryPoint)[key] = sum / period;
    } else {
      (days[index] as UnifiedHistoryPoint)[key] = undefined;
    }
  }
}

export interface UnifiedMarketModelQuery {
  model?: UnifiedMarketModel;
  status: 'loading' | 'error' | 'empty' | 'partial' | 'ok';
  error?: Error;
  refetch: () => Promise<any>;
}

function buildUnifiedModel(rawInput: MarketHistoryApiResponse | undefined, fallbackTypeId: string | null): UnifiedMarketModel {
  const resolvedTypeId = rawInput?.typeId ?? fallbackTypeId ?? 'unknown';
  if (!rawInput) {
    return { typeId: resolvedTypeId, days: [] };
  }

  const dayMap = new Map<string, UnifiedHistoryPoint>();
  for (const entry of rawInput.days ?? []) {
    if (!entry) continue;
    const date = entry.bucketStart?.split('T')[0];
    if (!date) continue;
    const average = sanitizePrice(entry.averagePrice);
    const low = sanitizePrice(entry.lowPrice);
    const high = sanitizePrice(entry.highPrice);
    const median = sanitizePrice(entry.medianPrice);
    const volume = toNonNegativeNumber(entry.volume);
    dayMap.set(date, {
      date,
      buyAvg: average,
      sellAvg: average,
      buyLow: low,
      buyHigh: high,
      sellLow: low,
      sellHigh: high,
      volume,
      sma5: undefined,
      sma20: undefined,
      median,
      donchian_top: high,
      donchian_bottom: low,
    });
  }

  const sortedDates = Array.from(dayMap.keys()).sort((a, b) => a.localeCompare(b));
  let days = sortedDates.map((date) => dayMap.get(date)!) as UnifiedHistoryPoint[];

  if (sortedDates.length >= 2) {
    const firstDate = new Date(`${sortedDates[0]}T00:00:00Z`);
    const lastDate = new Date(`${sortedDates[sortedDates.length - 1]}T00:00:00Z`);
    if (Number.isFinite(firstDate.getTime()) && Number.isFinite(lastDate.getTime()) && firstDate <= lastDate) {
      const expanded: UnifiedHistoryPoint[] = [];
      const cursor = new Date(firstDate.getTime());
      while (cursor <= lastDate) {
        const iso = cursor.toISOString().slice(0, 10);
        const existing = dayMap.get(iso);
        expanded.push(
          existing ?? {
            date: iso,
            volume: 0,
            buyAvg: undefined,
            sellAvg: undefined,
            buyLow: undefined,
            buyHigh: undefined,
            sellLow: undefined,
            sellHigh: undefined,
            sma5: undefined,
            sma20: undefined,
            median: undefined,
            donchian_top: undefined,
            donchian_bottom: undefined,
          },
        );
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      days = expanded;
    }
  }

  applySimpleMovingAverage(days, 5, 'sma5');
  applySimpleMovingAverage(days, 20, 'sma20');

  let snapshot: UnifiedSnapshot | undefined;
  if (rawInput.snapshot) {
    const buyPrice = sanitizePrice(rawInput.snapshot.snapshotLow);
    const sellPrice = sanitizePrice(rawInput.snapshot.snapshotHigh);
    const medianPrice = sanitizePrice(rawInput.snapshot.snapshotMedian);
    const volume = toNonNegativeNumber(rawInput.snapshot.snapshotVolume);
    snapshot = {
      typeId: rawInput.snapshot.typeId ?? resolvedTypeId,
      source: rawInput.snapshot.source,
      buy: buyPrice != null || volume != null ? {
        price: buyPrice ?? medianPrice ?? undefined,
        fivePercent: undefined,
        volume,
        changePct: null,
      } : undefined,
      sell: sellPrice != null || volume != null ? {
        price: sellPrice ?? medianPrice ?? undefined,
        fivePercent: undefined,
        volume,
        changePct: null,
      } : undefined,
    };
  }

  return { typeId: resolvedTypeId, days, snapshot };
}

export function useUnifiedMarketModel(typeId: string | null): UnifiedMarketModelQuery {
  const [refreshState, setRefreshState] = useState<'idle' | 'pending' | 'done'>('idle');
  const autoRefreshAttempted = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AUTO_REFRESH_DELAY_MS = 1500;

  useEffect(() => {
    setRefreshState('idle');
    autoRefreshAttempted.current = false;
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, [typeId]);

  useEffect(() => () => {
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const historyQuery = useMarketHistoryQuery(typeId, {
    enabled: Boolean(typeId),
    refresh: refreshState === 'pending',
  });

  const { fetchStatus, refetch } = historyQuery;

  useEffect(() => {
    if (refreshState === 'pending' && fetchStatus !== 'fetching') {
      void refetch();
    }
  }, [refreshState, fetchStatus, refetch]);

  useEffect(() => {
    if (!typeId || !historyQuery.isSuccess) {
      return;
    }

    const candidate = buildUnifiedModel(historyQuery.data as MarketHistoryApiResponse | undefined, typeId);

    if (candidate.days.length === 0 && !candidate.snapshot) {
      if (!autoRefreshAttempted.current && refreshState === 'idle' && fetchStatus !== 'fetching') {
        autoRefreshAttempted.current = true;
        if (refreshTimerRef.current !== null) {
          clearTimeout(refreshTimerRef.current);
        }
        refreshTimerRef.current = setTimeout(() => {
          refreshTimerRef.current = null;
          setRefreshState('pending');
        }, AUTO_REFRESH_DELAY_MS);
      } else if (refreshState === 'pending' && fetchStatus !== 'fetching') {
        setRefreshState('done');
      }
      return;
    }

    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    autoRefreshAttempted.current = false;

    if (refreshState === 'pending' && fetchStatus !== 'fetching') {
      setRefreshState('done');
    }
  }, [
    typeId,
    historyQuery.isSuccess,
    historyQuery.data,
    fetchStatus,
    refreshState,
  ]);

  if (!typeId) {
    return {
      status: 'empty',
      model: { typeId: '', days: [] },
      refetch: historyQuery.refetch,
    } satisfies UnifiedMarketModelQuery;
  }

  if (historyQuery.isPending || historyQuery.fetchStatus === 'fetching') {
    return { status: 'loading', refetch: historyQuery.refetch };
  }

  if (historyQuery.isError) {
    return { status: 'error', error: historyQuery.error as Error, refetch: historyQuery.refetch };
  }

  const model = buildUnifiedModel(historyQuery.data as MarketHistoryApiResponse | undefined, typeId);

  if (model.days.length === 0 && model.snapshot) {
    return { status: 'partial', model, refetch: historyQuery.refetch };
  }

  if (model.days.length === 0) {
    return { status: 'empty', model, refetch: historyQuery.refetch };
  }

  return { status: 'ok', model, refetch: historyQuery.refetch };
}

interface ChartProps {
  typeId: string;
  prefetchedQuery?: UnifiedMarketModelQuery;
}

export function MarketHistoryChart({ typeId, prefetchedQuery }: ChartProps) {
  // Always call hooks in stable order BEFORE any conditional returns to prevent hook order mismatch errors.
  const internalQuery = useUnifiedMarketModel(prefetchedQuery ? null : typeId);
  const query = prefetchedQuery ?? internalQuery;
  const { model: data, status, refetch } = query;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartBodyRef = useRef<HTMLDivElement | null>(null);
  const DEFAULT_WIDTH = typeof window !== 'undefined'
    ? Math.max(320, Math.min(window.innerWidth, 1600))
    : 420;
  // Persist last known width across unmount/mount cycles (e.g., when item switches quickly) to avoid narrow flash
  const [width, setWidth] = useState<number>(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipSize, setTooltipSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const hoverFrameRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<{ index: number; cursor: { x: number; y: number } } | null>(null);
  const toggles = useMarketHistoryStore((s) => s.toggles);
  const viewport = useMarketHistoryStore((s) => s.viewport);
  const setViewport = useMarketHistoryStore((s) => s.setViewport);
  const resetViewport = useMarketHistoryStore((s) => s.resetViewport);
  // Dynamic height: fill viewport minus legend so the chart panel fits without scroll.
  const MIN_CHART_HEIGHT = 240;
  const MIN_COMPACT_CHART_HEIGHT = 180;
  const legendRef = useRef<HTMLDivElement | null>(null);
  const computePanelHeight = () => {
    if (typeof window === 'undefined') return 680;
    const vh = window.innerHeight;
    const top = containerRef.current?.getBoundingClientRect().top ?? 0;
    const padding = 10; // bottom breathing room
    const target = vh - top - padding;
    const minPanel = MIN_CHART_HEIGHT + 40; // minimal headroom for legend without excessive overflow
    return Math.max(minPanel, target);
  };
  const [panelHeight, setPanelHeight] = useState<number>(() => computePanelHeight());
  useEffect(() => {
    const onResize = () => setPanelHeight(computePanelHeight());
    window.addEventListener('resize', onResize, { passive: true });
    const raf = requestAnimationFrame(onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
  }, [status]);

  const [isDocumentVisible, setIsDocumentVisible] = useState(() => (
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'
  ));
  const [isIntersecting, setIsIntersecting] = useState(true);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const onVisibility = () => {
      setIsDocumentVisible(document.visibilityState !== 'hidden');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (status !== 'ok') {
      return;
    }
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver !== 'function') {
      setIsIntersecting(true);
      return () => {};
    }
    const observer = new IntersectionObserver((entries) => {
      const entry = entries.find((item) => item.target === element);
      setIsIntersecting(Boolean(entry?.isIntersecting));
    }, { threshold: 0.1 });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [status]);

  const isChartActive = status === 'ok' && isDocumentVisible && isIntersecting;
  useLayoutEffect(() => {
    if (status !== 'ok' || !isChartActive) return;
    const body = chartBodyRef.current;
    if (!body) return;

    let rafId: number | null = null;
    let dprMedia: MediaQueryList | null = null;

    const applyWidth = (_source: string) => {
      const rect = body.getBoundingClientRect();
      const parentRect = body.parentElement?.getBoundingClientRect();
      const raw = rect.width && rect.width > 0 ? rect.width : parentRect?.width ?? DEFAULT_WIDTH;
      const next = Math.max(0, Math.round(raw));
      // Dev debug logging removed in lean mode to reduce noise.
      setWidth((prev) => (Math.abs(prev - next) <= 1 ? prev : next));
    };

    const schedule = (source: string) => {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => applyWidth(source));
    };

    applyWidth('init');

    const ro = new ResizeObserver(() => schedule('resize-observer'));
    ro.observe(body);

    const onWindowResize = () => schedule('window-resize');
    window.addEventListener('resize', onWindowResize, { passive: true });

    const visualViewport = window.visualViewport;
    const onVisualViewport = () => schedule('visual-viewport');
    if (visualViewport?.addEventListener) {
      visualViewport.addEventListener('resize', onVisualViewport, { passive: true });
      visualViewport.addEventListener('scroll', onVisualViewport, { passive: true });
    }

    const onDprChange = () => {
      attachDprListener();
      schedule('dpr-change');
    };
    const attachDprListener = () => {
      if (dprMedia) {
        try { dprMedia.removeEventListener('change', onDprChange); } catch {/* ignore */}
      }
      if (typeof window.matchMedia !== 'function') {
        dprMedia = null;
        return;
      }
      dprMedia = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprMedia.addEventListener('change', onDprChange);
    };
    attachDprListener();

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      try { ro.disconnect(); } catch {/* ignore */}
      window.removeEventListener('resize', onWindowResize);
      if (visualViewport?.removeEventListener) {
        visualViewport.removeEventListener('resize', onVisualViewport);
        visualViewport.removeEventListener('scroll', onVisualViewport);
      }
      if (dprMedia) {
        try { dprMedia.removeEventListener('change', onDprChange); } catch {/* ignore */}
      }
    };
  }, [status, isChartActive]);

  useLayoutEffect(() => {
    if (hoverIndex == null || cursorPos == null || !tooltipRef.current) {
      return;
    }
    const { width: nextWidth, height: nextHeight } = tooltipRef.current.getBoundingClientRect();
    setTooltipSize((prev) => {
      if (Math.abs(prev.width - nextWidth) > 0.5 || Math.abs(prev.height - nextHeight) > 0.5) {
        return { width: nextWidth, height: nextHeight };
      }
      return prev;
    });
  }, [hoverIndex, cursorPos, toggles.showSMA5, toggles.showSMA20]);

  useEffect(() => () => {
    if (hoverFrameRef.current != null) {
      cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = null;
    }
    pendingHoverRef.current = null;
  }, []);

  useEffect(() => {
    if (!isChartActive || status !== 'ok') {
      return;
    }
    const body = chartBodyRef.current;
    const measure = () => {
      if (!body) return;
      const rect = body.getBoundingClientRect();
      const parentRect = body.parentElement?.getBoundingClientRect();
      const raw = rect.width && rect.width > 0 ? rect.width : parentRect?.width ?? DEFAULT_WIDTH;
      const next = Math.max(0, Math.round(raw));
      setWidth((prev) => (Math.abs(prev - next) <= 1 ? prev : next));
    };
    measure();
  }, [isChartActive, status]);
  // Symmetric horizontal margins (extend right spacing to match left)
  // Slightly tighter vertical margins now that overall height is reduced
  // Responsive margins: shrink side margins on narrow widths to maximize drawable area.
  // Slightly increase bottom margin to ensure volume bars + month labels are fully visible.
  // Increase bottom margin slightly to ensure volume baseline & month labels fully visible when baseline sits at zero.
  const baseMargin = { top: 6, right: 42, bottom: 40, left: 42 } as const;
  const margin = useMemo(() => {
    const w = width;
    if (w < 380) return { top: baseMargin.top, bottom: baseMargin.bottom, left: 30, right: 30 };
    if (w < 500) return { top: baseMargin.top, bottom: baseMargin.bottom, left: 36, right: 36 };
    if (w > 1200) return { top: baseMargin.top, bottom: baseMargin.bottom, left: 24, right: 24 };
    if (w > 900) return { top: baseMargin.top, bottom: baseMargin.bottom, left: 28, right: 28 };
    if (w > 700) return { top: baseMargin.top, bottom: baseMargin.bottom, left: 34, right: 34 };
    return baseMargin;
  }, [width]);
  const innerW = width - margin.left - margin.right;
  // innerH will be recomputed later per-render when chartHeight known; initialize with panelHeight fallback.
  let innerH = (panelHeight - margin.top - margin.bottom);

  // Prepare data arrays BEFORE any conditional rendering so hook order stays stable.
  const rawDays = Array.isArray(data?.days) ? data!.days : [];
  const lastTypeIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastTypeIdRef.current !== typeId) {
      // Reset any zoomed viewport when a different item renders.
      resetViewport();
      lastTypeIdRef.current = typeId;
    }
  }, [typeId, resetViewport]);
  const rawDayCount = rawDays.length;
  useEffect(() => {
    if (rawDayCount === 0) {
      if (viewport.start != null || viewport.end != null) {
        resetViewport();
      }
      return;
    }
    const maxIndex = rawDayCount - 1;
    let nextStart = viewport.start;
    let nextEnd = viewport.end;
    if (nextStart != null) {
      nextStart = Math.max(0, Math.min(nextStart, maxIndex));
    }
    if (nextEnd != null) {
      nextEnd = Math.max(0, Math.min(nextEnd, maxIndex));
    }
    if (nextStart != null && nextEnd != null && nextStart > nextEnd) {
      nextStart = nextEnd;
    }
    if (nextStart !== viewport.start || nextEnd !== viewport.end) {
      // Clamp persisted viewport to the available data range.
      setViewport(nextStart, nextEnd);
    }
  }, [rawDayCount, viewport.start, viewport.end, setViewport, resetViewport]);
  const effectiveDays = useMemo(() => {
    if (!rawDays.length) return rawDays;
    const start = viewport.start != null ? Math.max(0, viewport.start) : 0;
    const end = viewport.end != null ? Math.min(rawDays.length - 1, viewport.end) : rawDays.length - 1;
    return rawDays.slice(start, end + 1);
  }, [rawDays, viewport.start, viewport.end]);
  const totalPoints = effectiveDays.length;
  const boundsPerDay = useMemo(() => effectiveDays.map(deriveDayBounds), [effectiveDays]);
  const monthFormatter = useMemo(() => (
    typeof Intl !== 'undefined'
      ? new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' })
      : null
  ), []);

  const monthTicks = useMemo(() => {
    const ticks: Array<{ index: number; label: string; year: number; month: number }> = [];
    let lastKey: string | null = null;
    effectiveDays.forEach((day, index) => {
      const date = new Date(`${day.date}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
      if (key !== lastKey) {
        const monthLabel = monthFormatter?.format(date) ?? date.toISOString().slice(5, 7);
        const includeYear = ticks.length === 0 || ticks[ticks.length - 1]?.year !== date.getUTCFullYear();
        ticks.push({
          index,
          label: includeYear ? `${monthLabel} ${date.getUTCFullYear()}` : monthLabel,
          year: date.getUTCFullYear(),
          month: date.getUTCMonth(),
        });
        lastKey = key;
      }
    });
    if (effectiveDays.length > 0) {
      const finalIndex = effectiveDays.length - 1;
      if (!ticks.some((tick) => tick.index === finalIndex)) {
        const lastDate = new Date(`${effectiveDays[finalIndex]!.date}T00:00:00Z`);
        if (!Number.isNaN(lastDate.getTime()) && lastDate.getUTCDate() === 1) {
          const monthLabel = monthFormatter?.format(lastDate) ?? lastDate.toISOString().slice(5, 7);
          const includeYear = ticks.length === 0 || ticks[ticks.length - 1]?.year !== lastDate.getUTCFullYear();
          ticks.push({
            index: finalIndex,
            label: includeYear ? `${monthLabel} ${lastDate.getUTCFullYear()}` : monthLabel,
            year: lastDate.getUTCFullYear(),
            month: lastDate.getUTCMonth(),
          });
        }
      }
    }
    return ticks;
  }, [effectiveDays, monthFormatter]);
  const weekTicks = useMemo(() => {
    if (!effectiveDays.length) return [] as Array<{ index: number }>;
  const monthIndices = new Set(monthTicks.map((tick) => tick.index));
    const ticks: Array<{ index: number }> = [];
    effectiveDays.forEach((day, index) => {
      const date = new Date(`${day.date}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return;
      if (date.getUTCDay() === 1 && !monthIndices.has(index)) {
        ticks.push({ index });
      }
    });
    return ticks;
  }, [effectiveDays, monthTicks]);

  const seriesMemo = useMemo(() => {
    if (!effectiveDays.length) {
      return {
        prices: [] as number[],
        buySeries: [] as number[],
        sellSeries: [] as number[],
        sma5: [] as number[],
        sma20: [] as number[],
        donTop: [] as number[],
        donBot: [] as number[],
        rawVolumeSeries: [] as Array<number | undefined>,
        volumes: [] as number[],
        rawMin: 0,
        rawMax: 1,
        domainMin: 0,
        domainMax: 1,
      };
    }

    const clampSeriesValue = (value: number | undefined, index: number): number => {
      const clamped = clampToBounds(value, boundsPerDay[index]);
      return isFiniteNumber(clamped) ? clamped : NaN;
    };

    const pricesSeries = effectiveDays.map((d, index) => {
      let candidate: number | undefined;
      if (isFiniteNumber(d.median)) {
        candidate = d.median as number;
      } else if (isFiniteNumber(d.buyHigh) && isFiniteNumber(d.sellLow)) {
        candidate = ((d.buyHigh as number) + (d.sellLow as number)) / 2;
      } else if (isFiniteNumber(d.buyAvg) && isFiniteNumber(d.sellAvg)) {
        candidate = ((d.buyAvg as number) + (d.sellAvg as number)) / 2;
      } else if (isFiniteNumber(d.buyAvg)) {
        candidate = d.buyAvg as number;
      } else if (isFiniteNumber(d.sellAvg)) {
        candidate = d.sellAvg as number;
      }
      return clampSeriesValue(candidate, index);
    });

    const buy = effectiveDays.map((d, index) => {
      const candidate = isFiniteNumber(d.buyHigh)
        ? (d.buyHigh as number)
        : (isFiniteNumber(d.buyAvg) ? (d.buyAvg as number) : undefined);
      return clampSeriesValue(candidate, index);
    });

    const sell = effectiveDays.map((d, index) => {
      const candidate = isFiniteNumber(d.sellLow)
        ? (d.sellLow as number)
        : (isFiniteNumber(d.sellAvg) ? (d.sellAvg as number) : undefined);
      return clampSeriesValue(candidate, index);
    });

    const sma5Series = effectiveDays.map((d, index) => clampSeriesValue(
      isFiniteNumber(d.sma5) ? (d.sma5 as number) : undefined,
      index,
    ));
    const sma20Series = effectiveDays.map((d, index) => clampSeriesValue(
      isFiniteNumber(d.sma20) ? (d.sma20 as number) : undefined,
      index,
    ));
    const donchianTop = effectiveDays.map((d, index) => clampSeriesValue(
      isFiniteNumber(d.donchian_top) ? (d.donchian_top as number) : undefined,
      index,
    ));
    const donchianBottom = effectiveDays.map((d, index) => clampSeriesValue(
      isFiniteNumber(d.donchian_bottom) ? (d.donchian_bottom as number) : undefined,
      index,
    ));
    const volumeRaw = effectiveDays.map((d) => (Number.isFinite(d.volume) ? Number(d.volume) : undefined));
    const volumeSeries = volumeRaw.map((value) => (typeof value === 'number' ? value : 0));

    const priceCandidates: number[] = [];
    for (let i = 0; i < effectiveDays.length; i += 1) {
      const day = effectiveDays[i];
      const vals = [
        pricesSeries[i],
        buy[i],
        sell[i],
        sma5Series[i],
        sma20Series[i],
        donchianTop[i],
        donchianBottom[i],
      ];
      vals.forEach((val) => {
        if (Number.isFinite(val)) priceCandidates.push(val as number);
      });
      const bounds = boundsPerDay[i];
      if (bounds) {
        if (isFiniteNumber(bounds.min)) priceCandidates.push(bounds.min);
        if (isFiniteNumber(bounds.max)) priceCandidates.push(bounds.max);
      }
      if (isFiniteNumber(day.buyLow)) priceCandidates.push(day.buyLow as number);
      if (isFiniteNumber(day.sellHigh)) priceCandidates.push(day.sellHigh as number);
    }

    const minCandidate = priceCandidates.length ? Math.min(...priceCandidates) : 0;
    const maxCandidate = priceCandidates.length ? Math.max(...priceCandidates) : 1;
    const minMaxSpan = maxCandidate - minCandidate || Math.max(1, maxCandidate * 0.2);
    const headroom = minMaxSpan * 0.08;
    let nextDomainMin = minCandidate - headroom;
    let nextDomainMax = maxCandidate + headroom;
    if ((nextDomainMax - nextDomainMin) < (maxCandidate * 0.02)) {
      const pad = maxCandidate * 0.01 || 1;
      nextDomainMin = minCandidate - pad;
      nextDomainMax = maxCandidate + pad;
    }
    if (nextDomainMin < 0 && minCandidate >= 0) {
      nextDomainMin = Math.max(0, minCandidate * 0.92);
    }

    return {
      prices: pricesSeries,
      buySeries: buy,
      sellSeries: sell,
      sma5: sma5Series,
      sma20: sma20Series,
      donTop: donchianTop,
      donBot: donchianBottom,
      rawVolumeSeries: volumeRaw,
      volumes: volumeSeries,
      rawMin: minCandidate,
      rawMax: maxCandidate,
      domainMin: nextDomainMin,
      domainMax: nextDomainMax,
    };
  }, [effectiveDays, boundsPerDay]);

  const {
    prices,
    buySeries,
    sellSeries,
    sma5,
    sma20,
    donTop,
    donBot,
    rawVolumeSeries,
    volumes,
    rawMin,
    rawMax,
    domainMin,
    domainMax,
  } = seriesMemo;

  if (status === 'loading') {
    return (
  <div className="market-history__loading" style={{ minHeight: panelHeight }}>
        Loading market history…
      </div>
    );
  }
  if (status === 'error') {
    return (
  <div className="market-history__empty" style={{ minHeight: panelHeight }}>
        Market history unavailable (network or upstream error).
        <button type="button" style={{ marginLeft: 8 }} onClick={() => refetch()}>Retry</button>
      </div>
    );
  }
  if (!data || !Array.isArray(data.days)) {
  return <div className="market-history__empty" style={{ minHeight: panelHeight }}>Malformed history.</div>;
  }
  if (status === 'partial') {
    return (
  <div className="market-history__empty" style={{ minHeight: panelHeight }}>
        No daily history yet (snapshot only).
      </div>
    );
  }
  if (status === 'empty') {
    return (
  <div className="market-history__empty" style={{ minHeight: panelHeight }}>
        No market history available yet for this item.
        <button type="button" style={{ marginLeft: 8 }} onClick={() => refetch()}>Refresh</button>
      </div>
    );
  }


  const buildSegmentedLine = (series: number[]) => {
    let path = '';
    let running = false;
    for (let i = 0; i < series.length; i++) {
      const val = series[i];
      if (Number.isFinite(val)) {
        path += `${running ? 'L' : 'M'}${xScale(i)},${yScalePrice(val)} `;
        running = true;
      } else {
        running = false;
      }
    }
    return path.trim();
  };

  const donchianBandPath = () => {
    if (!toggles.showDonchian) return null;
    const topPts: Array<{ i: number; v: number }> = [];
    const bottomPts: Array<{ i: number; v: number }> = [];
    for (let i = 0; i < donTop.length; i++) {
      if (Number.isFinite(donTop[i])) topPts.push({ i, v: donTop[i] });
    }
    for (let i = 0; i < donBot.length; i++) {
      if (Number.isFinite(donBot[i])) bottomPts.push({ i, v: donBot[i] });
    }
    if (!topPts.length || !bottomPts.length) return null;
    let dAttr = '';
    for (const pt of topPts) {
      dAttr += `${dAttr ? 'L' : 'M'}${xScale(pt.i)},${yScalePrice(pt.v)} `;
    }
    for (let i = bottomPts.length - 1; i >= 0; i--) {
      const pt = bottomPts[i];
      dAttr += `L${xScale(pt.i)},${yScalePrice(pt.v)} `;
    }
    return dAttr.trim();
  };

  const formatPriceTick = (value: number) => {
    if (!Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toFixed(abs >= 100 ? 0 : 2);
  };

  const formatPriceDetailed = (value: number | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(3)}B`;
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(3)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatVolume = (value: number | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  // (Tick & volume scales will be computed after stabilized layout & primary scales are defined.)

  // Compute dynamic chartHeight each render for use in tooltip and scales.
  const legendHNow = (globalThis as any).__LEGEND_TMP__ = (legendRef.current?.offsetHeight ?? 0);
  const availableChartH = panelHeight - legendHNow;
  const minRenderHeight = MIN_COMPACT_CHART_HEIGHT + margin.top + margin.bottom;
  const chartHeight = Math.max(availableChartH, minRenderHeight);
  innerH = chartHeight - margin.top - margin.bottom;

  // ---- Stabilized layout & scale computation (moved after innerH finalization) ----
  // Hybrid edge anchoring:
  // - If points are sparse (wide gaps), use classic half-step anchoring (Option 2) for balanced symmetry.
  // - If points are dense, use dynamic padding = bandWidth/2 (Option 4) so outer bars sit near edges without overflow.
  const n = totalPoints;
  const denseThreshold = 30; // px per point
  // We start with innerW as full drawable width (no explicit horizPad variable anymore).
  let bandWidth = 8;
  let step = innerW;
  if (n > 0) {
    // First compute provisional step assuming edge anchoring formula (Option 1): innerW / n
    const provisionalStep = innerW / (n || 1);
    // Provisional band at 72% of provisional step.
    bandWidth = Math.min(36, Math.max(4, provisionalStep * 0.72));
    const pxPerPoint = innerW / (n || 1);
    const sparse = pxPerPoint > denseThreshold;
    if (n === 1) {
      step = 0; // Single point centered
    } else if (sparse) {
      // Option 2: step across (n-1) intervals, reserve bandWidth so edges align.
      step = (innerW - bandWidth) / (n - 1);
    } else {
      // Dense: treat as evenly packed cells (Option 4 variant). Each cell width = innerW / n.
      step = innerW / n;
      bandWidth = Math.min(step * 0.9, bandWidth); // shrink inside cell if needed
    }
  }
  // Scale functions per mode
  const xScale = (i: number) => {
    if (n <= 0) return 0;
    if (n === 1) return innerW / 2; // single point center
    const pxPerPoint = innerW / n;
    const sparse = pxPerPoint > denseThreshold;
    if (sparse) {
      // Half-step anchoring: bar centered with edges touching near 0 and innerW.
      return bandWidth / 2 + i * step;
    }
    // Dense: cell-centric; center within cell.
    return (i + 0.5) * step;
  };
  // --- LAYOUT REFACTOR TO PREVENT BOTTOM CLIPPING --------------------------------
  // Problem: With previous layout we drew everything (prices, volumes, month labels)
  // inside a single innerH; month labels sat BELOW innerH (+14), causing visual
  // clipping (labels & bottoms of bars cut off). Also lowest price points could be
  // obscured by volume bars when baseline overlapped.
  // Solution: create three vertical zones inside innerH:
  //   [ Price Area | Volume Area | Axis Label Band ]
  // The axis label band is a fixed 18px (enough for text & minor ticks) reserved at bottom.
  // The volume area occupies up to 28-32% (configurable) of remaining height.
  // Price area takes the rest. Baseline for price series is the TOP of the volume area.
  // Month labels & day ticks render inside the axis band, guaranteed visible.
  const axisBandH = 24; // expanded bottom band for month labels and weekly tick marks
  const combinedH = innerH - axisBandH; // unified drawable region for price + volume
  // Recombined layout: prices and volumes share same vertical space. Baseline for both
  // (lowest price & volume zero) sits at combinedH - 1. Volume bars extend upward.
  const baselineY = combinedH - 1;
  const yScalePrice = (p: number) => {
    if (!Number.isFinite(p)) return baselineY;
    const clamped = Math.min(Math.max(p, domainMin), domainMax);
    return baselineY - ((clamped - domainMin) / (domainMax - domainMin || 1)) * (combinedH * 0.92); // reserve ~8% headroom top
  };
  const maxVolume = Math.max(...volumes, 1);
  const volumeHeight = combinedH * 0.30; // visual target for tallest bar
  const yScaleVolume = (v: number) => baselineY - (v / (maxVolume || 1)) * volumeHeight;
  const priceTicks = Array.from({ length: 5 }, (_, idx) => domainMin + ((domainMax - domainMin) * idx) / 4);
  // Volume ticks: ensure granular, always at least 0, mid, max.
  const volumeTicks = (() => {
    const ticks: number[] = [];
    const maxV = maxVolume || 1;
    if (maxV <= 1) return [0, maxV];
    // Determine a 'nice' step aiming for 3-4 ticks.
    const desired = 3;
    const rawStep = maxV / desired;
    const pow10 = 10 ** Math.floor(Math.log10(rawStep));
    const candidates = [1,2,2.5,5,10].map(c => c * pow10);
    let step = candidates[0];
    for (const c of candidates) {
      if (c >= rawStep) { step = c; break; }
    }
    // Build ticks starting at step (skip duplicating 0) up to max
    for (let v = step; v < maxV; v += step) {
      ticks.push(v);
      if (ticks.length > 6) break; // guard (avoid too many)
    }
    if (ticks[ticks.length - 1] !== maxV) ticks.push(maxV);
    return [0, ...ticks];
  })();

  const snapshot = data.snapshot;
  const latestIndex = totalPoints - 1;
  const latestX = latestIndex >= 0 ? xScale(latestIndex) : null;
  const snapshotBuy = snapshot?.buy?.price;
  const snapshotSell = snapshot?.sell?.price;
  const snapshotFiveBuy = snapshot?.buy?.fivePercent;
  const snapshotFiveSell = snapshot?.sell?.fivePercent;

  const hoverValid = hoverIndex != null && hoverIndex >= 0 && hoverIndex < totalPoints;
  const hoverData = hoverValid ? effectiveDays[hoverIndex!] : null;
  const hoverBounds = hoverValid ? boundsPerDay[hoverIndex!] : undefined;
  const clampHoverValue = (value: number | undefined | null): number | undefined => (
    hoverValid ? clampToBounds(value, hoverBounds) : undefined
  );

  const flushHoverFrame = () => {
    if (hoverFrameRef.current != null) {
      cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = null;
    }
  };

  const scheduleHoverUpdate = (index: number, cursor: { x: number; y: number }) => {
    pendingHoverRef.current = { index, cursor };
    if (hoverFrameRef.current != null) {
      return;
    }
    if (typeof requestAnimationFrame !== 'function') {
      setHoverIndex(index);
      setCursorPos(cursor);
      pendingHoverRef.current = null;
      return;
    }
    hoverFrameRef.current = requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      const pending = pendingHoverRef.current;
      pendingHoverRef.current = null;
      if (!pending) return;
      setHoverIndex(pending.index);
      setCursorPos(pending.cursor);
    });
  };

  const clearHover = () => {
    flushHoverFrame();
    pendingHoverRef.current = null;
    setHoverIndex(null);
    setCursorPos(null);
  };

  const applyPointerPosition = (clientX: number, clientY: number, rect: DOMRect) => {
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const relativeX = localX - margin.left;
    if (relativeX < 0 || relativeX > innerW || totalPoints <= 0) {
      clearHover();
      return;
    }
    const idx = Math.round((relativeX / (innerW || 1)) * Math.max(totalPoints - 1, 0));
    scheduleHoverUpdate(idx, { x: localX, y: localY });
  };

  const handleTouchPoint = (event: React.TouchEvent<SVGSVGElement>) => {
    if (!event.touches.length) {
      clearHover();
      return;
    }
    const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const touch = event.touches[0];
    applyPointerPosition(touch.clientX, touch.clientY, rect);
  };

  let tooltipNode: React.ReactNode = null;
  if (hoverValid && hoverData && cursorPos) {
    const hoverMedian = isFiniteNumber(prices[hoverIndex!]) ? prices[hoverIndex!] : undefined;
    const hoverBuyAvg = clampHoverValue(hoverData.buyAvg);
    const hoverSellAvg = clampHoverValue(hoverData.sellAvg);
    const hoverBuyLow = clampHoverValue(hoverData.buyLow);
    const hoverSellHigh = clampHoverValue(hoverData.sellHigh);
    const hoverSma5 = clampHoverValue(hoverData.sma5 as number | undefined);
    const hoverSma20 = clampHoverValue(hoverData.sma20 as number | undefined);
    const fallbackWidth = 180;
    const fallbackHeight = 140;
    const tipWidth = tooltipSize.width > 0 ? tooltipSize.width : fallbackWidth;
    const tipHeight = tooltipSize.height > 0 ? tooltipSize.height : fallbackHeight;
    const pointerX = cursorPos.x || 0;
    const pointerY = cursorPos.y || 0;
    const edgePad = 8;
    const horizGap = 10;
    const vertGap = 3;

    const minLeft = margin.left + edgePad;
    const maxLeft = Math.max(minLeft, width - margin.right - tipWidth - edgePad);
    let left = pointerX + horizGap;
    if (left + tipWidth > width - margin.right - edgePad) {
      left = pointerX - tipWidth - horizGap;
    }
    left = Math.min(maxLeft, Math.max(minLeft, left));

    const minTop = Math.max(edgePad, margin.top + edgePad);
    const maxTop = Math.max(minTop, chartHeight - margin.bottom - tipHeight - edgePad);
    let top = pointerY - tipHeight - vertGap;
    if (top < minTop) {
      top = pointerY + vertGap;
    }
    top = Math.min(maxTop, Math.max(minTop, top));

    tooltipNode = (
      <div
        ref={tooltipRef}
        className={styles.tooltipFloating}
        role="status"
        data-testid="market-history-tooltip"
        style={{
          position: 'absolute',
          top,
          left,
          pointerEvents: 'none'
        }}
      >
        <strong>{hoverData.date}</strong>
        <div>Median: {formatPriceDetailed(hoverMedian)}</div>
        <div>Buy Avg: {formatPriceDetailed(hoverBuyAvg)}</div>
        <div>Sell Avg: {formatPriceDetailed(hoverSellAvg)}</div>
        <div>Min/Max: {formatPriceDetailed(hoverBuyLow)} – {formatPriceDetailed(hoverSellHigh)}</div>
        {(() => {
          if (hoverIndex != null && hoverIndex > 0 && effectiveDays[hoverIndex - 1]) {
            const prev = effectiveDays[hoverIndex - 1];
            const prevBuy = isFiniteNumber(prev.buyAvg) ? prev.buyAvg : undefined;
            const prevSell = isFiniteNumber(prev.sellAvg) ? prev.sellAvg : undefined;
            const prevMedian = isFiniteNumber(prev.median as any) ? (prev.median as any as number) : undefined;
            const baseForDelta = isFiniteNumber(hoverMedian)
              ? hoverMedian
              : (isFiniteNumber(hoverBuyAvg) ? hoverBuyAvg : hoverSellAvg);
            let priceDelta: number | undefined;
            if (isFiniteNumber(baseForDelta)) {
              const prevBase = prevMedian ?? prevBuy ?? prevSell;
              if (isFiniteNumber(prevBase)) priceDelta = (baseForDelta as number) - prevBase;
            }
            const volumeDelta = isFiniteNumber(prev.volume) ? hoverData.volume - prev.volume : undefined;
            const fmtVolDelta = (d?: number) => d == null ? '—' : `${d > 0 ? '+' : ''}${formatVolume(Math.abs(d))}`;
            return (
              <>
                <div>Volume: {formatVolume(hoverData.volume)} <span style={{ opacity: 0.7 }}>({fmtVolDelta(volumeDelta)})</span></div>
                {priceDelta != null && (
                  <div>Δ Price: <span style={{ color: priceDelta > 0 ? 'var(--price-up)' : priceDelta < 0 ? 'var(--price-down)' : 'var(--legend-fg)' }}>{priceDelta > 0 ? '+' : ''}{formatPriceDetailed(Math.abs(priceDelta))}</span></div>
                )}
              </>
            );
          }
          return <div>Volume: {formatVolume(hoverData.volume)}</div>;
        })()}
        {toggles.showSMA5 && isFiniteNumber(hoverSma5) && (
          <div>SMA5: {formatPriceDetailed(hoverSma5)}</div>
        )}
        {toggles.showSMA20 && isFiniteNumber(hoverSma20) && (
          <div>SMA20: {formatPriceDetailed(hoverSma20)}</div>
        )}
      </div>
    );
  }

  return (
  <div
      className={`market-history ${styles.chartPanel}`}
      ref={containerRef}
      style={{ height: panelHeight }}
      data-testid="market-history-root"
    >
    {/* Centered legend (overlay toggle buttons) */}
    <div ref={legendRef} className={styles.legend} style={{ marginBottom: 6, padding:'4px 6px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:4, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap:4 }}>
        <LegendToggle color="var(--median-point)" label="Median Day Price" toggleKey="showMedian" shape="dot" />
        <LegendToggle color="var(--buy-line)" label="Buy (High)" staticOnly shape="line" />
        <LegendToggle color="var(--sell-line)" label="Sell (Low)" staticOnly shape="line" />
        <LegendToggle color="var(--sma5-line)" label="Moving Avg. 5d" toggleKey="showSMA5" shape="dash" />
        <LegendToggle color="var(--sma20-line)" label="Moving Avg. 20d" toggleKey="showSMA20" shape="dash" />
        <LegendToggle color="var(--minmax-fill)" label="Min / Max" toggleKey="showMinMax" shape="block" />
        <LegendToggle color="var(--donchian-border)" label="Donchian" toggleKey="showDonchian" shape="area" />
        <LegendToggle color="var(--volume-bar)" label="Volume" toggleKey="showVolume" shape="bar" />
      </div>
  <div className={styles.chartBody} ref={chartBodyRef} data-test-chart-root>
        <svg
          className={styles.chartSvg}
          width={width}
          height={chartHeight}
          data-testid="market-history-svg"
          role="img"
          aria-label="60 day price & volume history"
          onMouseLeave={clearHover}
          onMouseMove={(event) => {
            const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
            applyPointerPosition(event.clientX, event.clientY, rect);
          }}
          onTouchStart={handleTouchPoint}
          onTouchMove={handleTouchPoint}
          onTouchEnd={clearHover}
          onTouchCancel={clearHover}
        >
        <defs>
          <linearGradient id="chartBackgroundGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-bg-top)" />
            <stop offset="100%" stopColor="var(--chart-bg-bottom)" />
          </linearGradient>
          <linearGradient id="volumeGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--volume-bar)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--volume-bar)" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="minmaxGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--minmax-fill)" stopOpacity="0.65" />
            <stop offset="100%" stopColor="var(--minmax-fill)" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <g transform={`translate(${margin.left},${margin.top})`}>
          <rect x={-margin.left} y={-margin.top} width={width} height={chartHeight} fill="url(#chartBackgroundGradient)" fillOpacity={0} />
          {priceTicks.map((tick, idx) => {
            const rawY = yScalePrice(tick);
            const bold = idx === 0 || idx === priceTicks.length - 1 || idx === Math.floor(priceTicks.length / 2);
            // Clamp label to stay inside chart padding
            const LABEL_PAD_TOP = 6;
            const LABEL_PAD_BOTTOM = 6;
            const clampedY = Math.min(innerH - axisBandH - LABEL_PAD_BOTTOM, Math.max(LABEL_PAD_TOP, rawY));
            return (
              <g key={`h-${idx}`}>
                <line x1={0} x2={innerW} y1={rawY} y2={rawY} stroke={bold ? 'var(--grid-line-strong)' : 'var(--grid-line)'} strokeWidth={0.5} />
                <text x={-8} y={clampedY + 4} fontSize={10} textAnchor="end" fill="var(--tick-color)">
                  {formatPriceTick(tick)}
                </text>
              </g>
            );
          })}
          {/* Price baseline (top of volume area) */}
          <line x1={0} x2={innerW} y1={baselineY} y2={baselineY} stroke="var(--grid-line-strong)" strokeWidth={0.7} />
          {/* Volume axis ticks (moved to right side). */}
          {toggles.showVolume && (
            <g aria-label="volume grid and ticks">
              {/* Volume background area guide */}
              {/* Optional subtle volume background now spans expected max bar height area (from baseline upward). */}
              <rect x={0} y={baselineY - volumeHeight} width={innerW} height={volumeHeight} fill="var(--volume-area-bg, transparent)" fillOpacity={0.03} />
              {/* Baseline already drawn above (price baseline). Avoid re-drawing zero volume line to prevent label ghosting. */}
              {volumeTicks.map((v, i) => {
                const y = yScaleVolume(v);
                const strong = v === 0 || v === maxVolume;
                return (
                  <g key={`vt-${i}`} aria-hidden="true" data-testid="volume-tick-row">
                    {/* Skip drawing horizontal guide for zero (baseline already present) */}
                    {v !== 0 && (
                      <line
                        x1={0}
                        x2={innerW}
                        y1={y}
                        y2={y}
                        stroke={strong ? 'var(--grid-line-strong)' : 'var(--grid-line)'}
                        strokeWidth={strong ? 0.6 : 0.35}
                        strokeDasharray={strong ? undefined : '2 4'}
                      />
                    )}
                    {/* Right-side short tick marker */}
                    <line x1={innerW} x2={innerW + 4} y1={y} y2={y} stroke="var(--tick-color)" strokeWidth={0.6} data-testid="volume-tick-short" />
                    <text x={innerW + 5} y={y + 3} fontSize={9} textAnchor="start" fill="var(--tick-color)" opacity={0.72}>{formatVolume(v)}</text>
                  </g>
                );
              })}
            </g>
          )}
          {/* Week and month tick marks anchored in bottom axis band */}
          <g aria-label="time-axis">
            <rect x={0} y={combinedH} width={innerW} height={axisBandH} fill="transparent" />
            <line
              x1={0}
              x2={innerW}
              y1={combinedH}
              y2={combinedH}
              stroke="var(--tick-strong)"
              strokeWidth={0.9}
              opacity={0.9}
            />
            {weekTicks.map((tick) => {
              const x = xScale(tick.index);
              return (
                <line
                  key={`w-${tick.index}`}
                  x1={x}
                  x2={x}
                  y1={combinedH}
                  y2={combinedH + 4}
                  stroke="var(--tick-color)"
                  strokeWidth={0.85}
                  opacity={0.85}
                />
              );
            })}
            {monthTicks.map((tick) => {
              const x = xScale(tick.index);
              return (
                <g key={`m-${tick.index}`}>
                  <line x1={x} x2={x} y1={0} y2={baselineY} stroke="var(--grid-vertical)" strokeWidth={0.4} strokeDasharray="2 6" opacity={0.3} />
                  <line x1={x} x2={x} y1={combinedH} y2={combinedH + 8} stroke="var(--tick-strong)" strokeWidth={1.2} />
                  <text
                    x={x}
                    y={combinedH + axisBandH - 6}
                    fontSize={10}
                    textAnchor="middle"
                    fill="var(--tick-label-color)"
                    stroke="var(--tick-label-outline)"
                    strokeWidth={0.9}
                    paintOrder="stroke"
                    fontWeight={600}
                  >
                    {tick.label}
                  </text>
                </g>
              );
            })}
          </g>
          {donchianBandPath() && (
            <path d={donchianBandPath()!} fill="var(--donchian-fill)" stroke="var(--donchian-border)" strokeWidth={0.5} />
          )}
          {toggles.showVolume && (
            <g aria-label="volume bars">
              {effectiveDays.map((day, index) => {
                const value = volumes[index];
                if (!value) return null;
                const x = xScale(index) - bandWidth * 0.5;
                const topY = yScaleVolume(value);
                let h = baselineY - topY;
                if (h < 2) h = 2;
                return (
                  <rect
                    key={`vol-${day.date}`}
                    x={x}
                    y={baselineY - h}
                    width={bandWidth}
                    height={h}
                    fill="url(#volumeGradient)"
                    opacity={0.85}
                  />
                );
              })}
            </g>
          )}
          {toggles.showMinMax && (
            <g aria-label="min max range">
              {effectiveDays.map((day, index) => {
                const high = Number.isFinite(day.sellHigh) ? (day.sellHigh as number) : (Number.isFinite(day.sellAvg) ? (day.sellAvg as number) : NaN);
                const low = Number.isFinite(day.buyLow) ? (day.buyLow as number) : (Number.isFinite(day.buyAvg) ? (day.buyAvg as number) : NaN);
                if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
                const x = xScale(index) - bandWidth * 0.5;
                const yHigh = yScalePrice(high);
                const yLow = yScalePrice(low);
                const rectHeight = Math.max(1, yLow - yHigh);
                return (
                  <g key={`mm-${day.date}`}>
                    <rect x={x} y={yHigh} width={bandWidth} height={rectHeight} fill="url(#minmaxGradient)" />
                    <line x1={x + (bandWidth * 0.5)} x2={x + (bandWidth * 0.5)} y1={yScalePrice(high)} y2={yScalePrice(low)} stroke="var(--minmax-stroke)" strokeWidth={1} />
                  </g>
                );
              })}
            </g>
          )}
          {toggles.showMedian && (
            <g aria-label="median price series (disconnected dots)">
              {prices.map((val, idx) => {
                if (!Number.isFinite(val)) return null;
                return (
                  <circle
                    key={`median-${idx}`}
                    cx={xScale(idx)}
                    cy={yScalePrice(val)}
                    r={3}
                    fill="var(--median-point)"
                    stroke="var(--median-point-stroke)"
                    strokeWidth={0.8}
                  />
                );
              })}
            </g>
          )}
          <path d={buildSegmentedLine(buySeries)} fill="none" stroke="var(--buy-line)" strokeWidth={1} strokeLinecap="round" />
          <path d={buildSegmentedLine(sellSeries)} fill="none" stroke="var(--sell-line)" strokeWidth={1} strokeLinecap="round" />
          {toggles.showSMA5 && (
            <path d={buildSegmentedLine(sma5)} fill="none" stroke="var(--sma5-line)" strokeWidth={1.2} strokeDasharray="4 3" strokeLinecap="round" />
          )}
          {toggles.showSMA20 && (
            <path d={buildSegmentedLine(sma20)} fill="none" stroke="var(--sma20-line)" strokeWidth={1.3} strokeDasharray="3 2" strokeLinecap="round" />
          )}
          {latestX != null && (snapshotBuy || snapshotSell) && (
            <g aria-label="snapshot markers">
              {typeof snapshotBuy === 'number' && Number.isFinite(snapshotBuy) && (
                <circle cx={latestX} cy={yScalePrice(snapshotBuy)} r={3.4} fill="var(--snapshot-buy)" stroke="#0f172a" strokeWidth={0.8} />
              )}
              {typeof snapshotSell === 'number' && Number.isFinite(snapshotSell) && (
                <circle cx={latestX} cy={yScalePrice(snapshotSell)} r={3.4} fill="var(--snapshot-sell)" stroke="#0f172a" strokeWidth={0.8} />
              )}
              {typeof snapshotFiveBuy === 'number' && Number.isFinite(snapshotFiveBuy) && (
                <circle cx={latestX + 6} cy={yScalePrice(snapshotFiveBuy)} r={2.2} fill="var(--snapshot-p5-buy)" />
              )}
              {typeof snapshotFiveSell === 'number' && Number.isFinite(snapshotFiveSell) && (
                <circle cx={latestX + 6} cy={yScalePrice(snapshotFiveSell)} r={2.2} fill="var(--snapshot-p5-sell)" />
              )}
            </g>
          )}
          {hoverValid && (
            <g aria-label="hover crosshair">
              <rect
                x={xScale(hoverIndex!)-bandWidth*0.5}
                y={0}
                width={bandWidth}
                height={innerH}
                fill="var(--hover-fill)"
              />
              <line x1={xScale(hoverIndex!)} x2={xScale(hoverIndex!)} y1={0} y2={innerH} stroke="var(--hover-line)" strokeDasharray="3 2" />
              {Number.isFinite(prices[hoverIndex!]) && (
                <circle cx={xScale(hoverIndex!)} cy={yScalePrice(prices[hoverIndex!])} r={3.4} fill="var(--hover-point)" stroke="#0f172a" strokeWidth={0.6} />
              )}
            </g>
          )}
        </g>
        </svg>
        {tooltipNode}
      </div>
    </div>
  );
}

interface LegendToggleProps {
  color: string;
  label: string;
  toggleKey?: keyof MarketHistoryToggles;
  staticOnly?: boolean;
  shape?: 'dot' | 'line' | 'dash' | 'block' | 'area' | 'bar';
}

function LegendToggle({ color, label, toggleKey, staticOnly, shape = 'dot' }: LegendToggleProps) {
  const value = useMarketHistoryStore((s) => (toggleKey ? s.toggles[toggleKey] : true));
  const setToggle = useMarketHistoryStore((s) => s.setToggle);
  const shapeNode = (() => {
    switch (shape) {
      case 'line':
        return <span style={{ width: 18, height: 2, background: color, borderRadius: 1, display: 'inline-block' }} />;
      case 'dash':
        return (
          <span
            style={{
              width: 18,
              height: 2,
              backgroundImage: `repeating-linear-gradient(90deg, ${color}, ${color} 6px, transparent 6px, transparent 11px)`,
              display: 'inline-block'
            }}
          />
        );
      case 'block':
        return <span style={{ width: 12, height: 12, background: color, borderRadius: 2, opacity: 0.8, display: 'inline-block' }} />;
      case 'area':
        return (
          <span
            style={{
              width: 14,
              height: 10,
              backgroundImage: `linear-gradient(180deg, ${color}77, ${color}11)`,
              display: 'inline-block'
            }}
          />
        );
      case 'bar':
        return <span style={{ width: 7, height: 12, background: color, borderRadius: 1, opacity: 0.8, display: 'inline-block' }} />;
      case 'dot':
      default:
        return <span style={{ width: 9, height: 9, background: color, borderRadius: '50%', display: 'inline-block' }} />;
    }
  })();
  return (
    <button
      type="button"
      onClick={() => {
        if (!staticOnly && toggleKey) setToggle(toggleKey, !value);
      }}
      style={{
        appearance: 'none',
        border: 'none',
        padding: '2px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: staticOnly ? 'transparent' : value ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: 'var(--legend-fg)',
        cursor: staticOnly ? 'default' : 'pointer',
        fontSize: '0.64rem',
        borderRadius: 5,
        opacity: value ? 1 : 0.4,
        boxShadow: value && !staticOnly ? '0 0 0 1px rgba(255,255,255,0.18) inset' : '0 0 0 1px rgba(255,255,255,0.05) inset',
        transition: 'background 120ms ease, opacity 120ms ease'
      }}
      aria-pressed={toggleKey ? value : undefined}
    >
      {shapeNode}
      {label}
    </button>
  );
}
