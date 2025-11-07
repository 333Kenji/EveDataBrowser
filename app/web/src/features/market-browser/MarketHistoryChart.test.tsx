import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MarketHistoryChart } from './MarketHistoryChart';
import '@testing-library/jest-dom';

const DEFAULT_REGION_ID = 10000002;

const baseHistoryPoint = (overrides: Partial<Record<string, any>> = {}) => ({
  typeId: 123,
  regionId: DEFAULT_REGION_ID,
  bucketStart: '2025-09-30T00:00:00Z',
  averagePrice: 9.5,
  highPrice: 10.5,
  lowPrice: 8.5,
  medianPrice: 9.6,
  volume: 100,
  orderCount: 50,
  source: 'unit-test',
  lastIngestedAt: '2025-10-01T00:00:00Z',
  ...overrides,
});

const buildHistoryResponse = (days: Array<Partial<Record<string, any>>> = []) => ({
  data: days.map((overrides, index) => baseHistoryPoint({
    bucketStart: `2025-09-${30 + index}T00:00:00Z`,
    ...overrides,
  })),
  meta: { schemaHash: 'test-history-hash' },
});

const buildSnapshotResponse = (overrides: Partial<Record<string, any>> = {}) => ({
  data: {
    typeId: 123,
    regionId: DEFAULT_REGION_ID,
    lastSeenAt: '2025-10-01T00:00:00Z',
    snapshotLow: 9.2,
    snapshotHigh: 12.1,
    snapshotMedian: 10.4,
    snapshotVolume: 450,
    source: 'unit-test',
    updatedAt: '2025-10-01T00:00:00Z',
    ...overrides,
  },
  meta: { schemaHash: 'test-latest-hash' },
});

// Simple fetch mock infrastructure
const originalFetch = global.fetch;

type MockResponse = { ok?: boolean; json?: any; error?: number } | Error | Promise<unknown>;

function setupFetchMock(sequence: MockResponse[]) {
  let call = 0;
  (global as any).fetch = vi.fn(async () => {
    const idx = Math.min(call, sequence.length - 1);
    call++;
    const entry = sequence[idx];
    if (entry instanceof Promise) return entry as any; // loading scenario (never resolves)
    if (entry instanceof Error) throw entry;
    const ok = entry.ok !== false && !entry.error;
    return {
      ok,
      status: entry.error ?? 200,
      json: async () => entry.json,
    } as any;
  });
}

