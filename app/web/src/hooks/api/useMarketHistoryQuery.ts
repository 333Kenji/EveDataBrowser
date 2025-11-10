import { CACHE_POLICY_DEFAULTS, MARKET_HISTORY_DEFAULT_LIMIT } from '@evedatabrowser/contracts';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchMarketHistory, type MarketHistoryApiResponse } from '../../services/market-history-client';

interface UseMarketHistoryQueryOptions {
  enabled?: boolean;
  refresh?: boolean;
  regionId?: number;
  limit?: number;
  order?: 'asc' | 'desc';
}

const MARKET_STALE_TIME_MS = CACHE_POLICY_DEFAULTS.market.maxAgeSeconds * 1000;
const MARKET_GC_TIME_MS = (CACHE_POLICY_DEFAULTS.market.maxAgeSeconds + (CACHE_POLICY_DEFAULTS.market.staleWhileRevalidateSeconds ?? 0)) * 1000;

export type MarketHistoryQueryKey = [
  'market-history',
  string | null,
  number | undefined,
  number,
  UseMarketHistoryQueryOptions['order'],
];

export function buildMarketHistoryQueryKey(
  typeId: string | null,
  options: UseMarketHistoryQueryOptions = {},
): MarketHistoryQueryKey {
  const resolvedLimit = options.limit ?? MARKET_HISTORY_DEFAULT_LIMIT;
  return [
    'market-history',
    typeId,
    options.regionId,
    resolvedLimit,
    options.order,
  ];
}

export function useMarketHistoryQuery(typeId: string | null, options: UseMarketHistoryQueryOptions = {}): UseQueryResult<MarketHistoryApiResponse, Error> {
  const resolvedLimit = options.limit ?? MARKET_HISTORY_DEFAULT_LIMIT;
  const queryKey = buildMarketHistoryQueryKey(typeId, options);

  return useQuery<MarketHistoryApiResponse, Error, MarketHistoryApiResponse, typeof queryKey>({
    queryKey,
    enabled: Boolean(typeId) && (options.enabled ?? true),
    staleTime: MARKET_STALE_TIME_MS,
    gcTime: MARKET_GC_TIME_MS,
    refetchOnWindowFocus: false,
    retry: 1,
    keepPreviousData: true,
    queryFn: async () => {
      if (!typeId) {
        throw new Error('Missing typeId');
      }
      return fetchMarketHistory(typeId, {
        refresh: options.refresh,
        regionId: options.regionId,
        limit: resolvedLimit,
        order: options.order,
      });
    },
  });
}
