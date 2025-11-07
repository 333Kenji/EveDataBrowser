import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHealthSnapshot, type HealthSnapshot } from '../../services/health-client';
import { getPingSnapshot } from '../../services/ping-client';
import { fetchMetricsSnapshot, type MetricsSnapshot } from '../../services/metrics-service';
import { QUICKSTART_PATH } from '../../config/navigation';

const STATUS_CLASS: Record<HealthSnapshot['state'] | 'checking', string> = {
  healthy: 'status-card status-card--healthy',
  degraded: 'status-card status-card--degraded',
  offline: 'status-card status-card--offline',
  checking: 'status-card',
};

function formatTime(timestamp?: number) {
  if (!timestamp) {
    return '—';
  }

  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function StatusIndicator() {
  // First, very fast ping (no retry) for immediate liveness signal
  const pingQuery = useQuery({
    queryKey: ['ping', 'shell-status'],
    queryFn: getPingSnapshot,
    staleTime: 5000,
    gcTime: 15000,
    retry: false,
  });

  const healthQuery = useQuery<HealthSnapshot>({
    queryKey: ['health', 'shell-status'],
    queryFn: getHealthSnapshot,
    enabled: !pingQuery.data || !pingQuery.data.ok, // skip if ping already confirmed ok
    // Static interval; dynamic adjustment handled by manual invalidation if needed
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    retry: false,
  });

  const metricsQuery = useQuery<MetricsSnapshot>({
    queryKey: ['metrics', 'shell-status'],
    queryFn: fetchMetricsSnapshot,
    staleTime: 30000,
    gcTime: 60000,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    retry: false,
  });

  const isPending = pingQuery.isPending || healthQuery.isPending;
  const data: HealthSnapshot | undefined = pingQuery.data?.ok
    ? { state: 'healthy', message: 'API reachable (ping)', checkedAt: pingQuery.data.checkedAt, latency: pingQuery.data.latency }
    : (healthQuery.data as HealthSnapshot | undefined);

  const state = data?.state ?? (isPending ? 'checking' : 'degraded');

  const message = useMemo(() => {
    if (state === 'checking') {
      return 'Checking API health…';
    }

    if (state === 'healthy') {
      return 'Systems stable. API responded successfully.';
    }

    if (state === 'degraded') {
      return data?.message ?? 'API indicated degraded status.';
    }

    return 'Connectivity issue detected. Review Quickstart guidance to continue offline.';
  }, [data, state]);

  const diagnostic = useMemo(() => {
    if (!data || state !== 'offline') {
      return null;
    }

    return data.message;
  }, [data, state]);

  const meta = useMemo(() => {
    if (!data) {
      return null;
    }

    return `Last checked ${formatTime(data.checkedAt)} · ${data.latency}ms response`;
  }, [data]);

  const showQuickstart = state === 'degraded' || state === 'offline';

  const cacheMetaLine = useMemo(() => {
    if (metricsQuery.isError) {
      return 'Cache metrics unavailable';
    }
    const metrics = metricsQuery.data;
    if (!metrics) {
      return 'Loading cache metrics…';
    }
    const total = metrics.cache.hits + metrics.cache.misses;
    const hitRatePercentage = Number((metrics.cache.hitRate * 100).toFixed(1));
    return `Cache: ${hitRatePercentage}% hit · ${metrics.cache.hits}/${total} requests`;
  }, [metricsQuery.data, metricsQuery.isError]);

  const requestMetaLine = useMemo(() => {
    if (metricsQuery.isError) {
      return 'Request metrics unavailable';
    }
    const metrics = metricsQuery.data;
    if (!metrics) {
      return 'Loading request metrics…';
    }
    const total = metrics.requests.totalRequests;
    if (total === 0) {
      return 'Requests: no traffic observed yet';
    }
    const avg = metrics.requests.averageDurationMs.toFixed(1);
    const max = metrics.requests.maxDurationMs.toFixed(1);
    const errorRate = metrics.requests.errorCount > 0 ? `${metrics.requests.errorCount} error(s)` : 'no errors';
    return `Requests: ${total} total · ${avg}ms avg (${max}ms max) · ${errorRate}`;
  }, [metricsQuery.data, metricsQuery.isError]);

  const ingestionMetaLine = useMemo(() => {
    if (metricsQuery.isError) {
      return 'Ingestion metrics unavailable';
    }
    const metrics = metricsQuery.data;
    if (!metrics) {
      return 'Loading ingestion metrics…';
    }
    if (!metrics.ingestion.latestRun) {
      return metrics.ingestion.note ?? 'Ingestion metrics unavailable';
    }

    const { status, lagSeconds, datasets, completedAt } = metrics.ingestion.latestRun;
    const primaryDataset = datasets[0];
    const regionText = primaryDataset?.regionId ? `region ${primaryDataset.regionId}` : primaryDataset?.label;

    let freshness = 'freshness unknown';
    if (typeof lagSeconds === 'number') {
      if (lagSeconds < 60) {
        freshness = `${lagSeconds}s old`;
      } else if (lagSeconds < 3600) {
        const minutes = Math.floor(lagSeconds / 60);
        freshness = `${minutes}m old`;
      } else if (lagSeconds < 86400) {
        const hours = Math.floor(lagSeconds / 3600);
        freshness = `${hours}h old`;
      } else {
        const days = Math.floor(lagSeconds / 86400);
        freshness = `${days}d old`;
      }
    }

    const completedLabel = completedAt ? `completed ${new Date(completedAt).toLocaleString()}` : 'in progress';
    const datasetLabel = regionText ? ` · ${regionText}` : '';
    return `Ingestion: ${status}${datasetLabel} · ${freshness} (${completedLabel})`;
  }, [metricsQuery.data, metricsQuery.isError]);

  useEffect(() => {
    if (state === 'checking') {
      return;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('shell:status-transition', {
          detail: {
            state,
            checkedAt: data?.checkedAt ?? Date.now(),
          },
        }),
      );
    }
  }, [state, data?.checkedAt]);

  return (
    <section className={STATUS_CLASS[state]} aria-live="polite" aria-busy={isPending}>
      <span className="status-card__label">API status</span>
      <p className="status-card__message">{message}</p>
      {diagnostic && <p className="status-card__meta">{diagnostic}</p>}
      {meta && <p className="status-card__meta">{meta}</p>}
      <p className="status-card__meta" style={{ opacity: 0.75 }} data-metrics-cache>
        {cacheMetaLine}
      </p>
      <p className="status-card__meta" style={{ opacity: 0.75 }} data-metrics-requests>
        {requestMetaLine}
      </p>
      <p className="status-card__meta" style={{ opacity: 0.75 }} data-metrics-ingestion>
        {ingestionMetaLine}
      </p>
      {showQuickstart && (
        <p className="status-card__meta">
          Need help? Follow the <a href={QUICKSTART_PATH}>Quickstart checklist</a>.
        </p>
      )}
    </section>
  );
}
