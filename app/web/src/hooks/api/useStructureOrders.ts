import { useQuery, type QueryFunctionContext } from '@tanstack/react-query';
import { fetchStructureOrders, type StructureOrdersResponse } from '../../services/structure-orders-client';

type StructureOrdersQueryKey = ['structure-orders', number, number];

interface UseStructureOrdersOptions {
  enabled?: boolean;
}

function resolveMeta(meta: QueryFunctionContext['meta']): { refresh?: boolean } {
  if (meta && typeof meta === 'object' && 'refresh' in meta) {
    const refreshValue = (meta as { refresh?: unknown }).refresh;
    return { refresh: refreshValue === true };
  }
  return {};
}

export function useStructureOrders(
  structureId: number | null | undefined,
  typeId: number | null | undefined,
  options: UseStructureOrdersOptions = {},
) {
  const normalizedStructureId = Number.isFinite(structureId) && structureId ? Math.trunc(structureId) : null;
  const normalizedTypeId = Number.isFinite(typeId) && typeId ? Math.trunc(typeId) : null;
  const queryEnabled = Boolean(options.enabled) && Boolean(normalizedStructureId) && Boolean(normalizedTypeId);

  return useQuery<StructureOrdersResponse, Error, StructureOrdersResponse, StructureOrdersQueryKey>({
    queryKey: ['structure-orders', normalizedStructureId ?? 0, normalizedTypeId ?? 0],
    enabled: queryEnabled,
    queryFn: ({ queryKey, signal, meta }) => {
      const [, structureKey, typeKey] = queryKey;
      const metadata = resolveMeta(meta);
      return fetchStructureOrders(structureKey, {
        typeId: typeKey,
        refresh: metadata.refresh,
        signal,
      });
    },
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
