import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface ManifestColumn {
  readonly name: string;
  readonly sourceProperty?: string;
  readonly sourcePath?: string;
  readonly sqlType: string;
  readonly nullable: boolean;
  readonly primaryKey: boolean;
  readonly defaultValue?: string | number | boolean | null;
}

interface ManifestTable {
  readonly entity: string;
  readonly tableName: string;
  readonly schema?: string;
  readonly schemaPath?: string;
  readonly columns: readonly ManifestColumn[];
}

interface SchemaManifest {
  readonly schemaHash: string;
  readonly generatedAt: string;
  readonly tables: readonly ManifestTable[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const manifestPath = path.resolve(repoRoot, "persistence/manifests/schema-manifest.json");
const outputDir = path.resolve(__dirname, "../src/generated");
const domainTypesFile = path.resolve(outputDir, "domain-types.ts");
const validationSchemasFile = path.resolve(outputDir, "validation-schemas.ts");

const SQL_TYPE_TO_TS: Record<string, string> = {
  BIGINT: "number",
  INTEGER: "number",
  SMALLINT: "number",
  SERIAL: "number",
  BIGSERIAL: "number",
  "DOUBLE PRECISION": "number",
  REAL: "number",
  NUMERIC: "string",
  DECIMAL: "string",
  BOOLEAN: "boolean",
  TEXT: "string",
  VARCHAR: "string",
  UUID: "string",
  TIMESTAMP: "string",
  TIMESTAMPTZ: "string",
  "TIMESTAMP WITH TIME ZONE": "string",
  "TIMESTAMP WITHOUT TIME ZONE": "string",
  DATE: "string",
  TIME: "string",
  JSON: "JsonValue",
  JSONB: "JsonValue"
};

const SQL_TYPE_TO_ZOD: Record<string, string> = {
  BIGINT: "z.number().int()",
  INTEGER: "z.number().int()",
  SMALLINT: "z.number().int()",
  SERIAL: "z.number().int()",
  BIGSERIAL: "z.number().int()",
  "DOUBLE PRECISION": "z.number()",
  REAL: "z.number()",
  NUMERIC: "z.string()",
  DECIMAL: "z.string()",
  BOOLEAN: "z.boolean()",
  TEXT: "z.string()",
  VARCHAR: "z.string()",
  UUID: "z.string().uuid()",
  TIMESTAMP: "z.string()",
  TIMESTAMPTZ: "z.string()",
  "TIMESTAMP WITH TIME ZONE": "z.string()",
  "TIMESTAMP WITHOUT TIME ZONE": "z.string()",
  DATE: "z.string()",
  TIME: "z.string()",
  JSON: "jsonValueSchema",
  JSONB: "jsonValueSchema"
};

function toPascalCase(value: string): string {
  return value
    .split(/[_\s]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

function resolveTsType(sqlType: string, isNullable: boolean): string {
  const normalized = sqlType.trim().toUpperCase();
  const baseType = SQL_TYPE_TO_TS[normalized] ?? "unknown";
  return isNullable ? `${baseType} | null` : baseType;
}

function createColumnComment(table: ManifestTable, column: ManifestColumn): string {
  const schemaPath = column.sourcePath ?? table.schemaPath ?? "";
  const sourceDescriptor = schemaPath ? ` – ${schemaPath}` : "";
  const columnName = table.schema ? `${table.schema}.${table.tableName}.${column.name}` : `${table.tableName}.${column.name}`;
  const sourceProperty = column.sourceProperty ? ` (source property: ${column.sourceProperty})` : "";
  return `Column ${columnName}${sourceDescriptor}${sourceProperty}`;
}

async function ensureOutputDir(): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
}

async function loadManifest(): Promise<SchemaManifest> {
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw) as SchemaManifest;
}

function buildHeader(manifest: SchemaManifest): string {
  return `// AUTO-GENERATED FILE - DO NOT EDIT\n// Generated from persistence/manifests/schema-manifest.json\n// Schema hash: ${manifest.schemaHash}\n// Generated at: ${manifest.generatedAt}\n\n`;
}

function buildJsonValueType(): string {
  return `export type JsonPrimitive = string | number | boolean | null;\nexport type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };\n\n`;
}

function buildInterface(table: ManifestTable): { name: string; content: string } {
  const interfaceName = `${toPascalCase(table.tableName)}Row`;
  const tableDescriptor = table.schema ? `${table.schema}.${table.tableName}` : table.tableName;
  const lines: string[] = [];
  lines.push(`/**`);
  lines.push(` * Row projection for ${tableDescriptor}.`);
  if (table.schemaPath) {
    lines.push(` * Source schema path: ${table.schemaPath}`);
  }
  lines.push(` */`);
  lines.push(`export interface ${interfaceName} {`);

  for (const column of table.columns) {
    const comment = createColumnComment(table, column);
    const tsType = resolveTsType(column.sqlType, column.nullable);
    lines.push(`  /** ${comment} */`);
    lines.push(`  readonly ${column.name}: ${tsType};`);
  }

  lines.push(`}\n`);
  return { name: interfaceName, content: lines.join("\n") };
}

function resolveZodType(sqlType: string): string {
  const normalized = sqlType.trim().toUpperCase();
  return SQL_TYPE_TO_ZOD[normalized] ?? "z.unknown()";
}

function buildZodSchema(table: ManifestTable, interfaceName: string): string {
  const schemaDescriptor = table.schemaPath ?? "data/schema/combined-schema-reference.json";
  const tableDescriptor = table.schema ? `${table.schema}.${table.tableName}` : table.tableName;
  const objectLines = table.columns.map((column) => {
    const comment = createColumnComment(table, column);
    const baseExpression = resolveZodType(column.sqlType);
    const expression = column.nullable ? `${baseExpression}.nullable()` : baseExpression;
    return `  ${column.name}: ${expression}.describe(${JSON.stringify(comment)}),`;
  });

  return `export const ${interfaceName}Schema: z.ZodType<${interfaceName}> = z.object({\n${objectLines.join("\n")}\n}).strict().describe(${JSON.stringify(`${tableDescriptor} (${schemaDescriptor})`)});\n`;
}

(async () => {
  const manifest = await loadManifest();
  await ensureOutputDir();

  const sortedTables = [...manifest.tables].sort((a, b) => a.tableName.localeCompare(b.tableName));

  const domainPieces: string[] = [];
  const schemaPieces: string[] = [];
  const interfaceNames: string[] = [];

  domainPieces.push(buildHeader(manifest));
  domainPieces.push(buildJsonValueType());

  for (const table of sortedTables) {
    const { name, content } = buildInterface(table);
    interfaceNames.push(name);
    domainPieces.push(content);
  }

  const importClause = interfaceNames.length > 0
    ? `import type { JsonValue, ${interfaceNames.join(", ")} } from "./domain-types.js";`
    : `import type { JsonValue } from "./domain-types.js";`;

  schemaPieces.push(buildHeader(manifest));
  schemaPieces.push(
    `import { z } from "zod";\n${importClause}\n\nconst jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([\n  z.string(),\n  z.number(),\n  z.boolean(),\n  z.null(),\n  z.array(jsonValueSchema),\n  z.record(jsonValueSchema)\n]));\n\n`
  );

  sortedTables.forEach((table, index) => {
    const interfaceName = interfaceNames[index];
    schemaPieces.push(buildZodSchema(table, interfaceName));
  });

  const manifestEntries = sortedTables
    .map((table, index) => `  ${table.tableName}: ${interfaceNames[index]}Schema`)
    .join(",\n");

  schemaPieces.push(`\nexport const manifestSchemas = {\n${manifestEntries}\n} as const;\n`);

  await fs.writeFile(domainTypesFile, domainPieces.join(""), "utf8");
  await fs.writeFile(validationSchemasFile, schemaPieces.join(""), "utf8");
})();
