import { CACHE_POLICY_DEFAULTS } from '@evedatabrowser/contracts';
import { useQuery } from '@tanstack/react-query';
import { fetchTaxonomy, type TaxonomySearchResponse } from '../../services/taxonomy-service';

interface UseTaxonomyBrowseQueryOptions {
  enabled?: boolean;
  onSuccess?: (data: TaxonomySearchResponse) => void;
  onError?: (error: unknown) => void;
}

const TAXONOMY_STALE_TIME_MS = CACHE_POLICY_DEFAULTS.taxonomy.maxAgeSeconds * 1000;

export function useTaxonomyBrowseQuery(query: string, options: UseTaxonomyBrowseQueryOptions = {}) {
  return useQuery({
    queryKey: ['taxonomy-browse', query],
    queryFn: () => fetchTaxonomy(query),
    enabled: options.enabled ?? true,
    staleTime: TAXONOMY_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    retry: false,
    onSuccess: options.onSuccess,
    onError: options.onError,
  });
}
