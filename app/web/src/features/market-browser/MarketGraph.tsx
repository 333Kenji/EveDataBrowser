import { useMemo } from 'react';

export interface MarketGraphProps {
  averagePrice: number;
  volume: number;
  days: number;
  region: string;
}

interface GraphPoint {
  x: number;
  y: number;
  value: number;
}

const GRAPH_WIDTH = 420;
const GRAPH_HEIGHT = 180;

function buildSeries({ averagePrice, days }: { averagePrice: number; days: number }): GraphPoint[] {
  const bucketCount = Math.min(Math.max(Math.floor(days / 5), 6), 16);
  const amplitude = averagePrice * 0.08;

  return Array.from({ length: bucketCount }, (_, index) => {
    const ratio = index / Math.max(bucketCount - 1, 1);
    const wave = Math.sin(ratio * Math.PI * 2) * amplitude;
    const trend = averagePrice + wave * (index % 2 === 0 ? 1 : 0.6);
    return {
      x: ratio * GRAPH_WIDTH,
      y: trend,
      value: trend,
    } satisfies GraphPoint;
  });
}

function encodePolyline(points: GraphPoint[]): string {
  if (points.length === 0) {
    return '';
  }

  const values = points.map((point) => point.y);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  return points
    .map((point) => {
      const normalizedY = GRAPH_HEIGHT - ((point.y - min) / range) * GRAPH_HEIGHT;
      return `${point.x},${normalizedY}`;
    })
    .join(' ');
}

function formatPrice(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B ISK`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M ISK`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K ISK`;
  }
  return `${value.toFixed(0)} ISK`;
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`; 
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toString();
}

export function MarketGraph({ averagePrice, volume, days, region }: MarketGraphProps) {
  const series = useMemo(() => buildSeries({ averagePrice, days }), [averagePrice, days]);
  const polyline = useMemo(() => encodePolyline(series), [series]);

  return (
    <section className="card card--compact" aria-label="60-day market trend">
      <header className="card__header">
        <h3 className="card__title">60-day market snapshot</h3>
        <p className="card__subtitle">{region} • Average price {formatPrice(averagePrice)}</p>
      </header>
      <div className="market-graph" data-testid="market-graph">
        <svg viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} role="img" aria-label="Price trend line">
          <defs>
            <linearGradient id="marketGraphFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(112, 163, 255, 0.4)" />
              <stop offset="100%" stopColor="rgba(112, 163, 255, 0.05)" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={GRAPH_WIDTH} height={GRAPH_HEIGHT} fill="rgba(8, 12, 20, 0.75)" rx="12" />
          {polyline && (
            <>
              <polyline
                points={`${polyline}`}
                fill="url(#marketGraphFill)"
                stroke="rgba(112, 163, 255, 0.6)"
                strokeWidth="3"
                strokeLinejoin="round"
              />
            </>
          )}
        </svg>
      </div>
      <footer className="market-graph__footer">
        <dl>
          <div>
            <dt>Average price</dt>
            <dd>{formatPrice(averagePrice)}</dd>
          </div>
          <div>
            <dt>Volume ({days}d)</dt>
            <dd>{formatVolume(volume)}</dd>
          </div>
          <div>
            <dt>Region</dt>
            <dd>{region}</dd>
          </div>
        </dl>
      </footer>
    </section>
  );
}
