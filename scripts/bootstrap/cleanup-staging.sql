-- Drops all stage_sde_* schemas after successful master table verification
DO $$
DECLARE
  rec record;
  total_bytes bigint;
  message text;
BEGIN
  SELECT COALESCE(SUM(pg_total_relation_size(format('%I.%I', table_schema, table_name))), 0)
  INTO total_bytes
  FROM information_schema.tables
  WHERE table_schema LIKE 'stage_sde_%';

  message := format('Dropping stage_sde_* schemas after verification (approx %s freed).',
    pg_size_pretty(total_bytes));

  IF total_bytes > 0 THEN
    CALL sde_master.log_cleanup_event('info', message, NULL, NULL);
  ELSE
    CALL sde_master.log_cleanup_event('info', 'No stage_sde_* schemas found during cleanup.', NULL, NULL);
  END IF;

  FOR rec IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'stage_sde_%'
  LOOP
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE;', rec.schema_name);
  END LOOP;
END;
$$;

-- Retire intermediate views and tables once master tables are materialised
DROP VIEW IF EXISTS sde_master.materials_enriched_v;
DROP VIEW IF EXISTS sde_master.products_enriched_v;
DROP VIEW IF EXISTS sde_master.type_metadata_v;
DROP VIEW IF EXISTS sde_master.manufacturing_materials_v;
DROP VIEW IF EXISTS sde_master.manufacturing_products_v;
DROP VIEW IF EXISTS sde_master.distinct_material_types_v;

DROP TABLE IF EXISTS sde_master.materials;
DROP TABLE IF EXISTS sde_master.products;
