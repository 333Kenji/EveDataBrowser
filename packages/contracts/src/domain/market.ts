import type {
  MarketLatestStatsRow,
  MarketPriceHistoryRow
} from "../generated/domain-types.js";
import {
  MarketLatestStatsSummarySchema,
  MarketHistoryPointSchema
} from "../validation/domain.js";
import {
  MarketLatestStatsRowSchema,
  MarketPriceHistoryRowSchema
} from "../generated/validation-schemas.js";
import { validateWithSchema } from "../validation/runtime.js";

function coerceNumeric(value: unknown, label: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  throw new TypeError(`${label}: expected numeric value, received ${typeof value}`);
}

function coerceNullableNumeric(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return coerceNumeric(value, label);
}

function coerceDateString(value: unknown, label: string, withTime = false): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    const iso = value.toISOString();
    return withTime ? iso : iso.slice(0, 10);
  }
  throw new TypeError(`${label}: expected ISO date string, received ${typeof value}`);
}

function coerceString(value: unknown, label: string): string {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  throw new TypeError(`${label}: expected string value, received ${typeof value}`);
}

/**
 * Daily history point derived from market.priceHistory.* schema entries.
 */
export interface MarketHistoryPoint {
  readonly typeId: number;
  readonly regionId: number;
  readonly bucketStart: string;
  readonly averagePrice: number;
  readonly highPrice: number;
  readonly lowPrice: number;
  readonly medianPrice: number | null;
  readonly volume: number;
  readonly orderCount: number | null;
  readonly source: string;
  readonly lastIngestedAt: string;
}

/**
 * Latest consolidated stats assembled from market.latestStats.* manifest entries.
 */
export interface MarketLatestStatsSummary {
  readonly typeId: number;
  readonly regionId: number;
  readonly lastSeenAt: string;
  readonly snapshotLow: number | null;
  readonly snapshotHigh: number | null;
  readonly snapshotMedian: number | null;
  readonly snapshotVolume: number | null;
  readonly source: string;
  readonly updatedAt: string;
}

export function mapHistoryRow(row: MarketPriceHistoryRow): MarketHistoryPoint {
  const raw = row as unknown as Record<string, unknown>;
  const normalizedRow = {
    type_id: coerceNumeric(raw.type_id, "market.priceHistory.typeId"),
    region_id: coerceNumeric(raw.region_id, "market.priceHistory.regionId"),
    ts_bucket_start: coerceDateString(raw.ts_bucket_start, "market.priceHistory.bucketStart"),
    average_price: coerceNumeric(raw.average_price, "market.priceHistory.averagePrice"),
    high_price: coerceNumeric(raw.high_price, "market.priceHistory.highPrice"),
    low_price: coerceNumeric(raw.low_price, "market.priceHistory.lowPrice"),
    median_price: coerceNullableNumeric(raw.median_price, "market.priceHistory.medianPrice"),
    volume: coerceNumeric(raw.volume, "market.priceHistory.volume"),
    order_count: coerceNullableNumeric(raw.order_count, "market.priceHistory.orderCount"),
    source: coerceString(raw.source, "market.priceHistory.source"),
    last_ingested_at: coerceDateString(raw.last_ingested_at, "market.priceHistory.lastIngestedAt", true)
  } satisfies MarketPriceHistoryRow;

  const validatedRow = validateWithSchema(MarketPriceHistoryRowSchema, normalizedRow, "market.priceHistory row");
  const mapped: MarketHistoryPoint = {
    typeId: validatedRow.type_id,
    regionId: validatedRow.region_id,
    bucketStart: validatedRow.ts_bucket_start,
    averagePrice: Number(validatedRow.average_price),
    highPrice: Number(validatedRow.high_price),
    lowPrice: Number(validatedRow.low_price),
    medianPrice: validatedRow.median_price === null ? null : Number(validatedRow.median_price),
    volume: Number(validatedRow.volume),
    orderCount: validatedRow.order_count === null ? null : Number(validatedRow.order_count),
    source: validatedRow.source,
    lastIngestedAt: validatedRow.last_ingested_at
  };
  return validateWithSchema(MarketHistoryPointSchema, mapped, "market history point");
}

export function mapLatestStatsRow(row: MarketLatestStatsRow): MarketLatestStatsSummary {
  const raw = row as unknown as Record<string, unknown>;
  const normalizedRow = {
    type_id: coerceNumeric(raw.type_id, "market.latestStats.typeId"),
    region_id: coerceNumeric(raw.region_id, "market.latestStats.regionId"),
    last_seen_at: coerceDateString(raw.last_seen_at, "market.latestStats.lastSeenAt", true),
    snapshot_low: coerceNullableNumeric(raw.snapshot_low, "market.latestStats.snapshotLow"),
    snapshot_high: coerceNullableNumeric(raw.snapshot_high, "market.latestStats.snapshotHigh"),
    snapshot_median: coerceNullableNumeric(raw.snapshot_median, "market.latestStats.snapshotMedian"),
    snapshot_volume: coerceNullableNumeric(raw.snapshot_volume, "market.latestStats.snapshotVolume"),
    source: coerceString(raw.source, "market.latestStats.source"),
    updated_at: coerceDateString(raw.updated_at, "market.latestStats.updatedAt", true)
  } satisfies MarketLatestStatsRow;

  const validatedRow = validateWithSchema(MarketLatestStatsRowSchema, normalizedRow, "market.latestStats row");
  const mapped: MarketLatestStatsSummary = {
    typeId: validatedRow.type_id,
    regionId: validatedRow.region_id,
    lastSeenAt: validatedRow.last_seen_at,
    snapshotLow: validatedRow.snapshot_low === null ? null : Number(validatedRow.snapshot_low),
    snapshotHigh: validatedRow.snapshot_high === null ? null : Number(validatedRow.snapshot_high),
    snapshotMedian: validatedRow.snapshot_median === null ? null : Number(validatedRow.snapshot_median),
    snapshotVolume: validatedRow.snapshot_volume === null ? null : Number(validatedRow.snapshot_volume),
    source: validatedRow.source,
    updatedAt: validatedRow.updated_at
  };
  return validateWithSchema(MarketLatestStatsSummarySchema, mapped, "market latest stats summary");
}
