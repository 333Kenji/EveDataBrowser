import { lazy, Suspense, useId, useMemo, type CSSProperties } from 'react';
import { MarketHistoryChart, useUnifiedMarketModel } from '../../features/market-browser/MarketHistoryChart';

const LazyCanvasMarketHistoryChart = lazy(() => import('../../features/market-browser/CanvasMarketHistoryChart').then((module) => ({ default: module.CanvasMarketHistoryChart })));

type UnifiedSnapshot = NonNullable<ReturnType<typeof useUnifiedMarketModel>['model']>['snapshot'];
type UnifiedHistoryPoint = NonNullable<ReturnType<typeof useUnifiedMarketModel>['model']>['days'][number];

type MarketStatus = ReturnType<typeof useUnifiedMarketModel>['status'];

type HeadingLevel = 'h3' | 'h4' | 'h5';

interface MarketInsightsSectionProps {
  typeId: string;
  experimentalCanvas?: boolean;
  headingLevel?: HeadingLevel;
}

export function MarketInsightsSection({ typeId, experimentalCanvas = false, headingLevel = 'h5' }: MarketInsightsSectionProps) {
  const headingId = useId();
  const marketQuery = useUnifiedMarketModel(typeId);
  const { status, model, error, refetch } = marketQuery;
  const snapshot = model?.snapshot;
  const shouldShowSnapshot = snapshot && (status === 'ok' || status === 'partial');
  const volumeStats = useMemo(() => computeVolumeAverages(model?.days ?? []), [model?.days]);
  const resolvedVolumeStats = useMemo(
    () => volumeStats.filter((stat): stat is { label: string; value: number } => (
      typeof stat.value === 'number' && Number.isFinite(stat.value)
    )),
    [volumeStats]
  );
  const hasVolumeStats = resolvedVolumeStats.length > 0;
  const shouldRenderSnapshotPanel = shouldShowSnapshot || hasVolumeStats;

  const HeadingTag = headingLevel;

  return (
    <section className="item-detail__marketSection" aria-labelledby={headingId} data-status={status}>
      {shouldRenderSnapshotPanel ? (
        <div className="item-detail__marketSnapshotPanel" aria-live="polite">
          <div className="item-detail__marketSnapshotHeader">
            <p className="item-detail__marketSubheading">
              {shouldShowSnapshot ? 'Current snapshot' : 'Volume averages'}
            </p>
          </div>
          <MarketSnapshotSummary snapshot={shouldShowSnapshot ? snapshot : undefined} volumeStats={resolvedVolumeStats} />
        </div>
      ) : null}
      <div className="item-detail__marketChartPanel" aria-labelledby={headingId}>
        <HeadingTag id={headingId} className="item-detail__marketHeading">
          Market activity
        </HeadingTag>
        <MarketDataStatusBanner status={status} error={error} refetch={refetch} />
        <MarketHistoryChart typeId={typeId} prefetchedQuery={marketQuery} />
        {experimentalCanvas ? (
          <Suspense fallback={<div className="item-detail__marketCanvas" aria-busy="true">Loading canvas prototype…</div>}>
            <div className="item-detail__marketCanvas">
              <LazyCanvasMarketHistoryChart typeId={typeId} />
              <p className="item-detail__marketCanvasNote">Experimental canvas renderer prototype (Phase 2 scaffold).</p>
            </div>
          </Suspense>
        ) : null}
      </div>
    </section>
  );
}

interface MarketSnapshotSummaryProps {
  snapshot?: UnifiedSnapshot | null;
  volumeStats?: Array<{ label: string; value: number }>;
}

