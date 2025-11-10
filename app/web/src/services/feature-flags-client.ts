export interface StructureOrderFeatureFlag {
  enabled: boolean;
  structures: number[];
}

export interface FeatureFlagsPayload {
  features: {
    structureOrders: StructureOrderFeatureFlag;
  };
}

function normalizeStructures(input: unknown): number[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((value) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
      }
      const parsed = Number.parseInt(String(value), 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    })
    .filter((value): value is number => typeof value === 'number' && value > 0);
}

function normalizeStructureOrderFlag(value: unknown): StructureOrderFeatureFlag {
  if (typeof value === 'boolean') {
    return { enabled: value, structures: [] };
  }

  if (value && typeof value === 'object') {
    const enabled = Boolean((value as { enabled?: unknown }).enabled);
    const structures = normalizeStructures((value as { structures?: unknown }).structures);
    return { enabled, structures };
  }

  return { enabled: false, structures: [] };
}

export async function fetchFeatureFlags(): Promise<FeatureFlagsPayload> {
  const response = await fetch('/v1/internal/features', { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`feature flags request failed (${response.status})`);
  }
  const payload = await response.json();
  return {
    features: {
      structureOrders: normalizeStructureOrderFlag(payload?.features?.structureOrders),
    },
  };
}
