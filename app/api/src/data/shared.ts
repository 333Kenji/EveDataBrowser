export interface CacheEnvelope {
  maxAgeSeconds: number;
  staleWhileRevalidateSeconds: number;
  generatedAt: Date;
}

export interface CacheOptions {
  maxAgeSeconds?: number;
  staleWhileRevalidateSeconds?: number;
}

export function resolveCacheEnvelope(options: CacheOptions | undefined, defaults: CacheEnvelope): CacheEnvelope {
  return {
    maxAgeSeconds: options?.maxAgeSeconds ?? defaults.maxAgeSeconds,
    staleWhileRevalidateSeconds: options?.staleWhileRevalidateSeconds ?? defaults.staleWhileRevalidateSeconds,
    generatedAt: new Date()
  };
}
