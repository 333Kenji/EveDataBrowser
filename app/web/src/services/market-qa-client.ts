export interface MarketQaReport {
  generatedAt: string;
  lookbackDays: number;
  missingDays: Array<{ typeId: number; regionId: number; missingDay: string }>;
  duplicateBuckets: Array<{ typeId: number; regionId: number; bucketDay: string; bucketCount: number }>;
  staleLatest: Array<{ typeId: number; regionId: number; updatedAt: string }>;
}

export interface MarketQaStatus {
  ok: boolean;
  report?: MarketQaReport;
  hasIssues?: boolean;
  message?: string;
}

export async function fetchMarketQaStatus(): Promise<MarketQaStatus> {
  const response = await fetch("/v1/internal/market-qa", { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`market QA request failed (${response.status})`);
  }
  return response.json();
}
