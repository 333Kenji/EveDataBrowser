import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("../src/data/structure-orders.js", () => {
  const getStructureOrders = vi.fn(async () => ({
    data: [
      {
        structureId: 123,
        orderId: 1,
        typeId: 603,
        isBuyOrder: false,
        price: 100,
        volumeRemain: 3,
        issuedAt: "2025-10-10T00:00:00Z",
        lastUpdatedAt: "2025-10-10T01:00:00Z"
      }
    ],
    cache: {
      scope: "private",
      maxAgeSeconds: 120,
      staleWhileRevalidateSeconds: 60,
      generatedAt: new Date("2025-10-13T10:00:00.000Z")
    }
  }));
  return { getStructureOrders };
});

const { getStructureOrders } = await import("../src/data/structure-orders.js");
const mockedGetStructureOrders = vi.mocked(getStructureOrders);

let app: FastifyInstance;

beforeAll(async () => {
  vi.stubEnv("FEATURE_STRUCTURE_ORDERS", "true");
  vi.stubEnv("STRUCTURE_ORDER_STRUCTURE_IDS", "123,456");
  vi.resetModules();
  const module = await import("../src/app.js");
  app = module.createApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("structure orders API", () => {
  beforeEach(() => {
    mockedGetStructureOrders.mockClear();
  });

  it("returns private structure orders when feature enabled", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/market/structures/123/orders" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, max-age=120, stale-while-revalidate=60");
    const payload = response.json<{ data: Array<{ orderId: number }>; cache: { scope: string }; schemaHash: string }>();
    expect(payload.data[0]?.orderId).toBe(1);
    expect(payload.cache.scope).toBe("private");
    expect(payload.schemaHash).toBe("e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac");
    expect(mockedGetStructureOrders).toHaveBeenCalledWith(
      expect.anything(),
      123,
      expect.objectContaining({
        cache: expect.anything(),
        typeId: undefined
      })
    );
  });

  it("passes typeId filter through to the data layer", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/market/structures/123/orders?typeId=603" });
    expect(response.statusCode).toBe(200);
    expect(mockedGetStructureOrders).toHaveBeenCalledWith(
      expect.anything(),
      123,
      expect.objectContaining({
        typeId: 603
      })
    );
  });

  it("rejects invalid typeId filters", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/market/structures/123/orders?typeId=abc" });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      message: "typeId must be a positive integer"
    });
  });
});
