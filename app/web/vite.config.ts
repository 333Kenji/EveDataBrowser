import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import type { TaxonomyApiItem } from './src/services/taxonomy-service';

// Add explicit node type reference for this config context (not emitted to build output)
/// <reference types="node" />

const workspaceRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const contractsDistEntry = path.resolve(
  workspaceRoot,
  'packages/contracts/dist/index.js',
);

function normalizeUrl(rawUrl: string | undefined): string {
  if (!rawUrl) {
    return '';
  }

  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    return parsed.pathname.toLowerCase();
  } catch (_error) {
    const [path] = rawUrl.split('?');
    return (path ?? rawUrl).toLowerCase();
  }
}

function sendJson(res: ServerResponse, payload: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload, null, 2));
}

const previewTaxonomySummaries: TaxonomyApiItem[] = [
  {
    typeId: 608,
    name: 'Atron',
    groupId: 25,
    groupName: 'Standard Frigate',
    categoryId: 6,
    categoryName: 'Ships',
    metaGroupId: 1,
    metaGroupName: 'Tech I',
    marketGroupKey: 604,
    marketGroupId: 604,
    marketGroupName: 'Gallente',
    marketGroupPath: [
      { marketGroupKey: 4, marketGroupId: 4, name: 'Ships', parentGroupKey: null },
      { marketGroupKey: 1361, marketGroupId: 1361, name: 'Frigates', parentGroupKey: 4 },
      { marketGroupKey: 602, marketGroupId: 602, name: 'Standard Frigates', parentGroupKey: 1361 },
      { marketGroupKey: 604, marketGroupId: 604, name: 'Gallente', parentGroupKey: 602 },
    ],
    isBlueprintManufactured: true,
    published: true,
  },
  {
    typeId: 587,
    name: 'Rifter',
    groupId: 25,
    groupName: 'Standard Frigate',
    categoryId: 6,
    categoryName: 'Ships',
    metaGroupId: 1,
    metaGroupName: 'Tech I',
    marketGroupKey: 600,
    marketGroupId: 600,
    marketGroupName: 'Minmatar',
    marketGroupPath: [
      { marketGroupKey: 4, marketGroupId: 4, name: 'Ships', parentGroupKey: null },
      { marketGroupKey: 1361, marketGroupId: 1361, name: 'Frigates', parentGroupKey: 4 },
      { marketGroupKey: 602, marketGroupId: 602, name: 'Standard Frigates', parentGroupKey: 1361 },
      { marketGroupKey: 600, marketGroupId: 600, name: 'Minmatar', parentGroupKey: 602 },
    ],
    isBlueprintManufactured: true,
    published: true,
  },
  {
    typeId: 11393,
    name: 'Cormorant',
    groupId: 23,
    groupName: 'Destroyer',
    categoryId: 6,
    categoryName: 'Ships',
    metaGroupId: 1,
    metaGroupName: 'Tech I',
    marketGroupKey: 1368,
    marketGroupId: 1368,
    marketGroupName: 'Destroyers',
    marketGroupPath: [
      { marketGroupKey: 4, marketGroupId: 4, name: 'Ships', parentGroupKey: null },
      { marketGroupKey: 1368, marketGroupId: 1368, name: 'Destroyers', parentGroupKey: 4 },
    ],
    isBlueprintManufactured: true,
    published: true,
  },
  {
    typeId: 12058,
    name: '1MN Afterburner I',
    groupId: 46,
    groupName: 'Afterburner',
    categoryId: 7,
    categoryName: 'Modules',
    metaGroupId: 1,
    metaGroupName: 'Tech I',
    marketGroupKey: 1340,
    marketGroupId: 1340,
    marketGroupName: 'Afterburners',
    marketGroupPath: [
      { marketGroupKey: 9, marketGroupId: 9, name: 'Ship Equipment', parentGroupKey: null },
      { marketGroupKey: 1338, marketGroupId: 1338, name: 'Propulsion Modules', parentGroupKey: 9 },
      { marketGroupKey: 1340, marketGroupId: 1340, name: 'Afterburners', parentGroupKey: 1338 },
    ],
    isBlueprintManufactured: true,
    published: true,
  },
  {
    typeId: 16242,
    name: 'Federation Navy Comet',
    groupId: 1307,
    groupName: 'Assault Frigate',
    categoryId: 6,
    categoryName: 'Ships',
    metaGroupId: 4,
    metaGroupName: 'Faction',
    marketGroupKey: 1370,
    marketGroupId: 1370,
    marketGroupName: 'Gallente Federation Navy',
    marketGroupPath: [
      { marketGroupKey: 4, marketGroupId: 4, name: 'Ships', parentGroupKey: null },
      { marketGroupKey: 1361, marketGroupId: 1361, name: 'Frigates', parentGroupKey: 4 },
      { marketGroupKey: 1369, marketGroupId: 1369, name: 'Empire Frigates', parentGroupKey: 1361 },
      { marketGroupKey: 1370, marketGroupId: 1370, name: 'Gallente Federation Navy', parentGroupKey: 1369 },
    ],
    isBlueprintManufactured: true,
    published: true,
  },
  {
    typeId: 21182,
    name: 'Freki',
    groupId: 1307,
    groupName: 'Assault Frigate',
    categoryId: 6,
    categoryName: 'Ships',
    metaGroupId: 5,
    metaGroupName: 'Special Edition',
    marketGroupKey: 1373,
    marketGroupId: 1373,
    marketGroupName: 'Angel Cartel',
    marketGroupPath: [
      { marketGroupKey: 4, marketGroupId: 4, name: 'Ships', parentGroupKey: null },
      { marketGroupKey: 1361, marketGroupId: 1361, name: 'Frigates', parentGroupKey: 4 },
      { marketGroupKey: 1372, marketGroupId: 1372, name: 'Pirate Frigates', parentGroupKey: 1361 },
      { marketGroupKey: 1373, marketGroupId: 1373, name: 'Angel Cartel', parentGroupKey: 1372 },
    ],
    isBlueprintManufactured: true,
    published: true,
  },
];

