export type HealthState = 'healthy' | 'degraded' | 'offline';

export interface HealthSnapshot {
  state: HealthState;
  message: string;
  checkedAt: number;
  latency: number;
}

const DEFAULT_TIMEOUT_MS = 8000;

function deriveHealthEndpoints(): string[] {
  const envBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3400').trim();
  const cleanedEnv = envBase.replace(/\/$/, '');
  let fallback: string | null = null;
  if (typeof window !== 'undefined' && window.location?.origin) {
    fallback = `${window.location.origin.replace(/\/$/, '')}/api`;
  }
  const endpoints = [cleanedEnv];
  if (fallback && !endpoints.includes(fallback)) {
    endpoints.push(fallback);
  }
  return endpoints;
}

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const endpoints = deriveHealthEndpoints();
  const attemptErrors: { endpoint: string; error: string; name: string }[] = [];

  for (let i = 0; i < endpoints.length; i += 1) {
    const base = endpoints[i];
    const start = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(`${base}/health`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      const latency = Math.round(performance.now() - start);
      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.error('[health] degraded', {
          attempt: i + 1,
          total: endpoints.length,
          status: response.status,
          statusText: response.statusText,
          url: `${base}/health`,
          latency,
        });
        return {
          state: 'degraded',
          message: `Health endpoint returned ${response.status}`,
          checkedAt: Date.now(),
          latency,
        };
      }
      const payload = (await response.json()) as { overallStatus?: string; message?: string } | null;
      const reported = (payload?.overallStatus ?? '').toString().toLowerCase();
      let state: HealthState;
      switch (reported) {
        case 'healthy':
          state = 'healthy';
          break;
        case 'degraded':
          state = 'degraded';
          break;
        case 'down':
          state = 'offline';
          break;
        default:
          state = 'degraded';
          break;
      }
      const message = payload?.message ?? (state === 'healthy'
        ? 'All systems reporting healthy status.'
        : state === 'offline'
          ? 'Service reported down state.'
          : 'API signalled partial degradation.');
      if (i > 0) {
        // eslint-disable-next-line no-console
        console.warn('[health] succeeded after fallback', { endpointTried: base, attempts: i + 1 });
      }
      return { state, message, checkedAt: Date.now(), latency };
    } catch (error) {
      const latency = Math.round(performance.now() - start);
      const errObj = error instanceof Error ? error : new Error(String(error));
      attemptErrors.push({ endpoint: base, error: errObj.message, name: errObj.name });
      // eslint-disable-next-line no-console
      console.error('[health] attempt failed', {
        attempt: i + 1,
        total: endpoints.length,
        endpoint: base,
        name: errObj.name,
        message: errObj.message,
        aborted: errObj.name === 'AbortError',
        latency,
      });
      clearTimeout(timeoutId);
      continue; // try next endpoint
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // All attempts failed
  // eslint-disable-next-line no-console
  console.error('[health] offline (all attempts failed)', { attempts: attemptErrors });
  return {
    state: 'offline',
    message: `Unable to reach API: ${attemptErrors.map(a => `${a.name}:${a.error}`).join('; ')}`,
    checkedAt: Date.now(),
    latency: attemptErrors.length > 0 ? attemptErrors[attemptErrors.length - 1].error.length : 0, // pseudo latency (we lost real timing after loop)
  };
}
