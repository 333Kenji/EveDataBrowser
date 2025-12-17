#!/usr/bin/env node

/**
 * Downloads the latest CCP SDE archive, extracts the fsd YAML files, and loads
 * the resulting type/group/market-group documents into Postgres.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import unzipper from "unzipper";
import YAML from "yaml";
import { Pool } from "pg";
import { spawnSync } from "node:child_process";

const DEFAULT_SDE_URL =
  process.env.SDE_SNAPSHOT_URL ??
  "https://eve-static-data-export.s3-eu-west-1.amazonaws.com/tranquility/sde.zip";
const DEFAULT_OUTPUT_DIR = "data/sde";
const FILES_TO_EXTRACT = [
  "fsd/categories.yaml",
  "fsd/groups.yaml",
  "fsd/marketGroups.yaml",
  "fsd/types.yaml",
];
const LANGUAGE_KEYS = new Set([
  "de",
  "es",
  "fr",
  "it",
  "ja",
  "ko",
  "pl",
  "pt",
  "ru",
  "zh",
  "zh-cn",
  "zh-tw",
  "cs",
  "hu",
  "nl",
  "sv",
  "tr",
  "es-es",
  "es-mx",
  "pt-br",
  "en",
  "en-us",
  "en_us",
  "enus",
  "en-gb",
  "en-gb",
]);
const ENGLISH_KEYS = new Set(["en", "en-us", "en_us", "enus", "en-gb"]);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REQUIRED_HEAP_MB = Number(process.env.SDE_HEAP_MB ?? "4096");
const hasHeapFlag = process.execArgv.some((arg) =>
  arg.startsWith("--max-old-space-size"),
);

if (!hasHeapFlag) {
  const result = spawnSync(
    process.execPath,
    [
      `--max-old-space-size=${REQUIRED_HEAP_MB}`,
      fileURLToPath(import.meta.url),
      ...process.argv.slice(2),
    ],
    { stdio: "inherit", env: process.env },
  );
  process.exit(result.status ?? 1);
}

function printHelp() {
  console.log(`Usage: node ${path.relative(process.cwd(), path.join(__dirname, "check-sde-latest.mjs"))} [options]

Options:
  --output-dir <path>      Directory for downloaded/extracted assets (default: ${DEFAULT_OUTPUT_DIR})
  --database-url <url>     Postgres connection string (default: env.DATABASE_URL or postgres://eveapp:eveapp@db:5432/eveapp)
  --force                  Always download the archive even if the cached ETag matches
  --skip-refresh           Skip refreshing materialized eligibility views after load
  -h, --help               Show this message`);
}

function parseArgs(argv) {
  const options = {
    outputDir: DEFAULT_OUTPUT_DIR,
    databaseUrl:
      process.env.DATABASE_URL ?? "postgresql://eveapp:eveapp@db:5432/eveapp",
    forceDownload: false,
    skipRefresh: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];
    switch (current) {
      case "--output-dir":
        if (!next) throw new Error("--output-dir requires a value");
        options.outputDir = next;
        i += 1;
        break;
      case "--database-url":
        if (!next) throw new Error("--database-url requires a value");
        options.databaseUrl = next;
        i += 1;
        break;
      case "--force":
        options.forceDownload = true;
        break;
      case "--skip-refresh":
        options.skipRefresh = true;
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        console.warn(`[sde] ignoring unknown argument "${current}"`);
    }
  }

  return options;
}

function normalizeEtag(etag) {
  if (!etag) return null;
  return etag.replace(/(^")|("$)/g, "");
}

async function fetchRemoteMetadata(url) {
  const response = await fetch(url, { method: "HEAD" });
  if (!response.ok) {
    throw new Error(
      `failed to fetch SDE metadata (${response.status} ${response.statusText})`,
    );
  }
  return {
    etag: normalizeEtag(response.headers.get("etag")),
    lastModified: response.headers.get("last-modified"),
    contentLength: Number(response.headers.get("content-length") ?? "0"),
  };
}

async function downloadArchive(url, zipPath) {
  console.log("[sde] downloading archive...");
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(
      `failed to download archive (${response.status} ${response.statusText})`,
    );
  }
  await pipeline(response.body, createWriteStream(zipPath));
  console.log("[sde] archive downloaded");
  return {
    etag: normalizeEtag(response.headers.get("etag")),
    lastModified: response.headers.get("last-modified"),
  };
}

async function ensureArchive({ outputDir, forceDownload }) {
  const metaPath = path.join(outputDir, "sde-meta.json");
  const zipPath = path.join(outputDir, "sde.zip");
  let cachedMeta = null;
  try {
    cachedMeta = JSON.parse(await readFile(metaPath, "utf8"));
  } catch {
    cachedMeta = null;
  }

  const remote = await fetchRemoteMetadata(DEFAULT_SDE_URL);
  const needsDownload =
    forceDownload ||
    !cachedMeta ||
    !cachedMeta.etag ||
    cachedMeta.etag !== remote.etag;

  if (!needsDownload) {
    console.log("[sde] cached archive matches remote ETag; skipping download");
    return { zipPath, metaPath, metadata: cachedMeta };
  }

  const downloadMeta = await downloadArchive(DEFAULT_SDE_URL, zipPath);
  const mergedMeta = {
    etag: downloadMeta.etag ?? remote.etag,
    lastModified: downloadMeta.lastModified ?? remote.lastModified ?? null,
    downloadedAt: new Date().toISOString(),
    source: DEFAULT_SDE_URL,
  };
  await writeFile(metaPath, JSON.stringify(mergedMeta, null, 2));
  return { zipPath, metaPath, metadata: mergedMeta };
}

async function extractYamlFiles(zipPath, outputDir) {
  const directory = await unzipper.Open.file(zipPath);
  const results = {};

  await Promise.all(
    FILES_TO_EXTRACT.map(async (entryName) => {
      const target = directory.files.find((file) => file.path === entryName);
      if (!target) {
        throw new Error(`missing ${entryName} in archive`);
      }
      const destination = path.join(outputDir, path.basename(entryName));
      await mkdir(path.dirname(destination), { recursive: true });
      await pipeline(target.stream(), createWriteStream(destination));
      results[entryName] = destination;
    }),
  );

  return results;
}

function sanitizeName(value, fallbackLabel) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    return { en: value };
  }
  return { en: fallbackLabel ?? "" };
}

function pickLocalizedText(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value.replace(/\r\n/g, "\n");
  }
  if (typeof value === "object") {
    return (
      value.en ??
      value["en-us"] ??
      value["en_us"] ??
      value["enUS"] ??
      value["en"] ??
      Object.values(value)[0] ??
      null
    )?.toString().replace(/\r\n/g, "\n");
  }
  return null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function extractEnglishName(nameObject) {
  if (!nameObject || typeof nameObject !== "object") {
    return null;
  }
  const preferredKeys = ["en", "en-us", "en_us", "enus", "en-gb"];
  for (const key of preferredKeys) {
    if (Object.prototype.hasOwnProperty.call(nameObject, key)) {
      const value = nameObject[key];
      if (value !== undefined && value !== null) {
        return value.toString();
      }
    }
  }
  const [firstKey] = Object.keys(nameObject);
  if (!firstKey) {
    return null;
  }
  const fallback = nameObject[firstKey];
  return fallback === undefined || fallback === null
    ? null
    : fallback.toString();
}

function buildGroupRows(document) {
  return Object.entries(document).map(([id, data]) => {
    const groupId = Number(id);
    return {
      key: groupId,
      group_id: groupId,
      category_id: toNumber(data.categoryID),
      name: sanitizeName(data.name, `Group ${groupId}`),
      published: Boolean(data.published),
    };
  });
}

function buildMarketGroupRows(document) {
  return Object.entries(document).map(([id, data]) => {
    const marketGroupId = Number(id);
    return {
      key: marketGroupId,
      market_group_id: marketGroupId,
      name: sanitizeName(data.nameID ?? data.name, `Market Group ${marketGroupId}`),
      parent_group_id: toNumber(data.parentGroupID),
    };
  });
}

function buildTypeRowFromEntry(id, data, categoryByGroupId) {
  const typeId = Number(id);
  const groupId = toNumber(data.groupID);
  const categoryId =
    groupId !== null && groupId !== undefined
      ? categoryByGroupId.get(groupId) ?? null
      : null;

  return {
    key: typeId,
    type_id: typeId,
    name: sanitizeName(data.name ?? data.nameID, `Type ${typeId}`),
    description: pickLocalizedText(data.description),
    published: Boolean(data.published),
    group_id: groupId,
    category_id: categoryId,
    market_group_id: toNumber(data.marketGroupID),
    meta_group_id: toNumber(data.metaGroupID),
    faction_id: toNumber(data.factionID),
    race_id: toNumber(data.raceID),
    mass: toNumber(data.mass),
    volume: toNumber(data.volume),
    base_price: toNumber(data.basePrice ?? data.baseprice),
    portion_size: toNumber(data.portionSize) ?? 1,
  };
}

function buildMasterProductRow(typeRow, maps) {
  return {
    product_type_id: typeRow.type_id,
    product_name: extractEnglishName(typeRow.name),
    product_group_id: typeRow.group_id,
    product_group_name: typeRow.group_id
      ? maps.groupNameById.get(typeRow.group_id) ?? null
      : null,
    product_category_id: typeRow.category_id,
    product_category_name: typeRow.category_id
      ? maps.categoryNameById.get(typeRow.category_id) ?? null
      : null,
    product_market_group_id: typeRow.market_group_id,
    product_market_group_name: maps.marketGroupNameById.get(
      typeRow.market_group_id,
    ) ?? null,
    product_meta_group_id: typeRow.meta_group_id,
    product_meta_group_name: null,
    product_faction_id: typeRow.faction_id,
    product_faction_name: null,
    blueprint_type_id: null,
    blueprint_name: null,
    blueprint_group_id: null,
    blueprint_group_name: null,
    blueprint_category_id: null,
    blueprint_category_name: null,
    product_quantity: typeRow.portion_size ?? 1,
    manufacturing_time: null,
    max_production_limit: null,
    activity: "published",
  };
}

function buildCategoryRows(document) {
  return Object.entries(document).map(([id, data]) => {
    const categoryId = Number(id);
    return {
      key: categoryId,
      category_id: categoryId,
      name: sanitizeName(data.name, `Category ${categoryId}`),
      published: Boolean(data.published),
    };
  });
}

function parseTypeEntry(key, yamlChunk) {
  const tryParse = (chunk) => {
    const parsed = YAML.parse(chunk);
    return parsed?.[key];
  };

  try {
    return tryParse(yamlChunk);
  } catch (error) {
    const sanitizedChunk = yamlChunk
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "'")
      .join("\n");

    try {
      const parsed = tryParse(sanitizedChunk);
      console.warn(
        `[sde] parsed type ${key} after sanitizing stray quote-only lines`,
      );
      return parsed;
    } catch (secondError) {
      const fallback = parseTypeEntryFallback(key, sanitizedChunk);
      if (fallback) {
        console.warn(
          `[sde] parsed type ${key} via fallback after YAML errors: ${error.message} / ${secondError.message}`,
        );
        return fallback;
      }

      console.error(
        `[sde] failed to parse type ${key}: ${error.message}; sanitized retry: ${secondError.message}`,
      );
      throw secondError;
    }
  }
}

function parseTypeEntryFallback(key, chunk) {
  const stripQuotes = (value) => value.replace(/^['"]|['"]$/g, "");
  const getNumber = (field) => {
    const match = chunk.match(new RegExp(`\\n\\s*${field}:\\s*([-0-9.]+)`));
    return match ? Number(match[1]) : null;
  };
  const getBoolean = (field) => {
    const match = chunk.match(new RegExp(`\\n\\s*${field}:\\s*(true|false)`, "i"));
    if (!match) return null;
    return match[1].toLowerCase() === "true";
  };
  const extractSection = (label) => {
    const regex = new RegExp(
      `\\n\\s*${label}:\\s*\\n([\\s\\S]*?)(\\n\\s*[a-zA-Z0-9_]+:|$)`,
      "m",
    );
    const match = regex.exec(chunk);
    return match ? match[1] : null;
  };
  const englishFromSection = (section) => {
    if (!section) return null;
    const match = section.match(/\n?\s*en:\s*(.+)/);
    return match ? stripQuotes(match[1].trim()) : null;
  };

  const nameEn = englishFromSection(extractSection("name"));
  const descriptionEn = englishFromSection(extractSection("description"));

  const entry = {
    name: nameEn ? { en: nameEn } : undefined,
    description: descriptionEn ? { en: descriptionEn } : undefined,
    published: getBoolean("published") ?? false,
    groupID: getNumber("groupID"),
    marketGroupID: getNumber("marketGroupID"),
    metaGroupID: getNumber("metaGroupID"),
    factionID: getNumber("factionID"),
    raceID: getNumber("raceID"),
    mass: getNumber("mass"),
    volume: getNumber("volume"),
    basePrice: getNumber("basePrice") ?? getNumber("baseprice"),
    portionSize: getNumber("portionSize"),
  };

  const hasAnyField =
    Object.values(entry).some((value) => value !== null && value !== undefined) ||
    Object.values(entry.name ?? {}).length > 0 ||
    Object.values(entry.description ?? {}).length > 0;

  return hasAnyField ? entry : null;
}

async function streamYamlMapEntries(filePath, onEntry) {
  const rl = readline.createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let currentKey = null;
  let buffer = [];

  const flush = async () => {
    if (currentKey === null || buffer.length === 0) return;
    const chunk = buffer.join("\n");
    const key = currentKey;
    currentKey = null;
    buffer = [];
    await onEntry(key, chunk);
  };

  for await (const line of rl) {
    const keyMatch = line.match(/^([0-9]+):\s*$/);
    if (keyMatch) {
      if (currentKey !== null) {
        await flush();
      }
      currentKey = keyMatch[1];
      buffer = [line];
      continue;
    }

    if (currentKey === null) {
      continue;
    }

    buffer.push(line);
  }

  if (currentKey !== null && buffer.length > 0) {
    await flush();
  }
}

async function streamTypesAndInsert({
  typesPath,
  client,
  categoryByGroupId,
  groupNameById,
  categoryNameById,
  marketGroupNameById,
}) {
  const typeColumns = [
    "key",
    "type_id",
    "name",
    "description",
    "published",
    "group_id",
    "category_id",
    "market_group_id",
    "meta_group_id",
    "faction_id",
    "race_id",
    "mass",
    "volume",
    "base_price",
  ];
  const productColumns = [
    "product_type_id",
    "product_name",
    "product_group_id",
    "product_group_name",
    "product_category_id",
    "product_category_name",
    "product_market_group_id",
    "product_market_group_name",
    "product_meta_group_id",
    "product_meta_group_name",
    "product_faction_id",
    "product_faction_name",
    "blueprint_type_id",
    "blueprint_name",
    "blueprint_group_id",
    "blueprint_group_name",
    "blueprint_category_id",
    "blueprint_category_name",
    "product_quantity",
    "manufacturing_time",
    "max_production_limit",
    "activity",
  ];

  const typeBatch = [];
  const productBatch = [];

  const flushTypes = async () => {
    if (typeBatch.length === 0) return;
    await insertRows(client, "sde_master.sde_types", typeColumns, typeBatch, {
      batchSize: 250,
    });
    typeBatch.length = 0;
  };

  const flushProducts = async () => {
    if (productBatch.length === 0) return;
    await insertRows(
      client,
      "sde_master.master_products",
      productColumns,
      productBatch,
      { batchSize: 250, conflictColumn: "product_type_id" },
    );
    productBatch.length = 0;
  };

  const maps = { groupNameById, categoryNameById, marketGroupNameById };

  let typeCount = 0;
  let productCount = 0;

  await streamYamlMapEntries(typesPath, async (key, yamlChunk) => {
    const entry = parseTypeEntry(key, yamlChunk);
    if (!entry) return;
    const typeRow = buildTypeRowFromEntry(key, entry, categoryByGroupId);
    typeBatch.push(typeRow);
    typeCount += 1;

    if (typeRow.published && typeRow.market_group_id !== null && typeRow.market_group_id !== undefined) {
      productBatch.push(buildMasterProductRow(typeRow, maps));
      productCount += 1;
    }

    if (typeBatch.length >= 250) {
      await flushTypes();
    }
    if (productBatch.length >= 250) {
      await flushProducts();
    }
  });

  await flushTypes();
  await flushProducts();

  console.log(`[sde] inserted types=${typeCount} products=${productCount}`);
}

async function insertRows(
  client,
  tableName,
  columns,
  records,
  { batchSize = 500, conflictColumn = "key" } = {},
) {
  if (records.length === 0) {
    console.warn(`[sde] no rows provided for ${tableName}; skipping insert`);
    return;
  }

  for (let offset = 0; offset < records.length; offset += batchSize) {
    const slice = records.slice(offset, offset + batchSize);
    const values = [];
    const placeholders = slice.map((record) => {
      const rowPlaceholders = columns.map((column) => {
        values.push(record[column]);
        return `$${values.length}`;
      });
      return `(${rowPlaceholders.join(", ")})`;
    });
    const assignments =
      conflictColumn && columns.includes(conflictColumn)
        ? columns
            .filter((column) => column !== conflictColumn)
            .map((column) => `${column} = EXCLUDED.${column}`)
            .join(", ")
        : null;
    let sql = `INSERT INTO ${tableName} (${columns.join(
      ", ",
    )}) VALUES ${placeholders.join(", ")}`;
    if (conflictColumn && assignments && assignments.length > 0) {
      sql += ` ON CONFLICT (${conflictColumn}) DO UPDATE SET ${assignments}`;
    }
    await client.query(sql, values);
  }
}

async function loadIntoDatabase({
  databaseUrl,
  categoryDoc,
  groupDoc,
  marketGroupDoc,
  typesPath,
  skipRefresh,
}) {
  console.log("[sde] loading data into Postgres...");

  const categoryRows = buildCategoryRows(categoryDoc);
  const groupRows = buildGroupRows(groupDoc);
  const marketGroupRows = buildMarketGroupRows(marketGroupDoc);

  const categoryNameById = new Map(
    categoryRows.map((category) => [
      category.category_id,
      extractEnglishName(category.name),
    ]),
  );
  const groupNameById = new Map(
    groupRows.map((group) => [group.group_id, extractEnglishName(group.name)]),
  );
  const marketGroupNameById = new Map(
    marketGroupRows.map((group) => [
      group.market_group_id,
      extractEnglishName(group.name),
    ]),
  );

  const categoryByGroupId = new Map();
  for (const group of groupRows) {
    categoryByGroupId.set(group.group_id, group.category_id);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE sde_master.master_products");
    await client.query("TRUNCATE sde_master.sde_types");
    await client.query("TRUNCATE sde_master.sde_groups");
    await client.query("TRUNCATE sde_master.sde_market_groups");
    await client.query("TRUNCATE sde_master.sde_categories");

    await insertRows(
      client,
      "sde_master.sde_categories",
      ["key", "category_id", "name", "published"],
      categoryRows,
      { batchSize: 200 },
    );
    await insertRows(
      client,
      "sde_master.sde_groups",
      ["key", "group_id", "category_id", "name", "published"],
      groupRows,
      { batchSize: 1000 },
    );
    await insertRows(
      client,
      "sde_master.sde_market_groups",
      ["key", "market_group_id", "name", "parent_group_id"],
      marketGroupRows,
      { batchSize: 1000 },
    );

    await streamTypesAndInsert({
      typesPath,
      client,
      categoryByGroupId,
      groupNameById,
      categoryNameById,
      marketGroupNameById,
    });

    await client.query("COMMIT");
    console.log(
      `[sde] inserted categories=${categoryRows.length} groups=${groupRows.length} marketGroups=${marketGroupRows.length}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  if (skipRefresh) {
    console.log("[sde] skipping eligibility view refresh");
    return;
  }

  const refreshPool = new Pool({ connectionString: databaseUrl });
  try {
    try {
      await refreshPool.query(
        "REFRESH MATERIALIZED VIEW public.market_eligible_types;",
      );
    } catch (error) {
      if (error.code === "42P01") {
        console.warn(
          "[sde] market_eligible_types view not found; skipping refresh",
        );
      } else {
        throw error;
      }
    }
    try {
      await refreshPool.query(
        "REFRESH MATERIALIZED VIEW public.market_eligible_types_union;",
      );
    } catch (error) {
      if (error.code === "42P01") {
        console.warn(
          "[sde] market_eligible_types_union view not found; continuing",
        );
      } else {
        throw error;
      }
    }
  } finally {
    await refreshPool.end();
  }
  console.log("[sde] refreshed eligibility views");
}

async function run() {
  const options = parseArgs(process.argv);
  const outputDir = path.resolve(process.cwd(), options.outputDir);
  const fsdDir = path.join(outputDir, "fsd");

  await mkdir(outputDir, { recursive: true });
  await mkdir(fsdDir, { recursive: true });

  try {
    const { zipPath, metadata } = await ensureArchive({
      outputDir,
      forceDownload: options.forceDownload,
    });
    const extractedPaths = await extractYamlFiles(zipPath, fsdDir);
    console.log(
      `[sde] using archive etag=${metadata?.etag ?? "unknown"} lastModified=${metadata?.lastModified ?? "unknown"}`,
    );

    const [categoryDoc, groupDoc, marketGroupDoc] = await Promise.all([
      readFile(extractedPaths["fsd/categories.yaml"], "utf8").then((content) =>
        YAML.parse(content),
      ),
      readFile(extractedPaths["fsd/groups.yaml"], "utf8").then((content) =>
        YAML.parse(content),
      ),
      readFile(extractedPaths["fsd/marketGroups.yaml"], "utf8").then((content) =>
        YAML.parse(content),
      ),
    ]);

    await loadIntoDatabase({
      databaseUrl: options.databaseUrl,
      categoryDoc,
      groupDoc,
      marketGroupDoc,
      typesPath: extractedPaths["fsd/types.yaml"],
      skipRefresh: options.skipRefresh,
    });

    console.log("[sde] import complete");
  } catch (error) {
    console.error(`[sde] import failed: ${error.message}`);
    process.exitCode = 1;
  }
}

run();
