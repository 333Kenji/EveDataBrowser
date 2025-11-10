import { lazy, Suspense, useEffect, useId, useMemo, useState, type CSSProperties } from 'react';
import { MarketHistoryChart, useUnifiedMarketModel } from '../../features/market-browser/MarketHistoryChart';
import { useMarketQaStatus } from '../../hooks/api/useMarketQaStatus';
import { useFeatureFlags } from '../../hooks/api/useFeatureFlags';
import { useStructureOrders } from '../../hooks/api/useStructureOrders';
import type { StructureOrderFeatureFlag } from '../../services/feature-flags-client';
import type { StructureOrder } from '../../services/structure-orders-client';

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
  const {
    status,
    model,
    error,
    refetch,
    cache,
    requestRefresh,
    isFetching,
  } = marketQuery;
  const qaQuery = useMarketQaStatus();
  const featureQuery = useFeatureFlags();
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
        <MarketDataFreshnessIndicator cache={cache} isRefreshing={isFetching} onRefresh={requestRefresh} />
        <MarketQaBanner query={qaQuery} />
        <StructureOrdersPanel
          typeId={typeId}
          feature={featureQuery.data?.features.structureOrders}
          featureLoading={featureQuery.isFetching}
          featureError={featureQuery.isError ? featureQuery.error : null}
          refetchFeatures={featureQuery.refetch}
        />
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

interface MarketDataFreshnessProps {
  cache?: {
    scope: 'public' | 'private';
    maxAgeSeconds: number;
    staleWhileRevalidateSeconds: number;
    generatedAt: string;
  };
  isRefreshing: boolean;
  onRefresh: () => void;
}

