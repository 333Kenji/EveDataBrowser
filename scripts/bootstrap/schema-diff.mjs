#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function loadManifest() {
  const manifestPath = resolve(__dirname, '../../persistence/manifests/schema-manifest.json');
  const raw = await readFile(manifestPath, 'utf8');
  return JSON.parse(raw);
}

function buildManifestIndex(manifest) {
  const tables = new Map();
  for (const entry of manifest.tables ?? []) {
    const key = `${entry.schema}.${entry.tableName}`;
    const columns = new Set(entry.columns.map((col) => col.name));
    tables.set(key, columns);
  }
  return tables;
}

async function loadDatabaseColumns(client) {
  const query = `
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name, ordinal_position
  `;

  const result = await client.query(query);
  const tables = new Map();
  for (const row of result.rows) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!tables.has(key)) {
      tables.set(key, new Set());
    }
    tables.get(key).add(row.column_name);
  }
  return tables;
}

function diff(manifestTables, dbTables) {
  const missingTables = [];
  const missingColumns = [];
  const extraTables = [];

  for (const [tableKey, expectedColumns] of manifestTables.entries()) {
    if (!dbTables.has(tableKey)) {
      missingTables.push(tableKey);
      continue;
    }
    const actualColumns = dbTables.get(tableKey);
    for (const column of expectedColumns) {
      if (!actualColumns.has(column)) {
        missingColumns.push(`${tableKey}.${column}`);
      }
    }
  }

  for (const tableKey of dbTables.keys()) {
    if (!manifestTables.has(tableKey)) {
      extraTables.push(tableKey);
    }
  }

  return { missingTables, missingColumns, extraTables };
}

async function main() {
  const manifest = await loadManifest();
  const manifestTables = buildManifestIndex(manifest);

  const connectionString = process.env.SCHEMA_DIFF_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Set SCHEMA_DIFF_DATABASE_URL or DATABASE_URL to run the schema diff.');
    process.exitCode = 1;
    return;
  }

  const ssl = process.env.SCHEMA_DIFF_USE_SSL === '1' ? { rejectUnauthorized: false } : undefined;
  const client = new Client({ connectionString, ssl });

  try {
    await client.connect();
    const dbTables = await loadDatabaseColumns(client);
    const { missingTables, missingColumns, extraTables } = diff(manifestTables, dbTables);

    console.log('Schema diff vs manifest:');
    if (missingTables.length === 0 && missingColumns.length === 0) {
      console.log('  ✓ Database tables and columns match the manifest.');
    } else {
      if (missingTables.length > 0) {
        console.log('  Missing tables:');
        for (const table of missingTables) {
          console.log(`    • ${table}`);
        }
      }
      if (missingColumns.length > 0) {
        console.log('  Missing columns:');
        for (const col of missingColumns) {
          console.log(`    • ${col}`);
        }
      }
      process.exitCode = 1;
    }

    if (extraTables.length > 0) {
      console.log('  Extra tables present (not tracked by manifest):');
      for (const table of extraTables) {
        console.log(`    • ${table}`);
      }
    }
  } catch (error) {
    console.error('Failed to compute schema diff:', error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
