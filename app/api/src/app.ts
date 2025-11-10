import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { MARKET_HISTORY_DEFAULT_LIMIT } from "@evedatabrowser/contracts";
import schemaManifest from "../../../persistence/manifests/schema-manifest.json" with { type: "json" };
import { config } from "./config.js";
import postgresPlugin from "./plugins/postgres.js";
import { searchTaxonomy } from "./data/taxonomy.js";
import { getItemDetail } from "./data/items.js";
import { getMarketHistory, getMarketLatestStats } from "./data/market.js";
import { getStructureOrders } from "./data/structure-orders.js";
import type { CacheEnvelope } from "./data/shared.js";

interface TaxonomySearchQuery {
  q?: string;
  limit?: string;
  offset?: string;
  groupIds?: string;
  categoryIds?: string;
  metaGroupIds?: string;
  publishedOnly?: string;
}

interface ItemDetailQuery {
  includeUnpublished?: string;
}

interface MarketHistoryQuerystring {
  typeId?: string;
  regionId?: string;
  limit?: string;
  order?: string;
  startDate?: string;
  endDate?: string;
  refresh?: string;
}

interface MarketLatestQuerystring {
  typeId?: string;
  regionId?: string;
  refresh?: string;
}

interface StructureOrdersQuerystring {
  refresh?: string;
  typeId?: string;
}

const DEFAULT_MARKET_REGION_ID = 10000002;
const DEFAULT_HISTORY_LIMIT = MARKET_HISTORY_DEFAULT_LIMIT;
const MAX_HISTORY_LIMIT = MARKET_HISTORY_DEFAULT_LIMIT;
const MIN_HISTORY_LIMIT = 1;
const MANIFEST_SCHEMA_HASH = typeof schemaManifest?.schemaHash === "string"
  ? schemaManifest.schemaHash
  : "unknown";
const MANIFEST_SCHEMA_GENERATED_AT = typeof schemaManifest?.generatedAt === "string"
  ? schemaManifest.generatedAt
  : new Date(0).toISOString();
const APP_DIR = fileURLToPath(new URL(".", import.meta.url));
const HISTORY_METRICS_PATH = resolve(APP_DIR, "../../../logs/ingestion/history-metrics.json");
const QA_REPORT_PATH = resolve(APP_DIR, "../../../logs/ingestion/qa/latest.json");

function parseCsvNumbers(value?: string): number[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((num) => Number.isFinite(num));
}

function parseInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function parseOrder(value: string | undefined): "asc" | "desc" | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "asc" || normalized === "desc") {
    return normalized;
  }
  return undefined;
}

function normalizeHistoryLimit(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  const normalized = Math.trunc(value as number);
  if (normalized <= 0) {
    return MIN_HISTORY_LIMIT;
  }
  if (normalized > MAX_HISTORY_LIMIT) {
    return MAX_HISTORY_LIMIT;
  }
  return normalized;
}

function formatCacheHeader(cache: { maxAge: number; staleWhileRevalidate: number }): string {
  return `public, max-age=${cache.maxAge}, stale-while-revalidate=${cache.staleWhileRevalidate}`;
}

function applyCacheHeaders(reply: FastifyReply, cacheControl: string, generatedAt: Date): void {
  reply.header("Cache-Control", cacheControl);
  reply.header("Date", generatedAt.toUTCString());
}

function serializeCacheEnvelope(cache: CacheEnvelope) {
  return {
    scope: cache.scope,
    maxAgeSeconds: cache.maxAgeSeconds,
    staleWhileRevalidateSeconds: cache.staleWhileRevalidateSeconds,
    generatedAt: cache.generatedAt.toISOString(),
  };
}