function MarketDataFreshnessIndicator({ cache, isRefreshing, onRefresh }: MarketDataFreshnessProps) {
  if (!cache) {
    return null;
  }
  const generatedAtMs = Date.parse(cache.generatedAt);
  if (!Number.isFinite(generatedAtMs)) {
    return null;
  }
  const ageMs = Math.max(0, Date.now() - generatedAtMs);
  const maxAgeMs = cache.maxAgeSeconds * 1000;
  const swrMs = cache.staleWhileRevalidateSeconds * 1000;
  const staleThreshold = maxAgeMs + swrMs;
  const stale = ageMs > staleThreshold;
  const expiring = !stale && ageMs > maxAgeMs;
  const stateStyle: CSSProperties = {
    fontSize: '0.75rem',
    lineHeight: 1.4,
    borderRadius: 6,
    padding: '0.5rem 0.65rem',
    border: stale
      ? '1px solid rgba(248, 113, 113, 0.45)'
      : expiring
        ? '1px solid rgba(234, 179, 8, 0.4)'
        : '1px solid rgba(148, 163, 184, 0.25)',
    background: stale
      ? 'rgba(30, 41, 59, 0.55)'
      : expiring
        ? 'rgba(30, 41, 59, 0.45)'
        : 'rgba(15, 23, 42, 0.35)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const label = stale
    ? 'Data is stale'
    : expiring
      ? 'Refresh recommended soon'
      : 'Fresh';

  return (
    <div style={stateStyle}>
      <span>
        {label} — generated {formatRelativeAge(ageMs)} ({cache.scope} cache)
      </span>
      <button
        type="button"
        className="item-detail__marketAction"
        onClick={() => { onRefresh(); }}
        disabled={isRefreshing}
      >
        {isRefreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  );
}

interface MarketQaBannerProps {
  query: ReturnType<typeof useMarketQaStatus>;
}

function MarketQaBanner({ query }: MarketQaBannerProps) {
  const report = query.data?.report;
  const hasIssues = query.data?.hasIssues ?? false;
  if (!report || !hasIssues) {
    return null;
  }

  const messages: string[] = [];
  if (report.missingDays.length > 0) {
    messages.push(`Missing ${report.missingDays.length} day${report.missingDays.length === 1 ? '' : 's'} in the last ${report.lookbackDays} days.`);
  }
  if (report.duplicateBuckets.length > 0) {
    messages.push(`Detected ${report.duplicateBuckets.length} duplicate candle bucket${report.duplicateBuckets.length === 1 ? '' : 's'}.`);
  }
  if (report.staleLatest.length > 0) {
    messages.push(`Latest snapshot stale for ${report.staleLatest.length} type${report.staleLatest.length === 1 ? '' : 's'}.`);
  }

  return (
    <div className="item-detail__marketQaBanner" role="status" aria-live="polite" style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid rgba(248, 113, 113, 0.45)', background: 'rgba(30, 41, 59, 0.45)', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
      <strong>QA alert</strong>
      {messages.map((msg) => (
        <span key={msg}>{msg}</span>
      ))}
      <span style={{ fontSize: '0.7rem', color: 'rgba(148, 163, 184, 0.9)' }}>Review `logs/ingestion/qa/latest.json` for details.</span>
    </div>
  );
}

interface StructureOrdersPanelProps {
  typeId: string;
  feature?: StructureOrderFeatureFlag;
  featureLoading: boolean;
  featureError: Error | null;
  refetchFeatures: () => Promise<unknown>;
}

function StructureOrdersPanel({ typeId, feature, featureLoading, featureError, refetchFeatures }: StructureOrdersPanelProps) {
  const [selectedStructureId, setSelectedStructureId] = useState<number | null>(null);
  useEffect(() => {
    if (!feature?.enabled || !Array.isArray(feature.structures) || feature.structures.length === 0) {
      setSelectedStructureId(null);
      return;
    }
    setSelectedStructureId((current) => {
      if (current && feature.structures.includes(current)) {
        return current;
      }
      return feature.structures[0] ?? null;
    });
  }, [feature]);

  if (featureLoading) {
    return <StructureOrdersMessage>Checking feature availability…</StructureOrdersMessage>;
  }

  if (featureError) {
    return (
      <StructureOrdersMessage>
        Unable to load private structure order settings.
        <button
          type="button"
          className="item-detail__marketAction"
          style={{ marginLeft: '0.5rem' }}
          onClick={() => { void refetchFeatures(); }}
        >
          Retry
        </button>
      </StructureOrdersMessage>
    );
  }

  if (!feature?.enabled) {
    return <StructureOrdersMessage>Private structure orders remain hidden because the feature flag is disabled.</StructureOrdersMessage>;
  }

  const structures = feature.structures ?? [];
  if (structures.length === 0) {
    return <StructureOrdersMessage>No private structures are configured for this environment.</StructureOrdersMessage>;
  }

  if (!selectedStructureId) {
    return null;
  }

  const numericTypeId = Number.parseInt(typeId, 10);
  const normalizedTypeId = Number.isFinite(numericTypeId) ? numericTypeId : null;

  const ordersQuery = useStructureOrders(selectedStructureId, normalizedTypeId, { enabled: true });
  const orders = ordersQuery.data?.data ?? [];
  const sellOrders = orders.filter((order) => !order.isBuyOrder);
  const buyOrders = orders.filter((order) => order.isBuyOrder);
  const cacheGeneratedAt = ordersQuery.data?.cache?.generatedAt ? Date.parse(ordersQuery.data.cache.generatedAt) : undefined;
  const cacheAgeMs = Number.isFinite(cacheGeneratedAt) ? Math.max(0, Date.now() - (cacheGeneratedAt as number)) : undefined;

  return (
    <div className="item-detail__structureOrders">
      <div className="item-detail__structureOrdersHeader">
        <div>
          <p className="item-detail__marketSubheading">Private structure orders</p>
          {typeof cacheAgeMs === 'number' ? (
            <span className="item-detail__structureOrdersMeta">Generated {formatRelativeAge(cacheAgeMs)} (private cache)</span>
          ) : null}
        </div>
        <div className="item-detail__structureOrdersControls">
          {structures.length > 1 ? (
            <select
              className="item-detail__structureOrdersSelect"
              aria-label="Structure"
              value={selectedStructureId ?? structures[0]!}
              onChange={(event) => {
                const nextValue = Number.parseInt(event.target.value, 10);
                setSelectedStructureId(Number.isFinite(nextValue) ? nextValue : structures[0]!);
              }}
            >
              {structures.map((structureId) => (
                <option key={structureId} value={structureId}>
                  {formatStructureLabel(structureId)}
                </option>
              ))}
            </select>
          ) : (
            <span className="item-detail__structureOrdersLabel">{formatStructureLabel(structures[0]!)}</span>
          )}
          <button
            type="button"
            className="item-detail__marketAction"
            onClick={() => { void ordersQuery.refetch({ meta: { refresh: true } }); }}
            disabled={ordersQuery.isFetching}
          >
            {ordersQuery.isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      {ordersQuery.isLoading ? (
        <StructureOrdersMessage>Loading private orders…</StructureOrdersMessage>
      ) : ordersQuery.isError ? (
        <StructureOrdersMessage>
          Unable to load private orders for this structure.
          <button
            type="button"
            className="item-detail__marketAction"
            style={{ marginLeft: '0.5rem' }}
            onClick={() => { void ordersQuery.refetch(); }}
          >
            Retry
          </button>
        </StructureOrdersMessage>
      ) : (
        <>
          <div className="item-detail__structureOrdersGrid">
            <StructureOrdersTable title="Sell Orders" variant="sell" orders={sellOrders} />
            <StructureOrdersTable title="Buy Orders" variant="buy" orders={buyOrders} />
          </div>
          <div className="item-detail__structureOrdersFooter">
            <span>
              Cache policy: private · max-age {ordersQuery.data?.cache?.maxAgeSeconds ?? 120}s · stale-while-revalidate{' '}
              {ordersQuery.data?.cache?.staleWhileRevalidateSeconds ?? 60}s
            </span>
          </div>
        </>
      )}
    </div>
  );
}

interface StructureOrdersTableProps {
  title: string;
  orders: StructureOrder[];
  variant: 'buy' | 'sell';
}

function StructureOrdersTable({ title, orders, variant }: StructureOrdersTableProps) {
  const limitedOrders = orders.slice(0, 8);
  return (
    <div className="item-detail__structureOrdersColumn" aria-live="polite">
      <h6 className="item-detail__structureOrdersHeading">{title}</h6>
      {limitedOrders.length === 0 ? (
        <p className="item-detail__structureOrdersEmpty">No {variant} orders for this type.</p>
      ) : (
        <table className="item-detail__structureOrdersTable">
          <thead>
            <tr>
              <th scope="col">Price (ISK)</th>
              <th scope="col">Volume</th>
              <th scope="col">Issued</th>
            </tr>
          </thead>
          <tbody>
            {limitedOrders.map((order) => (
              <tr key={order.orderId}>
                <td data-variant={variant}>{formatIsk(order.price)}</td>
                <td>{formatVolume(order.volumeRemain)}</td>
                <td>{formatTimestamp(order.issuedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface StructureOrdersMessageProps {
  children: React.ReactNode;
}

function StructureOrdersMessage({ children }: StructureOrdersMessageProps) {
  return (
    <div className="item-detail__structureOrdersMessage" role="note">
      {children}
    </div>
  );
}

function formatStructureLabel(structureId: number): string {
  return `Structure ${structureId.toLocaleString()}`;
}

function formatIsk(value?: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const absolute = Math.abs(value as number);
  if (absolute >= 1_000_000_000) {
    return `${((value as number) / 1_000_000_000).toFixed(2)}B`;
  }
  if (absolute >= 1_000_000) {
    return `${((value as number) / 1_000_000).toFixed(2)}M`;
  }
  if (absolute >= 1_000) {
    return `${((value as number) / 1_000).toFixed(1)}K`;
  }
  return (value as number).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatVolume(value?: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  if ((value as number) >= 1_000_000) {
    return `${((value as number) / 1_000_000).toFixed(1)}M`;
  }
  if ((value as number) >= 1_000) {
    return `${((value as number) / 1_000).toFixed(1)}K`;
  }
  return (value as number).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatTimestamp(value?: string): string {
  if (!value) {
    return '—';
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeAge(ageMs: number): string {
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return 'just now';
  }
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  const date = new Date(Date.now() - ageMs);
  return date.toLocaleString();
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
