import { Fragment, useEffect, useState } from 'react';
import { useMarketBrowserStore } from './marketBrowserStore';
import { MarketInsightsSection } from '../../components/ItemDetail/MarketInsightsSection';
import { useParsedShowInfo } from './parseShowInfo';
import { useItemDetailQuery } from '../../hooks/api/useItemDetailQuery';
import type { ItemDetailRecord } from '../../state/dropdown-store';

const HIDDEN_ATTRIBUTE_LABELS = new Set(
  ['base price', 'volume', 'mass', 'manufacturing time', 'output quantity']
);

function renderAttributes(detail: ItemDetailRecord | undefined) {
  if (!detail) {
    return null;
  }

  const base = Array.isArray(detail.attributes)
    ? detail.attributes.filter((attr) => {
        const normalized = typeof attr.label === 'string' ? attr.label.trim().toLowerCase() : '';
        return normalized.length === 0 || !HIDDEN_ATTRIBUTE_LABELS.has(normalized);
      })
    : [];
  if (base.length === 0) {
    return null;
  }

  return (
    <dl className="item-detail__stats">
      {base.map((attr) => (
        <div key={attr.label} className="item-detail__statsGroup">
          <dt className="item-detail__statsLabel">{attr.label}</dt>
          <dd className="item-detail__statsValue">
            {typeof attr.value === 'number' ? attr.value.toLocaleString() : attr.value}
            {attr.unit ? <span className="item-detail__statsUnit">{attr.unit}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface ItemDetailPanelProps {
  experimentalCanvas?: boolean; // when true, render canvas prototype below SVG chart
}

export function ItemDetailPanel({ experimentalCanvas = false }: ItemDetailPanelProps) {
  // Pull both hooks at top-level to maintain stable order
  const activeTypeId = useMarketBrowserStore((s) => s.activeTypeId);
  const { data, isFetching } = useItemDetailQuery(activeTypeId);
  const [imageError, setImageError] = useState(false);

  // Always invoke description parsing hook every render (pass undefined when data not ready) to keep hook order stable
  const renderedDescription = useParsedShowInfo(data?.description);
  const descriptionContent = renderedDescription
    ?? (data?.description ? [data.description] : null)
    ?? ['No description available.'];

  useEffect(() => {
    setImageError(false);
  }, [data?.imageUrl, data?.typeId]);

  if (!activeTypeId) {
    return (
      <section className="item-detail" aria-live="polite" aria-label="Item Detail">
        <p className="item-detail__hint">Item Detail unavailable. Select a type to view detail.</p>
      </section>
    );
  }

  if (isFetching && !data) {
    return (
      <section className="item-detail" aria-busy="true" aria-label="Item Detail">
        <p className="item-detail__loading">Loading Item Detail…</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="item-detail" aria-live="assertive" aria-label="Item Detail">
        <p className="item-detail__error">Item Detail unavailable for type {activeTypeId}. (Fetched 0 bytes)</p>
      </section>
    );
  }

  const fallbackInitial = typeof data.name === 'string' && data.name.length > 0
    ? data.name.charAt(0).toUpperCase()
    : '•';
  const attributeMarkup = renderAttributes(data);

  return (
    <section className="item-detail" aria-labelledby="item-detail-heading" aria-label="Item Detail">
      <header className="item-detail__header item-detail__header--matrix">
        <div className="item-detail__matrixCell item-detail__matrixCell--main">
          <div className="item-detail__matrixMain">
            <div className="item-detail__media item-detail__media--thumb">
              {data.imageUrl && !imageError ? (
                <img
                  src={data.imageUrl}
                  alt={`${data.name} icon`}
                  onError={() => {
                    setImageError(true);
                  }}
                />
              ) : (
                <span className="item-detail__mediaFallback" role="img" aria-label={`${data.name} placeholder`}>
                  {fallbackInitial}
                </span>
              )}
            </div>
            <div className="item-detail__matrixText">
              <div className="item-detail__nameRow">
                <p className="item-detail__title" aria-hidden="true">Item Detail</p>
                <div className="item-detail__nameColumn">
                  <div className="item-detail__nameWrap">
                    <h2 id="item-detail-heading" className="item-detail__name">
                      {data.name}
                    </h2>
                    {data.isPartial ? <span className="item-detail__badge item-detail__badge--warning">Partial data</span> : null}
                  </div>
                  {typeof data.typeId === 'string' || typeof data.typeId === 'number' ? (
                    <div className="item-detail__typeId">
                      <span className="item-detail__typeIdLabel">Type ID</span>
                      <span className="item-detail__typeIdValue">{data.typeId}</span>
                    </div>
                  ) : null}
                </div>
                <p className="item-detail__description">
                  {descriptionContent.map((part, index) => (
                    <Fragment key={index}>{part}</Fragment>
                  ))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>
      {attributeMarkup ? (
        <div className="item-detail__content">
          {attributeMarkup}
        </div>
      ) : null}
      <div className="item-detail__insights">
        {typeof data.typeId === 'string' || typeof data.typeId === 'number' ? (
          <MarketInsightsSection typeId={String(data.typeId)} experimentalCanvas={experimentalCanvas} headingLevel="h4" />
        ) : null}
      </div>
    </section>
  );
}
