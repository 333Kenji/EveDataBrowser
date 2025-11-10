import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";
import { searchTaxonomy } from "../src/data/taxonomy.js";
import { getItemDetail } from "../src/data/items.js";
import { getMarketHistory, getMarketLatestStats } from "../src/data/market.js";
import { mocks } from "./setup";

const searchTaxonomyMock = vi.mocked(searchTaxonomy);
const getItemDetailMock = vi.mocked(getItemDetail);
const getMarketHistoryMock = vi.mocked(getMarketHistory);
const getMarketLatestStatsMock = vi.mocked(getMarketLatestStats);

describe("API cache behaviour", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createApp();
    await app.ready();
    expect(mocks.postgresPluginMock).toHaveBeenCalled();
    expect((app as any).pg).toBeDefined();
  });

  afterAll(async () => {
    await app.close();
  });

  it("applies taxonomy cache envelope metadata to headers", async () => {
    const generatedAt = new Date("2025-10-13T12:34:56Z");

    searchTaxonomyMock.mockResolvedValueOnce({
      data: {
        items: [
          {
            typeId: 587,
            name: "Rifter",
            groupId: 25,
            groupName: "Standard Frigate",
            categoryId: 6,
            categoryName: "Ship",
            metaGroupId: 1,
            metaGroupName: "Tech I",
            isBlueprintManufactured: true,
            published: true
          }
        ],
        limit: 25,
        offset: 0,
        total: 1
      },
      cache: {
        scope: "public",
        maxAgeSeconds: 7200,
        staleWhileRevalidateSeconds: 180,
        generatedAt
      }
    });

    const response = await app.inject({ method: "GET", url: "/v1/taxonomy/search?q=rif" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=3600, stale-while-revalidate=120");
    expect(response.headers.date).toBe(generatedAt.toUTCString());
  expect(response.headers["x-schema-hash"]).toBe("e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac");
    expect(searchTaxonomyMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        cache: expect.objectContaining({
          maxAgeSeconds: 3600,
          staleWhileRevalidateSeconds: 120
        })
      })
    );
  });

  it("returns item detail payload with cache headers and honours includeUnpublished", async () => {
    const generatedAt = new Date("2025-10-13T15:20:00Z");

    getItemDetailMock.mockResolvedValueOnce({
      data: {
        typeId: 12003,
        name: "Vexor",
        description: "Gallente combat cruiser",
        published: true,
        groupId: 906,
        groupName: "Combat Cruiser",
        categoryId: 6,
        categoryName: "Ship",
        metaGroupId: 14,
        metaGroupName: "Tech II",
    metaLevel: 5,
    marketGroupKey: null,
    marketGroupId: null,
    marketGroupName: null,
    marketGroupPath: [],
        factionId: null,
        factionName: null,
        raceId: 8,
        mass: 11300000,
        volume: 115000,
        basePrice: 8199990,
        blueprint: {
          blueprintTypeId: 3353,
          blueprintName: "Vexor Blueprint",
          activity: "manufacturing",
          productQuantity: 1,
          manufacturingTime: 375000,
          maxProductionLimit: 200
        },
        materials: [
          {
            materialTypeId: 34,
            materialName: "Tritanium",
            quantity: 343500,
            groupId: 18,
            groupName: "Mineral"
          }
        ]
      },
      cache: {
        scope: "public",
        maxAgeSeconds: 3600,
        staleWhileRevalidateSeconds: 120,
        generatedAt
      }
    });

    const response = await app.inject({ method: "GET", url: "/v1/items/12003?includeUnpublished=false" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=3600, stale-while-revalidate=120");
    expect(response.headers.date).toBe(generatedAt.toUTCString());
  expect(response.headers["x-schema-hash"]).toBe("e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac");
    expect(response.json()).toMatchObject({
      typeId: 12003,
      name: "Vexor",
      materials: [
        expect.objectContaining({
          materialName: "Tritanium",
          quantity: 343500
        })
      ]
    });
    expect(getItemDetailMock).toHaveBeenCalledWith(
      expect.anything(),
      12003,
      expect.objectContaining({
        includeUnpublished: false,
        cache: expect.objectContaining({
          maxAgeSeconds: 3600,
          staleWhileRevalidateSeconds: 120
        })
      })
    );
  });

  it("returns 404 with cache headers when the item detail is missing", async () => {
    const generatedAt = new Date("2025-10-13T18:00:00Z");

    getItemDetailMock.mockResolvedValueOnce({
      data: null,
      cache: {
        scope: "public",
        maxAgeSeconds: 3600,
        staleWhileRevalidateSeconds: 120,
        generatedAt
      }
    });

    const response = await app.inject({ method: "GET", url: "/v1/items/999999" });

    expect(response.statusCode).toBe(404);
    expect(response.statusCode).toBe(404);
    expect(response.headers["cache-control"]).toBe("public, max-age=3600, stale-while-revalidate=120");
    expect(response.headers.date).toBe(generatedAt.toUTCString());
  expect(response.headers["x-schema-hash"]).toBe("e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac");
    expect(response.json()).toMatchObject({
      statusCode: 404,
      error: "Not Found"
    });
  });

  it("applies market history cache envelope metadata to headers", async () => {
    const generatedAt = new Date("2025-10-13T10:10:00Z");

    getMarketHistoryMock.mockResolvedValueOnce({
      data: [
        {
          typeId: 603,
          regionId: 10000002,
          bucketStart: "2025-10-12T00:00:00.000Z",
          averagePrice: 158900000,
          highPrice: 160000000,
          lowPrice: 155000000,
          medianPrice: 158000000,
          volume: 12,
          orderCount: 6,
          source: "postgres",
          lastIngestedAt: "2025-10-12T19:00:00.000Z"
        }
      ],
      cache: {
        scope: "public",
        maxAgeSeconds: 300,
        staleWhileRevalidateSeconds: 120,
        generatedAt
      },
      schemaHash: "hash-test"
    });

    const response = await app.inject({ method: "GET", url: "/v1/market/history?typeId=603&regionId=10000002" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=300, stale-while-revalidate=120");
    expect(response.headers.date).toBe(generatedAt.toUTCString());
    expect(response.headers["x-schema-hash"]).toBe("hash-test");
    expect(getMarketHistoryMock).toHaveBeenCalledTimes(1);
  });

  it("returns 404 for market history with cache headers when repository yields no rows", async () => {
    const generatedAt = new Date("2025-10-13T10:15:00Z");

    getMarketHistoryMock.mockResolvedValueOnce({
      data: [],
      cache: {
        scope: "public",
        maxAgeSeconds: 300,
        staleWhileRevalidateSeconds: 120,
        generatedAt
      },
      schemaHash: "hash-empty"
    });

    const response = await app.inject({ method: "GET", url: "/v1/market/history?typeId=999999&regionId=10000002" });

    expect(response.statusCode).toBe(404);
    expect(response.headers["cache-control"]).toBe("public, max-age=300, stale-while-revalidate=120");
    expect(response.headers.date).toBe(generatedAt.toUTCString());
    expect(response.headers["x-schema-hash"]).toBe("hash-empty");
  });

  it("applies market latest cache envelope metadata to headers", async () => {
    const generatedAt = new Date("2025-10-13T10:20:00Z");

    getMarketLatestStatsMock.mockResolvedValueOnce({
      data: {
        typeId: 603,
        regionId: 10000002,
        lastSeenAt: "2025-10-12T18:59:00.000Z",
        snapshotLow: 156000000,
        snapshotHigh: 160500000,
        snapshotMedian: 158250000,
        snapshotVolume: 43,
        source: "postgres",
        updatedAt: "2025-10-12T19:05:00.000Z"
      },
      cache: {
        scope: "public",
        maxAgeSeconds: 300,
        staleWhileRevalidateSeconds: 120,
        generatedAt
      },
      schemaHash: "hash-snapshot"
    });

    const response = await app.inject({ method: "GET", url: "/v1/market/latest?typeId=603&regionId=10000002" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=300, stale-while-revalidate=120");
    expect(response.headers.date).toBe(generatedAt.toUTCString());
    expect(response.headers["x-schema-hash"]).toBe("hash-snapshot");
    expect(getMarketLatestStatsMock).toHaveBeenCalledTimes(1);
  });

  it("returns 404 for market latest with cache headers when snapshot missing", async () => {
    const generatedAt = new Date("2025-10-13T10:25:00Z");

    getMarketLatestStatsMock.mockResolvedValueOnce({
      data: null,
      cache: {
        scope: "public",
        maxAgeSeconds: 300,
        staleWhileRevalidateSeconds: 120,
        generatedAt
      },
      schemaHash: "hash-none"
    });

    const response = await app.inject({ method: "GET", url: "/v1/market/latest?typeId=888888&regionId=10000002" });

    expect(response.statusCode).toBe(404);
    expect(response.headers["cache-control"]).toBe("public, max-age=300, stale-while-revalidate=120");
    expect(response.headers.date).toBe(generatedAt.toUTCString());
    expect(response.headers["x-schema-hash"]).toBe("hash-none");
  });
});
