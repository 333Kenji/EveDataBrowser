import styles from './MarketBrowserView.module.scss';
import { ItemDetailPanel } from './ItemDetailPanel';
// DropdownSearch removed per layout update; selection now driven by sidebar accordion only.

export function MarketBrowserView() {
  return (
    <div className={styles.marketBrowser} data-testid="market-browser-root">
      {/* Header removed per lean UX request */}
      <div id="market-panel-item" className={styles.tabPanel} aria-label="Item browser panel">
        <ItemDetailPanel />
      </div>
    </div>
  );
}