async function readHistoryMetricsSummary(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(HISTORY_METRICS_PATH, { encoding: "utf8" });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function createApp(): FastifyInstance {
  const app = Fastify({
    logger: false
  });

  void app.register(cors, {
    origin: config.server.cors.origin,
    methods: ["GET", "OPTIONS"],
    credentials: false
  });

  void app.register(postgresPlugin);

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString()
  }));

  app.get("/api/health", async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=30");
    return {
      status: "ok",
      timestamp: new Date().toISOString()
    };
  });

  app.get("/v1/internal/metrics", async (request, reply) => {
    const generatedAt = new Date();
    const latencyStart = process.hrtime.bigint();

    let postgresCheck: {
      status: "ok" | "error";
      latencyMs: number | null;
      serverTime?: string | null;
      error?: string;
    };

    try {
      const result = await request.server.pg.pool.query("SELECT NOW() AS now");
      const diffNs = Number(process.hrtime.bigint() - latencyStart);
      const latencyMs = Math.round((diffNs / 1_000_000) * 100) / 100;
      const rawNow = result?.rows?.[0]?.now ?? null;
      const serverTime = rawNow instanceof Date
        ? rawNow.toISOString()
        : typeof rawNow === "string"
          ? rawNow
          : null;

      postgresCheck = {
        status: "ok",
        latencyMs,
        serverTime,
      };
    } catch (error) {
      const diffNs = Number(process.hrtime.bigint() - latencyStart);
      const latencyMs = Math.round((diffNs / 1_000_000) * 100) / 100;
      postgresCheck = {
        status: "error",
        latencyMs,
        error: error instanceof Error ? error.message : String(error)
      };
    }

    const historyMetrics = await readHistoryMetricsSummary();

    applyCacheHeaders(reply, "public, max-age=5", generatedAt);

    return {
      uptimeSeconds: Math.round(process.uptime()),
      generatedAt: generatedAt.toISOString(),
      schema: {
        hash: MANIFEST_SCHEMA_HASH,
        generatedAt: MANIFEST_SCHEMA_GENERATED_AT,
      },
      checks: {
        postgres: postgresCheck,
        cache: {
          status: "ok",
          policy: {
            taxonomy: config.cache.taxonomy,
            items: config.cache.items,
            market: config.cache.market
          }
        },
        marketIngestion: historyMetrics
      }
    };
  });

  app.get("/v1/internal/market-qa", async (_request, reply) => {
    try {
      const raw = await readFile(QA_REPORT_PATH, { encoding: "utf8" });
      const report = JSON.parse(raw) as {
        generatedAt: string;
        lookbackDays: number;
        missingDays?: Array<{ type_id?: number; typeId?: number; region_id?: number; regionId?: number; missingDay?: string }>;
        duplicateBuckets?: Array<{ type_id?: number; region_id?: number; bucket_day?: string; bucketDay?: string }>;
        staleLatest?: Array<{ type_id?: number; region_id?: number; updated_at?: string }>;
      };
      const missingDays = Array.isArray(report.missingDays) ? report.missingDays : [];
      const duplicateBuckets = Array.isArray(report.duplicateBuckets) ? report.duplicateBuckets : [];
      const staleLatest = Array.isArray(report.staleLatest) ? report.staleLatest : [];
      return {
        ok: true,
        report: {
          generatedAt: report.generatedAt ?? new Date().toISOString(),
          lookbackDays: report.lookbackDays ?? 30,
          missingDays: missingDays.map((entry) => ({
            typeId: Number(entry.typeId ?? entry.type_id ?? 0),
            regionId: Number(entry.regionId ?? entry.region_id ?? 0),
            missingDay: entry.missingDay ?? "",
          })),
          duplicateBuckets: duplicateBuckets.map((entry) => ({
            typeId: Number(entry.typeId ?? entry.type_id ?? 0),
            regionId: Number(entry.regionId ?? entry.region_id ?? 0),
            bucketDay: entry.bucketDay ?? entry.bucket_day ?? "",
            bucketCount: Number(entry.bucket_count ?? 0),
          })),
          staleLatest: staleLatest.map((entry) => ({
            typeId: Number(entry.typeId ?? entry.type_id ?? 0),
            regionId: Number(entry.regionId ?? entry.region_id ?? 0),
            updatedAt: entry.updated_at ?? "",
          })),
        },
        hasIssues: missingDays.length > 0 || duplicateBuckets.length > 0 || staleLatest.length > 0
      };
    } catch (error) {
      reply.code(503);
      return { ok: false, message: "QA report not available", error: error instanceof Error ? error.message : String(error) };
    }
  });

  app.get("/v1/internal/features", async (_request, reply) => ({
    features: {
      structureOrders: {
        enabled: config.features.structureOrders,
        structures: config.structureOrders.structures
      }
    }
  }));

  app.get("/v1/taxonomy/search", async (request: FastifyRequest<{ Querystring: TaxonomySearchQuery }>, reply) => {
    const query = request.query ?? {};
    const limit = parseInteger(query.limit);
    const offset = parseInteger(query.offset);
    const publishedOnly = parseBoolean(query.publishedOnly);

    const { data, cache } = await searchTaxonomy(request.server.pg.pool, {
      query: query.q?.trim(),
      limit,
      offset,
      groupIds: parseCsvNumbers(query.groupIds),
      categoryIds: parseCsvNumbers(query.categoryIds),
      metaGroupIds: parseCsvNumbers(query.metaGroupIds),
      publishedOnly,
      cache: {
        maxAgeSeconds: config.cache.taxonomy.maxAge,
        staleWhileRevalidateSeconds: config.cache.taxonomy.staleWhileRevalidate
      }
    });

    applyCacheHeaders(reply, formatCacheHeader(config.cache.taxonomy), cache.generatedAt);
    reply.header("X-Schema-Hash", MANIFEST_SCHEMA_HASH);

    return {
      items: data.items,
      pagination: {
        limit: data.limit,
        offset: data.offset,
        total: data.total
      }
    };
  });

  app.get("/v1/items/:typeId", async (request: FastifyRequest<{ Params: { typeId: string }; Querystring: ItemDetailQuery }>, reply) => {
    const typeId = Number.parseInt(request.params.typeId, 10);

    if (!Number.isFinite(typeId) || typeId <= 0) {
      reply.code(400);
      return {
        statusCode: 400,
        error: "Bad Request",
        message: "typeId must be a positive integer"
      };
    }

    const includeUnpublished = parseBoolean(request.query?.includeUnpublished);

    const { data, cache } = await getItemDetail(request.server.pg.pool, typeId, {
      includeUnpublished,
      cache: {
        maxAgeSeconds: config.cache.items.maxAge,
        staleWhileRevalidateSeconds: config.cache.items.staleWhileRevalidate
      }
    });

    applyCacheHeaders(reply, formatCacheHeader(config.cache.items), cache.generatedAt);
    reply.header("X-Schema-Hash", MANIFEST_SCHEMA_HASH);

    if (!data) {
      reply.code(404);
      return {
        statusCode: 404,
        error: "Not Found",
        message: `Item ${typeId} not found`
      };
    }

    return {
      typeId: data.typeId,
      name: data.name,
      description: data.description,
      published: data.published,
      group: {
        id: data.groupId,
        name: data.groupName
      },
      category: {
        id: data.categoryId,
        name: data.categoryName
      },
      meta: {
        groupId: data.metaGroupId,
        groupName: data.metaGroupName,
        metaLevel: data.metaLevel
      },
      marketGroup: data.marketGroupId === null && data.marketGroupName === null && data.marketGroupPath.length === 0
        ? null
        : {
            id: data.marketGroupId,
            key: data.marketGroupKey,
            name: data.marketGroupName,
            path: data.marketGroupPath.map((node) => ({
              marketGroupKey: node.marketGroupKey,
              marketGroupId: node.marketGroupId,
              name: node.name,
              parentGroupKey: node.parentGroupKey
            }))
          },
      faction: data.factionId === null && data.factionName === null
        ? null
        : {
            id: data.factionId,
            name: data.factionName
          },
      raceId: data.raceId,
      mass: data.mass,
      volume: data.volume,
      basePrice: data.basePrice,
      blueprint: data.blueprint
        ? {
            typeId: data.blueprint.blueprintTypeId,
            name: data.blueprint.blueprintName,
            activity: data.blueprint.activity,
            productQuantity: data.blueprint.productQuantity,
            manufacturingTime: data.blueprint.manufacturingTime,
            maxProductionLimit: data.blueprint.maxProductionLimit
          }
        : null,
      materials: data.materials.map((material) => ({
        materialTypeId: material.materialTypeId,
        materialName: material.materialName,
        quantity: material.quantity,
        groupId: material.groupId,
        groupName: material.groupName
      }))
    };
  });

  app.get("/v1/market/history", async (request: FastifyRequest<{ Querystring: MarketHistoryQuerystring }>, reply) => {
    const query = request.query ?? {};
    const typeId = parseInteger(query.typeId ?? "");

    if (!typeId || typeId <= 0) {
      reply.code(400);
      return {
        statusCode: 400,
        error: "Bad Request",
        message: "typeId is required and must be a positive integer",
      };
    }

    const regionId = parseInteger(query.regionId ?? "") ?? DEFAULT_MARKET_REGION_ID;
    if (!regionId || regionId <= 0) {
      reply.code(400);
      return {
        statusCode: 400,
        error: "Bad Request",
        message: "regionId must be a positive integer",
      };
    }

    const limitValue = normalizeHistoryLimit(parseInteger(query.limit)) ?? DEFAULT_HISTORY_LIMIT;
    const order = parseOrder(query.order);
    const refresh = parseBoolean(query.refresh) ?? false;

    const startDateInput = query.startDate?.trim();
    const startDateMs = startDateInput ? Date.parse(startDateInput) : undefined;
    if (startDateInput && Number.isNaN(startDateMs)) {
      reply.code(400);
      return {
        statusCode: 400,
        error: "Bad Request",
        message: "startDate must be a valid ISO-8601 timestamp",
      };
    }

    const endDateInput = query.endDate?.trim();
    const endDateMs = endDateInput ? Date.parse(endDateInput) : undefined;
    if (endDateInput && Number.isNaN(endDateMs)) {
      reply.code(400);
      return {
        statusCode: 400,
        error: "Bad Request",
        message: "endDate must be a valid ISO-8601 timestamp",
      };
    }

    if (startDateMs !== undefined && endDateMs !== undefined && startDateMs > endDateMs) {
      reply.code(400);
      return {
        statusCode: 400,
        error: "Bad Request",
        message: "startDate must be less than or equal to endDate",
      };
    }

    const startDateIso = startDateMs !== undefined ? new Date(startDateMs).toISOString() : undefined;
    const endDateIso = endDateMs !== undefined ? new Date(endDateMs).toISOString() : undefined;

    const { data, cache, schemaHash } = await getMarketHistory(request.server.pg.pool, {
      typeId,
      regionId,
      limit: limitValue,
      order,
      startDate: startDateIso,
      endDate: endDateIso,
    }, {
      refresh,
      cache: {
        maxAgeSeconds: config.cache.market.maxAge,
        staleWhileRevalidateSeconds: config.cache.market.staleWhileRevalidate,
      },
    });

    const cacheControlHeader = refresh
      ? "private, max-age=0, must-revalidate"
      : formatCacheHeader(config.cache.market);

    applyCacheHeaders(reply, cacheControlHeader, cache.generatedAt);
    if (refresh) {
      reply.header("Warning", "199 - \"Refresh requested; downstream caches bypassed\"");
    }
    reply.header("X-Schema-Hash", schemaHash);

    const cachePayload = serializeCacheEnvelope(cache);

    if (data.length === 0) {
      reply.code(404);
      return {
        statusCode: 404,
        error: "Not Found",
        message: `No market history found for type ${typeId} in region ${regionId}`,
        cache: cachePayload,
        schemaHash,
      };
    }

    return {
      data,
      cache: cachePayload,
      schemaHash,
    };
  });

  app.get("/v1/market/latest", async (request: FastifyRequest<{ Querystring: MarketLatestQuerystring }>, reply) => {
    const query = request.query ?? {};
    const typeId = parseInteger(query.typeId ?? "");

    if (!typeId || typeId <= 0) {
      reply.code(400);
      return {
        statusCode: 400,
        error: "Bad Request",
        message: "typeId is required and must be a positive integer",
      };
    }

    const regionId = parseInteger(query.regionId ?? "") ?? DEFAULT_MARKET_REGION_ID;
    if (!regionId || regionId <= 0) {
      reply.code(400);
      return {
        statusCode: 400,
        error: "Bad Request",
        message: "regionId must be a positive integer",
      };
    }

    const refresh = parseBoolean(query.refresh) ?? false;

    const { data, cache, schemaHash } = await getMarketLatestStats(request.server.pg.pool, {
      typeId,
      regionId,
    }, {
      refresh,
      cache: {
        maxAgeSeconds: config.cache.market.maxAge,
        staleWhileRevalidateSeconds: config.cache.market.staleWhileRevalidate,
      },
    });

    const cacheControlHeader = refresh
      ? "private, max-age=0, must-revalidate"
      : formatCacheHeader(config.cache.market);

    applyCacheHeaders(reply, cacheControlHeader, cache.generatedAt);
    if (refresh) {
      reply.header("Warning", "199 - \"Refresh requested; downstream caches bypassed\"");
    }
    reply.header("X-Schema-Hash", schemaHash);

    const cachePayload = serializeCacheEnvelope(cache);

    if (!data) {
      reply.code(404);
      return {
        statusCode: 404,
        error: "Not Found",
        message: `No market snapshot found for type ${typeId} in region ${regionId}`,
        cache: cachePayload,
        schemaHash,
      };
      }

    return {
      data,
      cache: cachePayload,
      schemaHash,
    };
  });

  app.get("/v1/market/structures/:structureId/orders", async (
    request: FastifyRequest<{ Params: { structureId: string }; Querystring: StructureOrdersQuerystring }>,
    reply
  ) => {
    if (!config.features.structureOrders) {
      reply.code(404);
      return {
        statusCode: 404,
        error: "Not Found",
        message: "Private structure orders feature is disabled"
      };
    }

    const structureId = Number.parseInt(request.params.structureId, 10);
    if (!Number.isFinite(structureId) || structureId <= 0) {
      reply.code(400);
      return {
        statusCode: 400,
        error: "Bad Request",
        message: "structureId must be a positive integer"
      };
    }

    const refresh = parseBoolean(request.query?.refresh) ?? false;
    const typeIdRaw = request.query?.typeId;
    let typeId: number | undefined;

    if (typeIdRaw !== undefined) {
      const parsedTypeId = parseInteger(typeIdRaw);
      if (!parsedTypeId || parsedTypeId <= 0) {
        reply.code(400);
        return {
          statusCode: 400,
          error: "Bad Request",
          message: "typeId must be a positive integer"
        };
      }
      typeId = parsedTypeId;
    }

    const { data, cache } = await getStructureOrders(request.server.pg.pool, structureId, {
      typeId,
      cache: {
        scope: "private",
        maxAgeSeconds: 120,
        staleWhileRevalidateSeconds: 60
      }
    });

    const cacheControlHeader = refresh
      ? "private, max-age=0, must-revalidate"
      : "private, max-age=120, stale-while-revalidate=60";

    applyCacheHeaders(reply, cacheControlHeader, cache.generatedAt);
    if (refresh) {
      reply.header("Warning", "199 - \"Refresh requested; downstream caches bypassed\"");
    }
    reply.header("X-Schema-Hash", MANIFEST_SCHEMA_HASH);

    return {
      data,
      cache: serializeCacheEnvelope(cache),
      schemaHash: MANIFEST_SCHEMA_HASH
    };
  });

  return app;
}
