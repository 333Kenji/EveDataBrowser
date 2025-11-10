export type CacheScope = "public" | "private";

export interface CacheEnvelope {
  scope: CacheScope;
  maxAgeSeconds: number;
  staleWhileRevalidateSeconds: number;
  generatedAt: Date;
}

export interface CacheOptions {
  scope?: CacheScope;
  maxAgeSeconds?: number;
  staleWhileRevalidateSeconds?: number;
}

export function resolveCacheEnvelope(options: CacheOptions | undefined, defaults: CacheEnvelope): CacheEnvelope {
  return {
    scope: options?.scope ?? defaults.scope,
    maxAgeSeconds: options?.maxAgeSeconds ?? defaults.maxAgeSeconds,
    staleWhileRevalidateSeconds: options?.staleWhileRevalidateSeconds ?? defaults.staleWhileRevalidateSeconds,
    generatedAt: new Date()
  };
}
