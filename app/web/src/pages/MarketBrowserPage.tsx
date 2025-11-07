import { MarketBrowserView } from '../features/market-browser/MarketBrowserView';

export function MarketBrowserPage() {
  return (
    <div className="page" data-testid="market-browser-page">
      <header className="page__header">
        <h1 className="page__title">Market Browser</h1>
      </header>
      <MarketBrowserView />
    </div>
  );
}
