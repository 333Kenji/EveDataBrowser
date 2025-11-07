import { CACHE_POLICY_DEFAULTS } from '@evedatabrowser/contracts';
import { useQuery } from '@tanstack/react-query';
import { fetchItemDetail } from '../../services/item-detail-client';
import type { ItemDetailRecord } from '../../state/dropdown-store';

interface UseItemDetailQueryOptions {
  enabled?: boolean;
  staleTime?: number;
  onSuccess?: (detail: ItemDetailRecord) => void;
  onError?: (error: unknown) => void;
}

const ITEM_DETAIL_DEFAULT_STALE_TIME_MS = CACHE_POLICY_DEFAULTS.items.maxAgeSeconds * 1000;

export function useItemDetailQuery(typeId: string | null, options: UseItemDetailQueryOptions = {}) {
  return useQuery({
    queryKey: ['item-detail', typeId],
    enabled: Boolean(typeId) && (options.enabled ?? true),
    staleTime: options.staleTime ?? ITEM_DETAIL_DEFAULT_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!typeId) {
        throw new Error('Missing typeId');
      }
      return fetchItemDetail(typeId);
    },
    onSuccess: options.onSuccess,
    onError: options.onError,
  });
}
