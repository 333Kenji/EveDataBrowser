import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const manifestPath = path.resolve(repoRoot, "persistence/manifests/schema-manifest.json");
const outputDir = path.resolve(__dirname, "../src/generated");
const outputFile = path.resolve(outputDir, "domain-types.ts");
const SQL_TYPE_TO_TS = {
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
function toPascalCase(value) {
    return value
        .split(/[_\s]+/g)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join("");
}
function resolveTsType(sqlType, isNullable) {
    const normalized = sqlType.trim().toUpperCase();
    const baseType = SQL_TYPE_TO_TS[normalized] ?? "unknown";
    return isNullable ? `${baseType} | null` : baseType;
}
function createColumnComment(table, column) {
    const schemaPath = column.sourcePath ?? table.schemaPath ?? "";
    const sourceDescriptor = schemaPath ? ` – ${schemaPath}` : "";
    const columnName = table.schema ? `${table.schema}.${table.tableName}.${column.name}` : `${table.tableName}.${column.name}`;
    const sourceProperty = column.sourceProperty ? ` (source property: ${column.sourceProperty})` : "";
    return `Column ${columnName}${sourceDescriptor}${sourceProperty}`;
}
async function ensureOutputDir() {
    await fs.mkdir(outputDir, { recursive: true });
}
async function loadManifest() {
    const raw = await fs.readFile(manifestPath, "utf8");
    return JSON.parse(raw);
}
function buildHeader(manifest) {
    return `// AUTO-GENERATED FILE - DO NOT EDIT
// Generated from persistence/manifests/schema-manifest.json
// Schema hash: ${manifest.schemaHash}
// Generated at: ${manifest.generatedAt}

`;
}
function buildJsonValueType() {
    return `export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

`;
}
function buildInterface(table) {
    const interfaceName = `${toPascalCase(table.tableName)}Row`;
    const tableDescriptor = table.schema ? `${table.schema}.${table.tableName}` : table.tableName;
    const lines = [];
    lines.push(`/**`);
    lines.push(` * Row projection for ${tableDescriptor}.`);
    if (table.schemaPath) {
        lines.push(` * Source schema path: ${table.schemaPath}`);
    }
    lines.push(` */`);
    lines.push(`export interface ${interfaceName} {`);
    for (const column of table.columns) {
        const propertyName = column.name;
        const tsType = resolveTsType(column.sqlType, column.nullable);
        const comment = createColumnComment(table, column);
        const readonlyKeyword = "readonly";
        lines.push(`  /** ${comment} */`);
        lines.push(`  ${readonlyKeyword} ${propertyName}: ${tsType};`);
    }
    lines.push(`}
`);
    return lines.join("\n");
}
(async () => {
    const manifest = await loadManifest();
    await ensureOutputDir();
    const sortedTables = [...manifest.tables].sort((a, b) => a.tableName.localeCompare(b.tableName));
    const pieces = [];
    pieces.push(buildHeader(manifest));
    pieces.push(buildJsonValueType());
    for (const table of sortedTables) {
        pieces.push(buildInterface(table));
    }
    const content = pieces.join("");
    await fs.writeFile(outputFile, content, "utf8");
})();
//# sourceMappingURL=generate-domain.js.map