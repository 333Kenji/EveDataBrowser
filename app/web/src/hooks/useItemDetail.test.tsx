import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemDetailRecord } from '../state/dropdown-store';
import { useDropdownStore } from '../state/dropdown-store';
import { useItemDetail } from './useItemDetail';
import { useItemDetailQuery } from './api/useItemDetailQuery';

vi.mock('./api/useItemDetailQuery', () => ({
  useItemDetailQuery: vi.fn(),
}));

vi.mock('../analytics/dropdown-events', () => ({
  emitItemDetailView: vi.fn(),
  emitItemDetailError: vi.fn(),
}));

const useItemDetailQueryMock = vi.mocked(useItemDetailQuery);

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function buildDetail(overrides: Partial<ItemDetailRecord> = {}): ItemDetailRecord {
  return {
    typeId: overrides.typeId ?? '603',
    name: overrides.name ?? 'Omen',
    category: overrides.category ?? 'Ships',
    group: overrides.group ?? 'Cruisers',
    description: overrides.description ?? 'Baseline hull',
    imageUrl: overrides.imageUrl,
    dataVersion: overrides.dataVersion ?? 'test',
    lastUpdated: overrides.lastUpdated ?? new Date('2025-10-13T10:00:00Z').toISOString(),
    attributes: overrides.attributes ?? [
      { label: 'Mass', value: 1000, importance: 'core' },
    ],
    marketLineage: overrides.marketLineage ?? [],
    isPartial: overrides.isPartial,
  };
}

describe('useItemDetail', () => {
  beforeEach(() => {
    useDropdownStore.getState().reset();
    useItemDetailQueryMock.mockReset();
  });

  it('returns ready status when detail loads', () => {
    const detail = buildDetail();
    useItemDetailQueryMock.mockImplementation((_typeId, options) => {
      options?.onSuccess?.(detail);
      return {
        data: detail,
        isFetching: false,
        refetch: vi.fn(),
        error: null,
        isError: false,
      } as any;
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useItemDetail('603'), { wrapper });

    expect(result.current.status).toBe('ready');
    expect(result.current.detail).toEqual(detail);
    expect(result.current.message).toBeUndefined();
    expect(useDropdownStore.getState().detailHistory).toContain('603');
  });

  it('surfaces partial status when attributes are missing', () => {
    const detail = buildDetail({ description: undefined, attributes: [] });
    useItemDetailQueryMock.mockImplementation((_typeId, options) => {
      options?.onSuccess?.(detail);
      return {
        data: detail,
        isFetching: false,
        refetch: vi.fn(),
        error: null,
        isError: false,
      } as any;
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useItemDetail('603'), { wrapper });

    expect(result.current.status).toBe('partial');
    expect(result.current.message).toBe('Limited data shown');
  });

  it('returns error status when query fails', () => {
    const failure = new Error('boom');
    useItemDetailQueryMock.mockImplementation((_typeId, options) => {
      options?.onError?.(failure);
      return {
        data: null,
        isFetching: false,
        refetch: vi.fn(),
        error: failure,
        isError: true,
      } as any;
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useItemDetail('603'), { wrapper });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('boom');
    expect(result.current.detail).toBeNull();
  });

  it('returns idle status when no type is selected', () => {
    useItemDetailQueryMock.mockImplementation(() => ({
      data: null,
      isFetching: false,
      refetch: vi.fn(),
      error: null,
      isError: false,
    }) as any);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useItemDetail(null), { wrapper });

    expect(result.current.status).toBe('idle');
    expect(result.current.detail).toBeNull();
  });
});
