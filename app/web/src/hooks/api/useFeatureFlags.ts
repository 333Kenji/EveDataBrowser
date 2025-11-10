import { useQuery } from '@tanstack/react-query';
import { fetchFeatureFlags, type FeatureFlagsPayload } from '../../services/feature-flags-client';

const FEATURE_FLAGS_STALE_MS = 30 * 60 * 1000;

export function useFeatureFlags() {
  return useQuery<FeatureFlagsPayload, Error>({
    queryKey: ['feature-flags'],
    queryFn: fetchFeatureFlags,
    staleTime: FEATURE_FLAGS_STALE_MS,
    cacheTime: FEATURE_FLAGS_STALE_MS,
    refetchOnWindowFocus: false,
  });
}
