import type { Pool } from "pg";
import type { MarketHistoryPoint, MarketLatestStatsSummary } from "../domain/market.js";
import { RepositoryError } from "./errors.js";

export interface MarketHistoryQuery {
  readonly typeId: number;
  readonly regionId: number;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly limit?: number;
  readonly order?: "asc" | "desc";
}

export interface MarketLatestStatsQuery {
  readonly typeId: number;
  readonly regionId: number;
}

export interface MarketRepository {
  getHistory(query: MarketHistoryQuery): Promise<ReadonlyArray<MarketHistoryPoint>>;
  getLatestStats(query: MarketLatestStatsQuery): Promise<MarketLatestStatsSummary | null>;
}

export type MarketRepositoryFactory = (pool: Pool) => MarketRepository;

export function assertMarketRepository(contract: unknown): asserts contract is MarketRepository {
  if (!contract || typeof (contract as MarketRepository).getHistory !== "function") {
    throw new RepositoryError("Provided market repository does not implement getHistory()");
  }
  if (typeof (contract as MarketRepository).getLatestStats !== "function") {
    throw new RepositoryError("Provided market repository does not implement getLatestStats()");
  }
}