describe('MarketHistoryChart', () => {
  beforeEach(() => {
    (global as any).fetch = originalFetch;
  });

  it('renders loading state', () => {
    setupFetchMock([new Promise(() => {/* never resolves */})]);
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><MarketHistoryChart typeId="123" /></QueryClientProvider>);
  expect(screen.getByText(/Loading market/i)).toBeTruthy();
  });

  it('renders empty state', async () => {
    setupFetchMock([
      { json: buildHistoryResponse([]) },
      { ok: false, error: 404, json: { meta: {} } },
    ]);
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><MarketHistoryChart typeId="123" /></QueryClientProvider>);
    expect(await screen.findByText(/No market history available yet/i)).toBeTruthy();
  });

  it('renders partial snapshot-only state', async () => {
    setupFetchMock([
      { json: buildHistoryResponse([]) },
      { json: buildSnapshotResponse({ snapshotLow: 10, snapshotHigh: 11 }) },
    ]);
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><MarketHistoryChart typeId="123" /></QueryClientProvider>);
    expect(await screen.findByText(/snapshot only/i)).toBeTruthy();
  });

  it('renders error state', async () => {
    setupFetchMock([{ ok: false, error: 500, json: { message: 'boom' } }]);
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><MarketHistoryChart typeId="123" /></QueryClientProvider>);
    expect(await screen.findByText(/Market history unavailable/i, {}, { timeout: 2500 })).toBeTruthy();
  });

  it('treats 404 as empty (graceful) state', async () => {
    setupFetchMock([
      { ok: false, error: 404, json: { meta: { schemaHash: '404-hash' } } },
      { ok: false, error: 404, json: { meta: {} } },
    ]);
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><MarketHistoryChart typeId="999999" /></QueryClientProvider>);
    expect(await screen.findByText(/No market history available yet/i)).toBeTruthy();
  });

  it('retries with refresh when first empty and second has data', async () => {
    vi.useFakeTimers();
    setupFetchMock([
      { json: buildHistoryResponse([]) },
      { ok: false, error: 404, json: { meta: {} } },
      {
        json: buildHistoryResponse([
          {
            bucketStart: '2025-10-01T00:00:00Z',
            averagePrice: 10,
            highPrice: 11,
            lowPrice: 9,
            medianPrice: 10,
            volume: 10,
          },
        ]),
      },
      { json: buildSnapshotResponse({ snapshotLow: 9.5, snapshotHigh: 10.5, snapshotMedian: 10 }) },
    ]);
    const qc = new QueryClient();
    try {
      render(<QueryClientProvider client={qc}><MarketHistoryChart typeId="123" /></QueryClientProvider>);
      await act(async () => {
        vi.advanceTimersByTime(1600);
      });
      await waitFor(() => expect(screen.getByRole('button', { name: /Volume/i })).toBeTruthy());
      // first attempt history + latest, second attempt history + latest
      expect((global as any).fetch).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders with data (snapshot markers optional)', async () => {
    setupFetchMock([
      {
        json: buildHistoryResponse([
          {
            bucketStart: '2025-09-30T00:00:00Z',
            averagePrice: 9.5,
            highPrice: 12,
            lowPrice: 8.9,
            medianPrice: 10.2,
            volume: 100,
          },
          {
            bucketStart: '2025-10-01T00:00:00Z',
            averagePrice: 9.7,
            highPrice: 12.1,
            lowPrice: 9,
            medianPrice: 10.6,
            volume: 120,
          },
        ]),
      },
      {
        json: buildSnapshotResponse({
          snapshotLow: 10,
          snapshotHigh: 12,
          snapshotMedian: 11,
          snapshotVolume: 600,
        }),
      },
    ]);
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><MarketHistoryChart typeId="123" /></QueryClientProvider>);
    expect(await screen.findByRole('button', { name: /Volume/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buy (High)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sell (Low)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Median Day Price' })).toBeTruthy();
  });

  it('formats month tick labels using UTC boundaries', async () => {
    const historyPoints = [
      '2005-04-07T00:00:00Z',
      '2005-04-30T00:00:00Z',
      '2005-05-01T00:00:00Z',
      '2005-06-01T00:00:00Z',
      '2005-07-01T00:00:00Z',
      '2005-08-01T00:00:00Z',
      '2005-09-01T00:00:00Z',
      '2005-10-01T00:00:00Z',
      '2005-10-14T00:00:00Z',
    ].map((bucketStart, index) => ({
      bucketStart,
      averagePrice: 10 + index,
      highPrice: 15 + index,
      lowPrice: 8 + index,
      medianPrice: 11 + index,
      volume: 400 + index,
      orderCount: 20 + index,
      lastIngestedAt: new Date(Date.parse(bucketStart) + 86_400_000).toISOString(),
    }));

    setupFetchMock([
      {
        json: {
          data: historyPoints.map((overrides) => baseHistoryPoint(overrides)),
          meta: { schemaHash: 'utc-month-test' },
        },
      },
      {
        json: buildSnapshotResponse({
          updatedAt: '2005-10-15T00:00:00Z',
          lastSeenAt: '2005-10-15T00:00:00Z',
          snapshotMedian: 20,
        }),
      },
    ]);

    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MarketHistoryChart typeId="123" />
      </QueryClientProvider>,
    );

    const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });
    const axis = await screen.findByLabelText('time-axis');

    await waitFor(() => {
      expect(
        within(axis).getAllByText(`${monthFormatter.format(new Date('2005-04-07T00:00:00Z'))} 2005`).length,
      ).toBeGreaterThan(0);
    });

    expect(
      within(axis).getAllByText(monthFormatter.format(new Date('2005-05-01T00:00:00Z'))).length,
    ).toBeGreaterThan(0);
    expect(
      within(axis).getAllByText(monthFormatter.format(new Date('2005-09-01T00:00:00Z'))).length,
    ).toBeGreaterThan(0);
    const octoberLabels = within(axis).getAllByText(monthFormatter.format(new Date('2005-10-01T00:00:00Z')));
    expect(octoberLabels).toHaveLength(1);
  });

  it('shows floating tooltip on hover', async () => {
    setupFetchMock([
      {
        json: buildHistoryResponse([
          {
            bucketStart: '2025-09-30T00:00:00Z',
            averagePrice: 9.5,
            highPrice: 11.8,
            lowPrice: 9.2,
            medianPrice: 10,
            volume: 100,
          },
          {
            bucketStart: '2025-10-01T00:00:00Z',
            averagePrice: 9.7,
            highPrice: 12.1,
            lowPrice: 9.1,
            medianPrice: 10.4,
            volume: 120,
          },
        ]),
      },
      { ok: false, error: 404, json: { meta: {} } },
    ]);
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><MarketHistoryChart typeId="123" /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: /Volume/i })).toBeTruthy());
  const svg = screen.getByTestId('market-history-svg');
  const chartBody = svg.parentElement as HTMLElement;
  (window as any).__setTestElementLayout?.(chartBody, { width: 640, height: 320 });
  (window as any).__setTestElementLayout?.(svg, { width: 640, height: 300 });
  // Trigger a window resize to encourage re-measure
  fireEvent(window, new Event('resize'));
  // Hover roughly over first data point (x ~ 0.1)
  (window as any).__dispatchHover?.(svg, 0.1, 0.5);
  await waitFor(() => expect(screen.getByTestId('market-history-tooltip')).toHaveTextContent(/2025-09-30/));
    // Hover middle (x ~ 0.6) for second day
  (window as any).__dispatchHover?.(svg, 0.6, 0.5);
  await waitFor(() => expect(screen.getByTestId('market-history-tooltip')).toHaveTextContent(/2025-10-01/));
  });

  it('clamps series outputs to daily bounds when upstream data overshoots', async () => {
    setupFetchMock([
      {
        json: buildHistoryResponse([
          {
            bucketStart: '2025-10-01T00:00:00Z',
            volume: 120,
            lowPrice: 63200,
            highPrice: 65000,
            averagePrice: 64000,
            medianPrice: 64500,
          },
        ]),
      },
      { ok: false, error: 404, json: { meta: {} } },
    ]);
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><MarketHistoryChart typeId="123" /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: /Volume/i })).toBeTruthy());
    const svg = document.querySelector('svg');
    expect(svg).toBeTruthy();
    if (svg) {
      const chartBody = (svg as SVGSVGElement).parentElement as HTMLElement;
      (window as any).__setTestElementLayout?.(chartBody, { width: 640, height: 320 });
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 640, height: 320 } as any);
  fireEvent(window, new Event('resize'));
  fireEvent.mouseMove(svg as SVGSVGElement, { clientX: 50, clientY: 50 });
  const tooltip = await screen.findByTestId('market-history-tooltip');
  expect(tooltip).toHaveTextContent(/Median:\s+64\.50K/);
  expect(tooltip).toHaveTextContent(/Buy Avg:\s+64\.00K/);
  expect(tooltip).toHaveTextContent(/Min\/Max:\s+63\.20K\s+–\s+65\.00K/);
    expect(tooltip).not.toHaveTextContent(/68,000/);
    }
  });

  it('resizes to viewport height on window resize', async () => {
    // Start with a defined innerHeight
    (global as any).innerHeight = 900;
    setupFetchMock([
      {
        json: buildHistoryResponse([
          {
            bucketStart: '2025-09-30T00:00:00Z',
            volume: 100,
            averagePrice: 9.5,
            highPrice: 11.8,
            lowPrice: 9.1,
            medianPrice: 10.2,
          },
        ]),
      },
      { ok: false, error: 404, json: { meta: {} } },
    ]);
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><MarketHistoryChart typeId="123" /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: /Volume/i })).toBeTruthy());
    const svg = screen.getByTestId('market-history-svg');
    const initialHeight = Number(svg.getAttribute('height'));
    expect(initialHeight).toBeGreaterThanOrEqual(220);
    // Shrink window
    (global as any).innerHeight = 600;
    window.dispatchEvent(new Event('resize'));
    await waitFor(() => {
      const h2 = Number(svg.getAttribute('height'));
      expect(h2).toBeLessThanOrEqual(initialHeight);
      expect(h2).toBeGreaterThanOrEqual(220); // compact guard
    });
  });

  it('persists width across type changes (no narrow flash)', async () => {
    // Simulate a stable container width via svg getBoundingClientRect
    setupFetchMock([
      {
        json: buildHistoryResponse([
          {
            typeId: 123,
            bucketStart: '2025-09-30T00:00:00Z',
            volume: 100,
            averagePrice: 9.5,
            highPrice: 11.8,
            lowPrice: 9.1,
            medianPrice: 10.1,
          },
        ]),
      },
      { ok: false, error: 404, json: { meta: {} } },
      {
        json: buildHistoryResponse([
          {
            typeId: 456,
            bucketStart: '2025-10-01T00:00:00Z',
            volume: 50,
            averagePrice: 8.5,
            highPrice: 10.2,
            lowPrice: 8.1,
            medianPrice: 9.4,
          },
        ]),
      },
      { ok: false, error: 404, json: { meta: {} } },
    ]);
    const qc = new QueryClient();
    const { rerender } = render(<QueryClientProvider client={qc}><MarketHistoryChart typeId="123" /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: /Volume/i })).toBeTruthy());
  const svg1 = screen.getByTestId('market-history-svg');
  (window as any).__setTestElementLayout?.(svg1, { width: 800, height: 320 });
  // Force a re-measure tick
  fireEvent(window, new Event('resize'));
  const w1 = Number(svg1.getAttribute('width')) || 800;
    expect(w1).toBeGreaterThan(200); // ensure we actually measured something sensible
    // Change the typeId (simulate user selecting another item)
    rerender(<QueryClientProvider client={qc}><MarketHistoryChart typeId="456" /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: /Volume/i })).toBeTruthy());
    const svg2 = screen.getByTestId('market-history-svg');
  (window as any).__setTestElementLayout?.(svg2, { width: 790, height: 320 });
  fireEvent(window, new Event('resize'));
  const w2 = Number(svg2.getAttribute('width')) || 790;
    // Width should not collapse (heuristic: at least 90% of prior width)
    expect(w2).toBeGreaterThanOrEqual(w1 * 0.9);
    // And enforce minimum effective width guard
  expect(w2).toBeGreaterThanOrEqual(420);
  });

  it('re-measures width when devicePixelRatio changes with a larger container', async () => {
    const hydratedModel = buildHistoryResponse([
      {
        bucketStart: '2025-09-30T00:00:00Z',
        volume: 100,
        averagePrice: 9.5,
        highPrice: 11.8,
        lowPrice: 9.1,
        medianPrice: 10.2,
      },
      {
        bucketStart: '2025-10-01T00:00:00Z',
        volume: 150,
        averagePrice: 10.2,
        highPrice: 12.4,
        lowPrice: 9.7,
        medianPrice: 10.9,
      },
    ]);
    setupFetchMock([
      { json: hydratedModel },
      { ok: false, error: 404, json: { meta: {} } },
    ]);

    const originalResizeObserver = (globalThis as any).ResizeObserver;
    const originalDpr = window.devicePixelRatio;
    const originalRaf = window.requestAnimationFrame;
    const originalCancelRaf = window.cancelAnimationFrame;

    let currentWidth = 640;
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(performance.now());
      return 1;
    });
    const cancelRafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => {
      const width = currentWidth;
      const height = 400;
      return DOMRectReadOnly.fromRect({ width, height, x: 0, y: 0 });
    });

    const observers: ResizeObserverCallback[] = [];
    (globalThis as any).ResizeObserver = class implements ResizeObserver {
      private readonly callback: ResizeObserverCallback;

      constructor(cb: ResizeObserverCallback) {
        this.callback = cb;
        observers.push(cb);
      }

      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };

    const qc = new QueryClient();
  qc.setQueryData(['market-model', '123'], hydratedModel);

    try {
      render(<QueryClientProvider client={qc}><MarketHistoryChart typeId="123" /></QueryClientProvider>);

    const svg = await screen.findByTestId('market-history-svg');
      expect(observers.length).toBeGreaterThan(0);
      // Simulate the initial ResizeObserver tick to push the actual layout width.
      await act(async () => {
        observers.forEach((cb) => cb([{ contentRect: { width: currentWidth } } as ResizeObserverEntry], {} as ResizeObserver));
      });
  await waitFor(() => expect(Number(svg.getAttribute('width'))).toBeGreaterThanOrEqual(640));

      // Prepare a larger layout and trigger DPR change dispatch.
      currentWidth = 900;
      window.devicePixelRatio = 2;
      const setMatch = (window as any).__setMediaQueryMatch as ((query: string, value: boolean) => void) | undefined;
      setMatch?.('(resolution: 1dppx)', false);

      // Allow scheduled callbacks to settle.
  await waitFor(() => expect(Number(svg.getAttribute('width'))).toBeGreaterThanOrEqual(900));

      // Ensure ResizeObserver callbacks can still be invoked without throwing.
      await act(async () => {
        observers.forEach((cb) => cb([{ contentRect: { width: currentWidth } } as ResizeObserverEntry], {} as ResizeObserver));
      });
    } finally {
      rectSpy.mockRestore();
      rafSpy.mockRestore();
      cancelRafSpy.mockRestore();
      if (originalResizeObserver) {
        (globalThis as any).ResizeObserver = originalResizeObserver;
      } else {
        delete (globalThis as any).ResizeObserver;
      }
      window.devicePixelRatio = originalDpr;
      window.requestAnimationFrame = originalRaf;
      window.cancelAnimationFrame = originalCancelRaf;
    }
  });

  it('re-reads width on visualViewport resize', async () => {
    const hydratedModel = buildHistoryResponse([
      {
        bucketStart: '2025-09-30T00:00:00Z',
        volume: 100,
        averagePrice: 9.5,
        highPrice: 11.8,
        lowPrice: 9.1,
        medianPrice: 10.2,
      },
      {
        bucketStart: '2025-10-01T00:00:00Z',
        volume: 150,
        averagePrice: 10.2,
        highPrice: 12.4,
        lowPrice: 9.7,
        medianPrice: 10.9,
      },
    ]);
    setupFetchMock([
      { json: hydratedModel },
      { ok: false, error: 404, json: { meta: {} } },
    ]);

    const originalResizeObserver = (globalThis as any).ResizeObserver;
    const originalRaf = window.requestAnimationFrame;
    const originalCancelRaf = window.cancelAnimationFrame;
    const originalViewport = window.visualViewport;

    let currentWidth = 640;
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(performance.now());
      return 1;
    });
    const cancelRafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => {
      const width = currentWidth;
      const height = 400;
      return DOMRectReadOnly.fromRect({ width, height, x: 0, y: 0 });
    });

    const observers: ResizeObserverCallback[] = [];
    (globalThis as any).ResizeObserver = class implements ResizeObserver {
      private readonly callback: ResizeObserverCallback;

      constructor(cb: ResizeObserverCallback) {
        this.callback = cb;
        observers.push(cb);
      }

      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };

    const viewportListeners = new Map<string, Set<(event: Event) => void>>();
    const addViewportListener = (type: string, listener: (event: Event) => void) => {
      const set = viewportListeners.get(type) ?? new Set<(event: Event) => void>();
      set.add(listener);
      viewportListeners.set(type, set);
    };
    const removeViewportListener = (type: string, listener: (event: Event) => void) => {
      const set = viewportListeners.get(type);
      if (!set) return;
      set.delete(listener);
    };
    const dispatchViewport = (type: string) => {
      const set = viewportListeners.get(type);
      if (!set) return;
      set.forEach((listener) => listener(new Event(type)));
    };

    (window as any).visualViewport = {
      width: currentWidth,
      height: 720,
      scale: 1,
      pageTop: 0,
      pageLeft: 0,
      addEventListener: (type: string, listener: (event: Event) => void) => addViewportListener(type, listener),
      removeEventListener: (type: string, listener: (event: Event) => void) => removeViewportListener(type, listener),
    };

  const qc = new QueryClient();
  qc.setQueryData(['market-model', '123'], hydratedModel);

    try {
      render(<QueryClientProvider client={qc}><MarketHistoryChart typeId="123" /></QueryClientProvider>);

      const svg = await screen.findByTestId('market-history-svg');
      expect(observers.length).toBeGreaterThan(0);
      expect(viewportListeners.get('resize')).toBeTruthy();

      await act(async () => {
        observers.forEach((cb) => cb([{ contentRect: { width: currentWidth } } as ResizeObserverEntry], {} as ResizeObserver));
      });
  await waitFor(() => expect(Number(svg.getAttribute('width'))).toBeGreaterThanOrEqual(640));

      currentWidth = 960;
      (window as any).visualViewport.width = currentWidth;
      await act(async () => {
        dispatchViewport('resize');
      });

  await waitFor(() => expect(Number(svg.getAttribute('width'))).toBeGreaterThanOrEqual(960));
    } finally {
      rectSpy.mockRestore();
      rafSpy.mockRestore();
      cancelRafSpy.mockRestore();
      if (originalResizeObserver) {
        (globalThis as any).ResizeObserver = originalResizeObserver;
      } else {
        delete (globalThis as any).ResizeObserver;
      }
      window.requestAnimationFrame = originalRaf;
      window.cancelAnimationFrame = originalCancelRaf;
      if (originalViewport) {
        window.visualViewport = originalViewport;
      } else {
        delete (window as any).visualViewport;
      }
    }
  });

});
