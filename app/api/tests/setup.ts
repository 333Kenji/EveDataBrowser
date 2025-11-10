import { beforeEach, vi } from "vitest";
import fastifyPlugin from "fastify-plugin";

const poolQueryMock = vi.fn();

const postgresPluginMock = vi.fn(async (app: any) => {
  const pg = { pool: { query: poolQueryMock } };
  app.decorate("pg", pg);
  (app as any).pg = pg;
});

const wrappedPlugin = fastifyPlugin(async (app: any) => {
  await postgresPluginMock(app);
});

vi.mock("../src/plugins/postgres.js", () => ({
  default: wrappedPlugin
}));

const buildDefaultTaxonomyResponse = () => ({
  data: {
    items: [
      {
        typeId: 12003,
        name: "Vexor",
        groupId: 906,
        groupName: "Combat Cruiser",
        categoryId: 6,
        categoryName: "Ship",
        metaGroupId: 14,
        metaGroupName: "Tech II",
        marketGroupKey: 61,
        marketGroupId: 61,
        marketGroupName: "Gallente Cruiser Market",
        marketGroupPath: [
          {
            marketGroupKey: 4,
            marketGroupId: 4,
            name: "Ships",
            parentGroupKey: null
          },
          {
            marketGroupKey: 61,
            marketGroupId: 61,
            name: "Cruisers",
            parentGroupKey: 4
          }
        ],
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
    maxAgeSeconds: 3600,
    staleWhileRevalidateSeconds: 120,
    generatedAt: new Date("2025-10-13T10:00:00Z")
  }
});

const searchTaxonomyMock = vi.fn(async () => buildDefaultTaxonomyResponse());

vi.mock("../src/data/taxonomy.js", () => ({
  searchTaxonomy: searchTaxonomyMock
}));

const buildDefaultItemDetailResponse = () => ({
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
    marketGroupKey: 61,
    marketGroupId: 61,
    marketGroupName: "Cruisers",
    marketGroupPath: [
      {
        marketGroupKey: 4,
        marketGroupId: 4,
        name: "Ships",
        parentGroupKey: null
      },
      {
        marketGroupKey: 61,
        marketGroupId: 61,
        name: "Cruisers",
        parentGroupKey: 4
      }
    ],
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
    generatedAt: new Date("2025-10-13T10:05:00Z")
  }
});

const getItemDetailMock = vi.fn(async () => buildDefaultItemDetailResponse());

vi.mock("../src/data/items.js", () => ({
  getItemDetail: getItemDetailMock
}));

const buildDefaultMarketHistoryResponse = () => ({
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
    generatedAt: new Date("2025-10-13T10:10:00Z")
  },
  schemaHash: "e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac"
});

const buildDefaultMarketLatestResponse = () => ({
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
    generatedAt: new Date("2025-10-13T10:12:00Z")
  },
  schemaHash: "e7c02046d71511e0a0999af6cda1d67c250e5ca813c2e0bb428d0209452635ac"
});

const getMarketHistoryMock = vi.fn(async () => buildDefaultMarketHistoryResponse());
const getMarketLatestStatsMock = vi.fn(async () => buildDefaultMarketLatestResponse());

vi.mock("../src/data/market.js", () => ({
  getMarketHistory: getMarketHistoryMock,
  getMarketLatestStats: getMarketLatestStatsMock
}));

beforeEach(() => {
  poolQueryMock.mockReset();
  poolQueryMock.mockResolvedValue({ rows: [{ now: new Date("2025-10-13T10:00:00Z") }] });
  searchTaxonomyMock.mockReset();
  searchTaxonomyMock.mockResolvedValue(buildDefaultTaxonomyResponse());
  getItemDetailMock.mockReset();
  getItemDetailMock.mockResolvedValue(buildDefaultItemDetailResponse());
  getMarketHistoryMock.mockReset();
  getMarketHistoryMock.mockResolvedValue(buildDefaultMarketHistoryResponse());
  getMarketLatestStatsMock.mockReset();
  getMarketLatestStatsMock.mockResolvedValue(buildDefaultMarketLatestResponse());
});

export const mocks = {
  poolQueryMock,
  searchTaxonomyMock,
  getItemDetailMock,
  getMarketHistoryMock,
  getMarketLatestStatsMock,
  postgresPluginMock
};
