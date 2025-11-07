export type CacheScope = "public" | "private" | "no-store";

export interface CachePolicy {
  readonly scope: CacheScope;
  readonly maxAgeSeconds: number;
  readonly staleWhileRevalidateSeconds?: number;
  readonly description: string;
}

export interface CachePolicyMap {
  readonly taxonomy: CachePolicy;
  readonly items: CachePolicy;
  readonly market: CachePolicy;
  readonly health: CachePolicy;
}

export const CACHE_POLICY_DEFAULTS: CachePolicyMap = {
  taxonomy: {
    scope: "public",
    maxAgeSeconds: 3600,
    staleWhileRevalidateSeconds: 120,
    description: "Stable taxonomy tables derived from the latest SDE import; safe to cache for one hour with a brief revalidation window.",
  },
  items: {
    scope: "public",
    maxAgeSeconds: 86400,
    staleWhileRevalidateSeconds: 3600,
    description: "Master item metadata is sourced from Postgres and refreshed during daily ETL runs; permit caching for 24 hours with a one-hour revalidation window.",
  },
  market: {
    scope: "public",
    maxAgeSeconds: 300,
    staleWhileRevalidateSeconds: 120,
    description: "Market snapshots refresh a few times per hour; cache hits should expire within five minutes.",
  },
  health: {
    scope: "no-store",
    maxAgeSeconds: 0,
    description: "Health checks reflect instantaneous status and must never be cached.",
  },
} as const;

export function formatCacheControl(policy: CachePolicy): string {
  if (policy.scope === "no-store") {
    return "no-store";
  }

  const directives: string[] = [policy.scope, `max-age=${policy.maxAgeSeconds}`];

  if (policy.staleWhileRevalidateSeconds && policy.staleWhileRevalidateSeconds > 0) {
    directives.push(`stale-while-revalidate=${policy.staleWhileRevalidateSeconds}`);
  }

  return directives.join(", ");
}
