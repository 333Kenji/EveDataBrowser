import { useQuery } from '@tanstack/react-query';
import { fetchMarketQaStatus, type MarketQaStatus } from '../../services/market-qa-client';

const MARKET_QA_STALE_MS = 5 * 60 * 1000;

export function useMarketQaStatus() {
  return useQuery<MarketQaStatus, Error>({
    queryKey: ['market-qa'],
    queryFn: fetchMarketQaStatus,
    staleTime: MARKET_QA_STALE_MS,
    cacheTime: MARKET_QA_STALE_MS * 2,
    refetchOnWindowFocus: false,
  });
}
