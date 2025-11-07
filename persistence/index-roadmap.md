# Schema Index Notes — 2025-10-15 Update

## Implemented Indexes
- Added `master_products_product_name_lower_idx` to support case-insensitive taxonomy search.
- Added `master_materials_material_name_idx` to accelerate ordering by material name.
- Regenerated `persistence/manifests/schema-index-metadata.json` via `npm run schema:indexes` so the functional expression index is captured alongside existing metadata.

## Reference Scripts
- `scripts/bootstrap/materialize-master-tables.sql` now emits all taxonomy/material indexes, including the new functional variant.
- `scripts/bootstrap/generate-schema-index-metadata.mjs` rebuilds `schema-index-metadata.json` whenever materialisation SQL changes.

## Next Steps
- Monitor taxonomy search latency after the next ingestion refresh to measure improvements.
- When additional index requirements emerge, document them here and extend the generation scripts in tandem with manifest updates.
