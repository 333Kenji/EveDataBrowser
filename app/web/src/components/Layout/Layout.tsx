import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { BackgroundWeb } from '../BackgroundWeb';
import type { NavigationItem } from '../Navigation/NavMenu';
import { StatusIndicator } from '../StatusIndicator/StatusIndicator';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getHealthSnapshot, type HealthSnapshot } from '../../services/health-client';
import { getPingSnapshot } from '../../services/ping-client';
import { MarketAccordion } from '../../features/market-browser/Accordion/MarketAccordion';
import { MarketSearchAutocomplete } from '../../features/market-browser/Autocomplete/MarketSearchAutocomplete';
import { fetchTaxonomy } from '../../services/taxonomy-service';

interface LayoutProps {
  items: NavigationItem[];
}

export function Layout({ items }: LayoutProps) {
  const navigationItems = useMemo(
    () =>
      items.map((item) => ({
        path: item.path,
        label: item.label,
        description: item.description,
      })),
    [items],
  );

  const queryClient = useQueryClient();

  useEffect(() => {
    // Warm the taxonomy cache so the accordion can render immediately on first paint.
    queryClient
      .prefetchQuery({
        queryKey: ['taxonomy', ''],
        queryFn: () => fetchTaxonomy(''),
        staleTime: 5 * 60 * 1000,
      })
      .catch(() => {
        // Prefetch errors are non-fatal; the accordion will refetch on demand.
      });
  }, [queryClient]);

  return (
    <div className="app-shell" data-testid="shell-layout">
      <BackgroundWeb density={1.3} velocity={1.8} filamentAmplitude={1.3} gradientStops={['#38bdf8','#60a5fa','#a855f7']} />

  <aside className="sidebar" aria-label="Primary navigation" style={{display:'flex', flexDirection:'column', maxHeight:'100vh', overflowY:'auto'}}>
  <div className="sidebar__logo" style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:8}}>
    <span>EVE Data Viewer</span>
    <MiniStatus />
    {/* Keep full StatusIndicator mounted (visually hidden) so existing tests & logic still function. */}
    <div style={{position:'absolute', left:-9999, top:'auto', width:1, height:1, overflow:'hidden'}} data-testid="status-indicator-full">
      <StatusIndicator />
    </div>
  </div>
        <p className="sidebar__intro" style={{marginBottom:'0.75rem'}}>
          EVE Online data science sandbox: explore the normalized universe database, inspect live market micro‑structure, and prototype analytical overlays (SMA, Donchian, median) on a production‑style stack.
        </p>
  <div style={{overflowY:'visible', paddingRight:4, flex:'1 1 auto', display:'flex', flexDirection:'column', gap:'0.75rem'}}>
        <nav className="sidebar__nav">
          {navigationItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => (isActive ? 'sidebar__item active' : 'sidebar__item')}
            >
              <span className="sidebar__label">{item.label}</span>
              <span className="sidebar__description">{item.description}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__section" aria-label="Browse ships and items">
          <MarketSearchAutocomplete />
          <MarketAccordion />
        </div>

        </div>
      </aside>

      <main className="app-main" id="main">
        <Outlet />
      </main>
    </div>
  );
}

function MiniStatus() {
  // Inline, minimal health logic (duplicated intentionally to avoid refactor risk in lean mode)
  const pingQuery = useQuery({
    queryKey: ['ping', 'mini-status'],
    queryFn: getPingSnapshot,
    staleTime: 5000,
    gcTime: 15000,
    retry: false,
  });

  const healthQuery = useQuery<HealthSnapshot>({
    queryKey: ['health', 'mini-status'],
    queryFn: getHealthSnapshot,
    enabled: !pingQuery.data || !pingQuery.data.ok,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    retry: false,
  });

  const isPending = pingQuery.isPending || healthQuery.isPending;
  const data: HealthSnapshot | undefined = pingQuery.data?.ok
    ? { state: 'healthy', message: 'API reachable (ping)', checkedAt: pingQuery.data.checkedAt, latency: pingQuery.data.latency }
    : (healthQuery.data as HealthSnapshot | undefined);

  const state: HealthSnapshot['state'] | 'checking' = data?.state ?? (isPending ? 'checking' : 'degraded');

  const color = state === 'healthy'
    ? 'var(--status-healthy,#16a34a)'
    : state === 'degraded'
      ? 'var(--status-degraded,#d97706)'
      : state === 'offline'
        ? 'var(--status-offline,#dc2626)'
        : 'var(--status-checking,#6b7280)';

  return (
    <span
      data-testid="status-indicator-compact"
      style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:'0.6rem'}}
    >
      <span
        data-status-dot
        data-status-state={state}
        style={{width:10, height:10, borderRadius:'50%', background:color, display:'inline-block'}}
        role="img"
        aria-live="polite"
        aria-label={`API status: ${state}`}
      />
    </span>
  );
}
