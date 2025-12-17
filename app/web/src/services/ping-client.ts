import { resolveApiBases } from './api-base';

export interface PingSnapshot {
  ok: boolean;
  checkedAt: number;
  latency: number;
}

const TIMEOUT_MS = 3000;

function derivePingEndpoints(): string[] {
  const bases = resolveApiBases();
  if (bases.length === 0) {
    return ['http://localhost:3400'];
  }
  return bases;
}

export async function getPingSnapshot(): Promise<PingSnapshot> {
  const endpoints = derivePingEndpoints();
  for (let i = 0; i < endpoints.length; i += 1) {
    const base = endpoints[i];
    const start = performance.now();
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/health`, { signal: controller.signal });
      const latency = Math.round(performance.now() - start);
      clearTimeout(t);
      if (res.ok) {
        return { ok: true, checkedAt: Date.now(), latency };
      }
  } catch (_error) {
      // ignore and fall back to health
    } finally {
      clearTimeout(t);
    }
  }
  return { ok: false, checkedAt: Date.now(), latency: 0 };
}