#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");

const materializeSource = "scripts/bootstrap/materialize-master-tables.sql";
const marketMigrationSource = "persistence/migrations/20251015_add_market_history_unique_indexes.sql";

const definitions = [
  {
    schema: "sde_master",
    table: "master_products",
    name: "master_products_blueprint_type_idx",
    method: "btree",
    columns: ["blueprint_type_id"],
    predicate: "blueprint_type_id IS NOT NULL",
    source: materializeSource
  },
  {
    schema: "sde_master",
    table: "master_products",
    name: "master_products_category_idx",
    method: "btree",
    columns: ["product_category_id"],
    source: materializeSource
  },
  {
    schema: "sde_master",
    table: "master_products",
    name: "master_products_meta_group_idx",
    method: "btree",
    columns: ["product_meta_group_id"],
    predicate: "product_meta_group_id IS NOT NULL",
    source: materializeSource
  },
  {
    schema: "sde_master",
    table: "master_products",
    name: "master_products_product_name_lower_idx",
    method: "btree",
    expressions: ["LOWER(product_name)"],
    source: materializeSource
  },
  {
    schema: "sde_master",
    table: "master_materials",
    name: "master_materials_material_idx",
    method: "btree",
    columns: ["material_type_id"],
    source: materializeSource
  },
  {
    schema: "sde_master",
    table: "master_materials",
    name: "master_materials_product_idx",
    method: "btree",
    columns: ["product_type_id"],
    source: materializeSource
  },
  {
    schema: "sde_master",
    table: "master_materials",
    name: "master_materials_material_name_idx",
    method: "btree",
    columns: ["material_name"],
    source: materializeSource
  },
  {
    schema: "public",
    table: "market_price_history",
    name: "market_price_history_type_region_bucket_key",
    method: "btree",
    columns: ["type_id", "region_id", "ts_bucket_start"],
    source: marketMigrationSource
  },
  {
    schema: "public",
    table: "market_latest_stats",
    name: "market_latest_stats_type_region_key",
    method: "btree",
    columns: ["type_id", "region_id"],
    source: marketMigrationSource
  }
];

const metadata = {
  generatedAt: new Date().toISOString(),
  indexes: definitions.map((definition) => {
    const { schema, table, name, method, columns, expressions, predicate, source } = definition;
    const entry = { schema, table, name, method, source };
    if (Array.isArray(columns) && columns.length > 0) {
      entry.columns = columns;
    }
    if (Array.isArray(expressions) && expressions.length > 0) {
      entry.expressions = expressions;
    }
    if (predicate) {
      entry.predicate = predicate;
    }
    return entry;
  }),
  pending: []
};

const outputPath = resolve(repoRoot, "persistence/manifests/schema-index-metadata.json");

async function main() {
  await writeFile(outputPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  console.log(`Schema index metadata written to ${outputPath}`);
}

main().catch((error) => {
  console.error("Failed to generate schema index metadata:", error);
  process.exitCode = 1;
});
