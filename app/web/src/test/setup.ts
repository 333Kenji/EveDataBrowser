import '@testing-library/jest-dom/vitest';

type MediaQueryListListener = (event: MediaQueryListEvent) => void;

function createMatchMedia(query: string, registry: Map<string, MediaQueryList>): MediaQueryList {
  const listeners = new Set<MediaQueryListListener>();
  let matches = false;

  const mediaQueryList = {
    media: query,
    get matches() {
      return matches;
    },
    set matches(value: boolean) {
      matches = value;
    },
    onchange: null,
    addEventListener: (_event: string, listener: MediaQueryListListener) => {
      listeners.add(listener);
    },
    removeEventListener: (_event: string, listener: MediaQueryListListener) => {
      listeners.delete(listener);
    },
    addListener: (listener: MediaQueryListListener) => {
      listeners.add(listener);
    },
    removeListener: (listener: MediaQueryListListener) => {
      listeners.delete(listener);
    },
    dispatchEvent: (event: Event) => {
      listeners.forEach((listener) => {
        listener(event as MediaQueryListEvent);
      });
      return true;
    },
  } as unknown as MediaQueryList;

  registry.set(query, mediaQueryList);
  return mediaQueryList;
}

if (typeof window !== 'undefined') {
  const registry = new Map<string, MediaQueryList>();

  const matchMedia = (query: string): MediaQueryList => {
    const cached = registry.get(query);
    if (cached) {
      return cached;
    }

    return createMatchMedia(query, registry);
  };

  (matchMedia as unknown as { __registry?: Map<string, MediaQueryList> }).__registry = registry;
  (window as unknown as { __setMediaQueryMatch?: (query: string, value: boolean) => void }).__setMediaQueryMatch = (
    query: string,
    value: boolean,
  ) => {
    const media = registry.get(query);
    if (!media) {
      return;
    }

    Object.defineProperty(media, 'matches', { value, configurable: true, writable: true });
    const event = { matches: value } as MediaQueryListEvent;
    media.dispatchEvent(event as Event);
  };

  window.matchMedia = matchMedia;
}

// Deterministic layout measurement helper for SVG / div elements in tests.
// Many chart tests depend on stable width/height; jsdom returns 0 by default.
// We provide an opt-in registry so individual tests can set widths without
// leaking global state unintentionally. Usage:
//   (window as any).__setTestElementLayout(el, { width: 640, height: 320 })
// If no explicit layout registered, a sensible default is returned.
if (typeof window !== 'undefined' && !(window as any).__setTestElementLayout) {
  const layoutRegistry = new WeakMap<Element, { width: number; height: number; top?: number; left?: number }>();
  (window as any).__setTestElementLayout = (el: Element, rect: { width: number; height: number; top?: number; left?: number }) => {
    layoutRegistry.set(el, rect);
  };
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  // Avoid double wrapping.
  if (!(Element.prototype as any).__patchedForDeterministicLayout) {
    Object.defineProperty(Element.prototype, '__patchedForDeterministicLayout', { value: true });
    Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect(this: Element) {
      const stored = layoutRegistry.get(this);
      if (stored) {
        const { width, height } = stored;
        const top = stored.top ?? 0;
        const left = stored.left ?? 0;
        return DOMRectReadOnly.fromRect({ x: left, y: top, width, height });
      }
      // Fallback default for svg/chart containers to reduce flakiness.
      if (this instanceof SVGSVGElement || this.getAttribute?.('data-test-chart-root')) {
        return DOMRectReadOnly.fromRect({ x: 0, y: 0, width: 640, height: 320 });
      }
      return originalGetBoundingClientRect.call(this);
    };
  }
}

// Synthetic hover dispatcher utility for charts (mouse move relative to element box)
if (typeof window !== 'undefined' && !(window as any).__dispatchHover) {
  (window as any).__dispatchHover = (el: Element, ratioX: number, ratioY: number) => {
    const rect = el.getBoundingClientRect();
    const clientX = rect.x + rect.width * ratioX;
    const clientY = rect.y + rect.height * ratioY;
    const evt = new MouseEvent('mousemove', { bubbles: true, clientX, clientY });
    el.dispatchEvent(evt);
  };
}

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: function getContext() {
      return {
        canvas: this,
        clearRect: () => {},
        fillRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        globalAlpha: 1,
      } as unknown as CanvasRenderingContext2D;
    },
  });
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Object.defineProperty(Element.prototype, 'scrollTo', {
    value: () => {},
    configurable: true,
    writable: true,
  });
}

// Minimal ResizeObserver polyfill for jsdom tests (layout changes not asserted).
if (typeof window !== 'undefined' && !(window as any).ResizeObserver) {
  class ResizeObserver {
    private _cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) { this._cb = cb; }
    observe() {/* no-op */}
    unobserve() {/* no-op */}
    disconnect() {/* no-op */}
  }
  (window as any).ResizeObserver = ResizeObserver;
}