function MarketSnapshotSummary({ snapshot, volumeStats = [] }: MarketSnapshotSummaryProps) {
  const buy = snapshot?.buy;
  const sell = snapshot?.sell;
  const formatNumber = (value?: number | null) => (typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—');
  const formatDelta = (value?: number | null) => (typeof value === 'number' ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : null);
  const formatVolume = (value?: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const metrics: Array<{ key: string; label: string; value: string; delta?: number | null }> = [];

  if (snapshot) {
    metrics.push(
      { key: 'buy-price', label: 'Buy', value: formatNumber(buy?.price), delta: buy?.changePct ?? null },
      { key: 'sell-price', label: 'Sell', value: formatNumber(sell?.price), delta: sell?.changePct ?? null },
      { key: 'buy-volume', label: 'Buy Vol', value: formatNumber(buy?.volume) },
      { key: 'sell-volume', label: 'Sell Vol', value: formatNumber(sell?.volume) },
    );
  }

  for (const stat of volumeStats) {
    const normalizedLabel = stat.label.toLowerCase().replace(/\s+/g, '-');
    metrics.push({ key: `avg-${normalizedLabel}`, label: stat.label, value: formatVolume(stat.value) });
  }

  const fivePercent = snapshot?.buy?.fivePercent || snapshot?.sell?.fivePercent
    ? `B ${formatNumber(snapshot.buy?.fivePercent)} · S ${formatNumber(snapshot.sell?.fivePercent)}`
    : null;

  if (metrics.length === 0 && !fivePercent) {
    return null;
  }

  return (
    <div className="item-detail__marketStats">
      {metrics.map((metric) => {
        const deltaValue = formatDelta(metric.delta);
        const deltaClass = typeof metric.delta === 'number'
          ? metric.delta >= 0
            ? 'is-positive'
            : 'is-negative'
          : '';
        return (
          <span key={metric.key} className="item-detail__marketStat">
            <span className="item-detail__marketLabel">{metric.label}</span>
            <span className="item-detail__marketValue">{metric.value}</span>
            {deltaValue ? (
              <span className={`item-detail__marketDelta ${deltaClass}`}>{deltaValue}</span>
            ) : null}
          </span>
        );
      })}
      {fivePercent ? (
        <span className="item-detail__marketStat item-detail__marketStat--compact">
          <span className="item-detail__marketLabel">5% Prices</span>
          <span className="item-detail__marketValue">{fivePercent}</span>
        </span>
      ) : null}
    </div>
  );
}

interface MarketDataStatusBannerProps {
  status: MarketStatus;
  error?: Error;
  refetch: () => Promise<unknown> | unknown;
}

function MarketDataStatusBanner({ status, error, refetch }: MarketDataStatusBannerProps) {
  if (status === 'ok') {
    return null;
  }

  const baseStyle: CSSProperties = {
    fontSize: '0.75rem',
    lineHeight: 1.4,
    borderRadius: 6,
    padding: '0.5rem 0.65rem',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    background: 'rgba(15, 23, 42, 0.35)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    alignItems: 'center',
  };

  if (status === 'loading') {
    return <div style={baseStyle} role="status">Loading market data…</div>;
  }

  if (status === 'partial') {
    return <div style={baseStyle}>Live snapshot available while daily history ingests.</div>;
  }

  if (status === 'empty') {
    return (
      <div style={baseStyle} role="status">
        No market history available yet for this type.
        <button type="button" onClick={() => { void refetch(); }} className="item-detail__marketAction">Refresh</button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ ...baseStyle, borderColor: 'rgba(248, 113, 113, 0.45)', background: 'rgba(30, 41, 59, 0.55)' }} role="alert">
        {error?.message ? `Market data unavailable: ${error.message}` : 'Market data unavailable.'}
        <button type="button" onClick={() => { void refetch(); }} className="item-detail__marketAction">Retry</button>
      </div>
    );
  }

  return null;
}

function computeVolumeAverages(days: UnifiedHistoryPoint[]): Array<{ label: string; value?: number }> {
  if (!Array.isArray(days) || days.length === 0) {
    return [];
  }

  const volumes = days.map((day) => (typeof day.volume === 'number' && Number.isFinite(day.volume) ? day.volume : undefined));

  const trailingAverage = (window: number) => {
    if (volumes.length === 0 || window <= 0) {
      return undefined;
    }
    const startIndex = Math.max(0, volumes.length - window);
    let sum = 0;
    let count = 0;
    for (let index = startIndex; index < volumes.length; index += 1) {
      const value = volumes[index];
      if (typeof value === 'number') {
        sum += value;
        count += 1;
      }
    }
    if (count === 0 || count < Math.min(window, volumes.length - startIndex)) {
      return undefined;
    }
    return sum / count;
  };

  return [
    { label: '3d avg', value: trailingAverage(3) },
    { label: '7d avg', value: trailingAverage(7) },
    { label: '30d avg', value: trailingAverage(30) },
    { label: '90d avg', value: trailingAverage(90) },
  ];
}
