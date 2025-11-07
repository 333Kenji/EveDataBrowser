import { useMemo } from 'react';
import { emitItemDetailError, emitItemDetailView } from '../analytics/dropdown-events';
import { useDropdownStore } from '../state/dropdown-store';
import { useItemDetailQuery } from './api/useItemDetailQuery';

export function useItemDetail(typeId: string | null) {
  const recordDetailView = useDropdownStore((state) => state.recordDetailView);

  const query = useItemDetailQuery(typeId, {
    enabled: Boolean(typeId),
    onSuccess: (detail) => {
      recordDetailView(detail);
      emitItemDetailView({ typeId: detail.typeId, dataVersion: detail.dataVersion });
    },
    onError: (err) => {
      const reason = err instanceof Error ? err.message : 'Unable to load item detail.';
      if (typeId) {
        emitItemDetailError({ typeId, message: reason });
      }
    },
  });

  const detail = useMemo(() => {
    if (!typeId) {
      return null;
    }

    return query.data ?? null;
  }, [typeId, query.data]);

  const isPartial = detail ? (typeof detail.isPartial === 'boolean' ? detail.isPartial : (!detail.description || detail.attributes.length === 0)) : false;

  const error = query.error ? (query.error instanceof Error ? query.error.message : 'Unable to load item detail.') : undefined;

  const status = (() => {
    if (!typeId) {
      return 'idle';
    }

    if (query.isError) {
      return 'error';
    }

    if (!detail && query.isFetching) {
      return 'loading';
    }

    if (detail && isPartial) {
      return 'partial';
    }

    if (detail) {
      return 'ready';
    }

    return query.isFetching ? 'loading' : 'idle';
  })();

  const message = status === 'partial' ? 'Limited data shown' : undefined;

  return {
    detail,
    status,
    message,
    error,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
