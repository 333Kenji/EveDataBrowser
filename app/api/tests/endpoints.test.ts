import { afterAll, beforeAll, expect, test } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";
import { mocks } from "./setup.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = createApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

test("GET /api/health mirrors health response", async () => {
  const response = await app.inject({ method: "GET", url: "/api/health" });
  expect(response.statusCode).toBe(200);
  expect(response.headers["cache-control"]).toContain("max-age=30");
  const payload = response.json<{ status: string; timestamp: string }>();
  expect(payload.status).toBe("ok");
  expect(payload.timestamp).toEqual(expect.any(String));
});


test("GET /v1/internal/metrics returns uptime", async () => {
  const response = await app.inject({ method: "GET", url: "/v1/internal/metrics" });
  expect(response.statusCode).toBe(200);
  expect(response.headers["cache-control"]).toContain("max-age=5");

  const payload = response.json<{
    uptimeSeconds: number;
    generatedAt: string;
    schema: { hash: string; generatedAt: string };
    checks: {
      postgres: { status: string; latencyMs: number | null; serverTime?: string | null; error?: string };
      cache: { status: string; policy: { market: { maxAge: number } } };
    };
  }>();

  expect(payload.uptimeSeconds).toBeGreaterThanOrEqual(0);
  expect(payload.generatedAt).toEqual(expect.any(String));
  expect(payload.schema.hash).toBe("e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac");
  expect(payload.schema.generatedAt).toEqual(expect.any(String));
  expect(payload.checks.postgres.status).toBe("ok");
  expect(payload.checks.postgres.latencyMs).toEqual(expect.any(Number));
  expect(payload.checks.cache.policy.market.maxAge).toBe(config.cache.market.maxAge);
});


test("GET /v1/taxonomy/search returns mock list", async () => {
  const response = await app.inject({ method: "GET", url: "/v1/taxonomy/search?q=vex" });
  expect(response.statusCode).toBe(200);
  expect(response.headers["x-schema-hash"]).toBe("e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac");
  const payload = response.json<{
    items: Array<{
      name: string;
      marketGroupPath: Array<{ marketGroupKey: number; name: string | null }>;
      marketGroupKey: number | null;
    }>;
  }>();
  expect(payload.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "Vexor" })
    ])
  );
  const vexor = payload.items.find((item) => item.name === "Vexor");
  expect(vexor?.marketGroupPath?.length).toBeGreaterThan(0);
  expect(vexor?.marketGroupKey).toBe(61);
});

test("GET /v1/items/:typeId returns detail payload with market lineage", async () => {
  const response = await app.inject({ method: "GET", url: "/v1/items/12003" });
  expect(response.statusCode).toBe(200);
  expect(response.headers["x-schema-hash"]).toBe("e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac");
  const payload = response.json<{
    typeId: number;
    marketGroup: {
      id: number | null;
      key: number | null;
      path: Array<{ marketGroupKey: number; name: string | null }>;
    } | null;
  }>();
  expect(payload.typeId).toBe(12003);
  expect(payload.marketGroup).not.toBeNull();
  expect(payload.marketGroup?.key).toBe(61);
  expect(payload.marketGroup?.path.length).toBeGreaterThan(0);
  expect(payload.marketGroup?.path[0]).toEqual(
    expect.objectContaining({ marketGroupKey: expect.any(Number) })
  );
});

test("GET /v1/market/history returns history payload with metadata", async () => {
  const response = await app.inject({ method: "GET", url: "/v1/market/history?typeId=603&regionId=10000002" });
  expect(response.statusCode).toBe(200);
  expect(response.headers["cache-control"]).toContain("max-age=300");
  expect(response.headers["x-schema-hash"]).toBe("e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac");
  const payload = response.json<{ data: Array<{ typeId: number }>; meta: { parameters: { refresh: boolean } } }>();
  expect(payload.data).toHaveLength(1);
  expect(payload.data[0]?.typeId).toBe(603);
  expect(payload.meta.parameters.refresh).toBe(false);
});

test("GET /v1/market/history returns 404 when repository yields no data", async () => {
  mocks.getMarketHistoryMock.mockResolvedValueOnce({
    data: [],
    cache: {
      maxAgeSeconds: 300,
      staleWhileRevalidateSeconds: 120,
      generatedAt: new Date("2025-10-13T10:10:00Z")
    },
    schemaHash: "e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac"
  });

  const response = await app.inject({ method: "GET", url: "/v1/market/history?typeId=999999&regionId=10000002" });
  expect(response.statusCode).toBe(404);
  const payload = response.json<{ meta: { schemaHash: string } }>();
  expect(payload.meta.schemaHash).toBe("e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac");
});

