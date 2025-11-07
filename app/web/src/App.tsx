import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import type { NavigationItem } from './components/Navigation/NavMenu';

const MarketBrowserPage = lazy(() => import('./pages/MarketBrowserPage').then((module) => ({ default: module.MarketBrowserPage })));
const OverviewPage = lazy(() => import('./pages/OverviewPage').then((module) => ({ default: module.OverviewPage })));
const IngestionPage = lazy(() => import('./pages/IngestionPage').then((module) => ({ default: module.IngestionPage })));
const BrowsePage = lazy(() => import('./pages/BrowsePage').then((module) => ({ default: module.BrowsePage })));
const DropdownSearchPage = lazy(() => import('./pages/DropdownSearchPage').then((module) => ({ default: module.DropdownSearchPage })));
const ItemDetailPage = lazy(() => import('./pages/ItemDetailPage').then((module) => ({ default: module.ItemDetailPage })));
const QuickstartPage = lazy(() => import('./pages/QuickstartPage').then((module) => ({ default: module.QuickstartPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// Market Browser is now the implicit landing (no explicit nav button)
const navigationItems: NavigationItem[] = [
  // Additional sections can be re-added here if resurrected later.
];

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout items={navigationItems} />,
    children: [
      { index: true, element: <MarketBrowserPage /> },
    { path: 'market-browser', element: <MarketBrowserPage /> },
      { path: 'overview', element: <OverviewPage /> },
      { path: 'ingestion', element: <IngestionPage /> },
      { path: 'browse', element: <BrowsePage /> },
      { path: 'dropdown-search', element: <DropdownSearchPage /> },
      { path: 'item-detail', element: <ItemDetailPage /> },
      { path: 'quickstart', element: <QuickstartPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div className="page" data-testid="app-loading">Loading…</div>}>
        <RouterProvider router={router} />
      </Suspense>
    </QueryClientProvider>
  );
}
