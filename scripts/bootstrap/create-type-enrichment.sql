-- Creates shared metadata views for products and materials enrichment
BEGIN;

CREATE SCHEMA IF NOT EXISTS sde_master;

DROP VIEW IF EXISTS sde_master.materials_enriched_v;
DROP VIEW IF EXISTS sde_master.products_enriched_v;
DROP VIEW IF EXISTS sde_master.type_metadata_v;

CREATE OR REPLACE VIEW sde_master.type_metadata_v AS
SELECT
  st.key AS type_key,
  st.type_id,
  st.published,
  st.group_id,
  COALESCE(sg.name ->> 'en', sg.name ->> 'en-us', sg.name ->> 'de', sg.name ->> 'fr', sg.name ->> 'ja', sg.name ->> 'ru', sg.name ->> 'zh', sg.name ->> 'es') AS group_name_en,
  st.market_group_id,
  COALESCE(smg.name ->> 'en', smg.name ->> 'en-us', smg.name ->> 'de', smg.name ->> 'fr', smg.name ->> 'ja', smg.name ->> 'ru', smg.name ->> 'zh', smg.name ->> 'es') AS market_group_name_en,
  st.meta_group_id,
  COALESCE(smmg.name ->> 'en', smmg.name ->> 'en-us', smmg.name ->> 'de', smmg.name ->> 'fr', smmg.name ->> 'ja', smmg.name ->> 'ru', smmg.name ->> 'zh', smmg.name ->> 'es') AS meta_group_name_en,
  sg.category_id,
  COALESCE(sc.name ->> 'en', sc.name ->> 'en-us', sc.name ->> 'de', sc.name ->> 'fr', sc.name ->> 'ja', sc.name ->> 'ru', sc.name ->> 'zh', sc.name ->> 'es') AS category_name_en,
  st.faction_id,
  COALESCE(sf.name ->> 'en', sf.name ->> 'en-us', sf.name ->> 'de', sf.name ->> 'fr', sf.name ->> 'ja', sf.name ->> 'ru', sf.name ->> 'zh', sf.name ->> 'es') AS faction_name_en,
  st.race_id,
  st.mass,
  st.volume,
  st.base_price,
  COALESCE(st.name ->> 'en', st.name ->> 'en-us', st.name ->> 'de', st.name ->> 'fr', st.name ->> 'ja', st.name ->> 'ru', st.name ->> 'zh', st.name ->> 'es') AS type_name_en
FROM sde_types AS st
LEFT JOIN sde_groups AS sg
  ON sg.key = st.group_id
LEFT JOIN sde_categories AS sc
  ON sc.key = sg.category_id
LEFT JOIN sde_market_groups AS smg
  ON smg.key = st.market_group_id
LEFT JOIN sde_meta_groups AS smmg
  ON smmg.key = st.meta_group_id
LEFT JOIN sde_factions AS sf
  ON sf.key = st.faction_id;

CREATE OR REPLACE VIEW sde_master.products_enriched_v AS
SELECT
  p.product_type_id,
  p.blueprint_key,
  p.blueprint_type_id,
  p.product_quantity,
  p.manufacturing_time,
  p.max_production_limit,
  p.activity,
  p.created_at,
  p.updated_at,
  product_meta.type_name_en AS product_name,
  product_meta.group_id AS product_group_id,
  product_meta.group_name_en AS product_group_name,
  product_meta.category_id AS product_category_id,
  product_meta.category_name_en AS product_category_name,
  product_meta.market_group_id AS product_market_group_id,
  product_meta.market_group_name_en AS product_market_group_name,
  product_meta.meta_group_id AS product_meta_group_id,
  product_meta.meta_group_name_en AS product_meta_group_name,
  product_meta.faction_id AS product_faction_id,
  product_meta.faction_name_en AS product_faction_name,
  blueprint_meta.type_name_en AS blueprint_name,
  blueprint_meta.group_id AS blueprint_group_id,
  blueprint_meta.group_name_en AS blueprint_group_name,
  blueprint_meta.category_id AS blueprint_category_id,
  blueprint_meta.category_name_en AS blueprint_category_name
FROM sde_master.products AS p
JOIN sde_master.type_metadata_v AS product_meta
  ON product_meta.type_key = p.product_type_id
LEFT JOIN sde_master.type_metadata_v AS blueprint_meta
  ON blueprint_meta.type_key = p.blueprint_type_id;

CREATE OR REPLACE VIEW sde_master.materials_enriched_v AS
SELECT
  m.product_type_id,
  m.material_type_id,
  m.blueprint_key,
  m.blueprint_type_id,
  m.material_quantity,
  m.activity,
  m.material_group_id,
  m.material_category_id,
  m.material_market_group_id,
  m.material_meta_group_id,
  m.material_faction_id,
  m.created_at,
  m.updated_at,
  product_meta.type_name_en AS product_name,
  product_meta.group_name_en AS product_group_name,
  product_meta.category_name_en AS product_category_name,
  material_meta.type_name_en AS material_name,
  material_meta.group_id AS material_group_id_actual,
  material_meta.group_name_en AS material_group_name_actual,
  material_meta.category_id AS material_category_id_actual,
  material_meta.category_name_en AS material_category_name_actual,
  material_meta.market_group_id AS material_market_group_id_actual,
  material_meta.market_group_name_en AS material_market_group_name_actual,
  material_meta.meta_group_id AS material_meta_group_id_actual,
  material_meta.meta_group_name_en AS material_meta_group_name_actual,
  material_meta.faction_id AS material_faction_id_actual,
  material_meta.faction_name_en AS material_faction_name_actual
FROM sde_master.materials AS m
JOIN sde_master.type_metadata_v AS product_meta
  ON product_meta.type_key = m.product_type_id
JOIN sde_master.type_metadata_v AS material_meta
  ON material_meta.type_key = m.material_type_id;

COMMIT;
