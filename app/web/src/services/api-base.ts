const DEFAULT_BASE = 'http://localhost:3400';
const RENDER_API_BASE = 'https://eve-data-browser-api.onrender.com';

const FALLBACK_BASE = RENDER_API_BASE;

function sanitizeBase(input: string | undefined | null): string | null {
  if (!input) {
    return null;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/+$/, '');
}



export function resolveApiBase(): string {
  const envBase = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_BASE_URL : undefined;
  const fromEnv = sanitizeBase(typeof envBase === 'string' ? envBase : undefined);
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? sanitizeBase(window.location.origin)
      : null;

  const host = (() => {
    try {
      return origin ? new URL(origin).hostname : null;
    } catch {
      return null;
    }
  })();

  // Prefer the deployed API when running on Render, regardless of baked envs.
  if (host && host.includes('eve-data-browser-web')) {
    return fromEnv || RENDER_API_BASE;
  }

  if (fromEnv) {
    return fromEnv;
  }

  if (origin) {
    return origin;
  }

  return FALLBACK_BASE;
}

export function resolveApiBases(): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const push = (value: string | null) => {
    if (!value) return;
    if (seen.has(value)) return;
    seen.add(value);
    candidates.push(value);
  };

  const envCandidate = sanitizeBase(
    typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_BASE_URL : undefined,
  );
  push(envCandidate);

  if (typeof window !== 'undefined' && window.location) {
    push(sanitizeBase(window.location.origin));

    if (window.location.hostname.includes('eve-data-browser-web')) {
      push(RENDER_API_BASE);
    }

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      push(sanitizeBase('http://localhost:3400'));
      push(sanitizeBase(`http://${window.location.hostname}:3400`));
      push(sanitizeBase('http://localhost:3000'));
      push(sanitizeBase(`http://${window.location.hostname}:3000`));
    }
  }

  push(sanitizeBase(FALLBACK_BASE));

  return candidates;
}

export function buildApiUrl(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
  baseOverride?: string,
): string {
  const baseCandidate = baseOverride ?? resolveApiBase();
  const base = sanitizeBase(baseCandidate) ?? FALLBACK_BASE;
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(normalisedPath, `${base}/`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}