test("GET /v1/market/history rejects invalid ISO timestamps", async () => {
  const response = await app.inject({ method: "GET", url: "/v1/market/history?typeId=603&regionId=10000002&startDate=not-a-date" });
  expect(response.statusCode).toBe(400);
  const payload = response.json<{ message: string }>();
  expect(payload.message).toContain("startDate must be a valid ISO-8601 timestamp");
});

test("GET /v1/market/history rejects descending date ranges", async () => {
  const response = await app.inject({ method: "GET", url: "/v1/market/history?typeId=603&regionId=10000002&startDate=2025-10-14T00:00:00Z&endDate=2025-10-10T00:00:00Z" });
  expect(response.statusCode).toBe(400);
  const payload = response.json<{ message: string }>();
  expect(payload.message).toContain("startDate must be less than or equal to endDate");
});

test("GET /v1/market/history requires a typeId", async () => {
  const response = await app.inject({ method: "GET", url: "/v1/market/history?regionId=10000002" });
  expect(response.statusCode).toBe(400);
  const payload = response.json<{ message: string }>();
  expect(payload.message).toContain("typeId is required");
});

test("GET /v1/market/history sets refresh flag when refresh=1", async () => {
  const response = await app.inject({ method: "GET", url: "/v1/market/history?typeId=603&regionId=10000002&refresh=1" });
  expect(response.statusCode).toBe(200);
  expect(response.headers["cache-control"]).toBe("private, max-age=0, must-revalidate");
  const payload = response.json<{
    meta: {
      cache: { control: string; refreshApplied: boolean };
      parameters: { refresh: boolean };
    };
  }>();
  expect(payload.meta.parameters.refresh).toBe(true);
  expect(payload.meta.cache.control).toBe("private, max-age=0, must-revalidate");
  expect(payload.meta.cache.refreshApplied).toBe(true);
  expect(mocks.getMarketHistoryMock).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ typeId: 603, regionId: 10000002 }),
    expect.objectContaining({ refresh: true })
  );
});

test("GET /v1/market/latest returns snapshot payload", async () => {
  const response = await app.inject({ method: "GET", url: "/v1/market/latest?typeId=603&regionId=10000002" });
  expect(response.statusCode).toBe(200);
  const payload = response.json<{ data: { snapshotMedian: number | null }; meta: { schemaHash: string } }>();
  expect(payload.data.snapshotMedian).toBe(158250000);
  expect(payload.meta.schemaHash).toBe("e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac");
});

test("GET /v1/internal/metrics surfaces postgres errors", async () => {
  mocks.poolQueryMock.mockRejectedValueOnce(new Error("connection refused"));

  const response = await app.inject({ method: "GET", url: "/v1/internal/metrics" });
  expect(response.statusCode).toBe(200);

  const payload = response.json<{
    checks: { postgres: { status: string; error?: string | null } };
  }>();

  expect(payload.checks.postgres.status).toBe("error");
  expect(payload.checks.postgres.error).toContain("connection refused");
});

test("GET /v1/taxonomy/search passes publishedOnly toggles", async () => {
  const withoutPublishedOnly = await app.inject({ method: "GET", url: "/v1/taxonomy/search?q=vex" });
  expect(withoutPublishedOnly.statusCode).toBe(200);
  expect(mocks.searchTaxonomyMock).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ publishedOnly: undefined })
  );

  const allowUnpublished = await app.inject({ method: "GET", url: "/v1/taxonomy/search?q=vex&publishedOnly=0" });
  expect(allowUnpublished.statusCode).toBe(200);
  expect(mocks.searchTaxonomyMock).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ publishedOnly: false })
  );

  const publishedOnly = await app.inject({ method: "GET", url: "/v1/taxonomy/search?q=vex&publishedOnly=1" });
  expect(publishedOnly.statusCode).toBe(200);
  expect(mocks.searchTaxonomyMock).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ publishedOnly: true })
  );
});

test("GET /v1/market/latest returns 404 when snapshot missing", async () => {
  mocks.getMarketLatestStatsMock.mockResolvedValueOnce({
    data: null,
    cache: {
      maxAgeSeconds: 300,
      staleWhileRevalidateSeconds: 120,
      generatedAt: new Date("2025-10-13T10:12:00Z")
    },
    schemaHash: "e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac"
  });

  const response = await app.inject({ method: "GET", url: "/v1/market/latest?typeId=555555&regionId=10000002" });
  expect(response.statusCode).toBe(404);
  const payload = response.json<{ meta: { schemaHash: string } }>();
  expect(payload.meta.schemaHash).toBe("e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac");
});