function handlePreviewMocks(req: IncomingMessage, res: ServerResponse): boolean {
  const normalizedUrl = normalizeUrl(req.url);

  const taxonomyPaths = ['/v1/taxonomy/search', '/api/v1/taxonomy/search'];
  if (taxonomyPaths.includes(normalizedUrl)) {
    const requestUrl = new URL(req.url ?? '', 'http://localhost');
    const searchQuery = (requestUrl.searchParams.get('q') ?? '').trim().toLowerCase();
    const limitParam = requestUrl.searchParams.get('limit');
    const offsetParam = requestUrl.searchParams.get('offset');

    const parsedLimit = Number(limitParam);
    const parsedOffset = Number(offsetParam);

    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, previewTaxonomySummaries.length)
      : previewTaxonomySummaries.length;
    const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

    const filtered = searchQuery
      ? previewTaxonomySummaries.filter((summary) => summary.name.toLowerCase().includes(searchQuery))
      : previewTaxonomySummaries;
    const safeOffset = Math.max(0, Math.min(offset, filtered.length));
    const paged = filtered.slice(safeOffset, safeOffset + limit);

    console.info('[preview-mock] responding with taxonomy data', {
      query: searchQuery,
      count: filtered.length,
      limit,
      offset: safeOffset,
    });

    res.setHeader('etag', 'preview-mock-schema');
    res.setHeader('cache-control', 'no-store');

    sendJson(res, {
      items: paged,
      pagination: {
        limit,
        offset: safeOffset,
        total: filtered.length,
      },
    });
    return true;
  }

  const healthPaths = ['/api/health', '/health'];
  if (healthPaths.includes(normalizedUrl)) {
    console.info('[preview-mock] responding with health snapshot');
    sendJson(res, {
      overallStatus: 'healthy',
      message: 'Preview mock API responding normally.',
      timestamp: new Date().toISOString(),
    });
    return true;
  }

  const metricsPaths = ['/v1/internal/metrics', '/api/v1/internal/metrics'];
  if (metricsPaths.includes(normalizedUrl)) {
    console.info('[preview-mock] responding with metrics snapshot');
    const now = Date.now();
    sendJson(res, {
      generatedAt: new Date(now).toISOString(),
      cache: {
        hits: 320,
        misses: 80,
        hitRate: 0.8,
        lastInvalidatedAt: new Date(now - 45 * 60 * 1000).toISOString(),
        lastInvalidatedMsAgo: 45 * 60 * 1000,
      },
      requests: {
        totalRequests: 500,
        errorCount: 0,
        averageDurationMs: 120.5,
        maxDurationMs: 340.2,
      },
      schema: {
        hash: 'preview-mock-schema',
        generatedAt: new Date(now - 5 * 60 * 1000).toISOString(),
      },
      ingestion: {
        latestRun: {
          id: 'preview-ingestion',
          status: 'completed',
          schemaHash: 'preview-mock-schema',
          startedAt: new Date(now - 20 * 60 * 1000).toISOString(),
          completedAt: new Date(now - 12 * 60 * 1000).toISOString(),
          durationMs: 8 * 60 * 1000,
          errorCount: 0,
          warningCount: 1,
          lagSeconds: 180,
          datasets: [
            {
              label: 'The Forge',
              regionId: 10000002,
            },
          ],
        },
        note: 'Preview mock metrics payload',
      },
    });
    return true;
  }

  if (normalizedUrl === '/ping' || normalizedUrl === '/api/ping') {
    console.info('[preview-mock] responding with ping snapshot');
    sendJson(res, { ok: true, timestamp: new Date().toISOString() });
    return true;
  }

  return false;
}

function previewMockPlugin(): PluginOption {
  return {
    name: 'preview-mock-api',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handlePreviewMocks(req, res)) {
          next();
        }
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === 'build' ? [] : [previewMockPlugin()])],
  resolve: {
    alias: {
      // Keep API payload validation aligned with data/schema/combined-schema-reference.json (#/types)
  '@evedatabrowser/contracts': contractsDistEntry,
    },
  },
  // Vitest config lives in dedicated *.config.ts files; keep base Vite config lean.
  server: {
    host: '0.0.0.0',
    port: Number(process.env.WEB_PORT) || 5173,
    strictPort: true,
    // Dev proxy so that the frontend can call the API using same-origin paths
    // (e.g. window.location.origin + /v1/...) without needing the absolute VITE_API_BASE_URL.
    // This complements the frontend taxonomy-service candidate base logic and removes
    // reliance on cross-origin fetch for local development when desired.
    proxy: (() => {
  const target = process.env.VITE_PROXY_API || process.env.VITE_API_BASE_URL || 'http://localhost:3400';
      return {
        '/v1': {
          target,
          changeOrigin: true,
        },
        // Allow using window.location.origin + '/api' as a base (frontend builds candidateBases that include origin/api)
        '/api': {
          target,
          changeOrigin: true,
        },
        '/health': {
          target,
          changeOrigin: true,
        },
      };
    })(),
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    proxy: {},
  },
}));
