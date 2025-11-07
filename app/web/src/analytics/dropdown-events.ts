import { DROPDOWN_HIGH_LATENCY_THRESHOLD_MS } from '../config/dropdown';

type DropdownEventName =
  | 'selection:add'
  | 'selection:remove'
  | 'selection:clear'
  | 'selection:reorder'
  | 'search:latency'
  | 'search:empty'
  | 'search:error'
  | 'itemDetail:view'
  | 'itemDetail:error';

type DropdownEventPayload = Record<string, unknown>;

function formatEvent(name: DropdownEventName, payload: DropdownEventPayload) {
  return {
    name,
    timestamp: new Date().toISOString(),
    payload,
  };
}

export function emitDropdownEvent(name: DropdownEventName, payload: DropdownEventPayload) {
  // In production this would forward to a telemetry client; for now we log for manual QA.
  // eslint-disable-next-line no-console
  console.info('[dropdown-event]', formatEvent(name, payload));
}

export function emitLatencyMetrics(latencyMs: number) {
  emitDropdownEvent('search:latency', {
    latencyMs,
    thresholdMs: DROPDOWN_HIGH_LATENCY_THRESHOLD_MS,
    aboveThreshold: latencyMs > DROPDOWN_HIGH_LATENCY_THRESHOLD_MS,
  });
}

export function emitEmptyResults(query: string) {
  emitDropdownEvent('search:empty', { query });
}

export function emitSearchError(message: string) {
  emitDropdownEvent('search:error', { message });
}

export function emitItemDetailView(payload: { typeId: string; dataVersion: string }) {
  emitDropdownEvent('itemDetail:view', payload);
}

export function emitItemDetailError(payload: { typeId: string; message: string }) {
  emitDropdownEvent('itemDetail:error', payload);
}
