-- Derives manufacturing material requirements and populates sde_master.materials
BEGIN;

CREATE SCHEMA IF NOT EXISTS sde_master;

DROP VIEW IF EXISTS sde_master.distinct_material_types_v;
DROP VIEW IF EXISTS sde_master.material_requirements_v;
DROP VIEW IF EXISTS sde_master.reaction_materials_v;
DROP VIEW IF EXISTS sde_master.manufacturing_materials_v;
DROP VIEW IF EXISTS sde_master.materials_enriched_v;

-- Manufacturing material requirements expanded from staging blueprints
CREATE OR REPLACE VIEW sde_master.manufacturing_materials_v AS
SELECT
  mp.blueprint_key,
  mp.blueprint_type_id,
  mp.product_type_id,
  (material ->> 'typeID')::bigint AS material_type_id,
  (material ->> 'quantity')::bigint AS material_quantity
FROM sde_master.manufacturing_products_v AS mp
JOIN stage_sde_blueprints.raw AS bp
  ON (bp.payload ->> '_key')::bigint = mp.blueprint_key
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(bp.payload -> 'activities' -> 'manufacturing' -> 'materials', '[]'::jsonb)
) AS material
JOIN sde_types AS st_material
  ON st_material.key = (material ->> 'typeID')::bigint
WHERE bp.payload -> 'activities' ? 'manufacturing'
  AND material ? 'typeID'
  AND st_material.published IS TRUE;

-- Distinct material type list for enrichment/dedupe validation
CREATE OR REPLACE VIEW sde_master.distinct_material_types_v AS
SELECT DISTINCT material_type_id
FROM sde_master.manufacturing_materials_v;

DROP TABLE IF EXISTS sde_master.materials;

CREATE TABLE sde_master.materials (
  product_type_id bigint NOT NULL,
  material_type_id bigint NOT NULL,
  blueprint_key bigint NOT NULL,
  blueprint_type_id bigint NOT NULL,
  material_quantity bigint NOT NULL,
  activity text NOT NULL DEFAULT 'manufacturing',
  material_group_id bigint,
  material_category_id bigint,
  material_market_group_id bigint,
  material_meta_group_id bigint,
  material_faction_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_type_id, material_type_id, activity)
);

CREATE INDEX sde_master_materials_material_idx
  ON sde_master.materials (material_type_id);

CREATE INDEX sde_master_materials_product_idx
  ON sde_master.materials (product_type_id);

TRUNCATE TABLE sde_master.materials;

INSERT INTO sde_master.materials (
  product_type_id,
  material_type_id,
  blueprint_key,
  blueprint_type_id,
  material_quantity,
  activity,
  material_group_id,
  material_category_id,
  material_market_group_id,
  material_meta_group_id,
  material_faction_id,
  created_at,
  updated_at
)
SELECT
  mm.product_type_id,
  mm.material_type_id,
  mm.blueprint_key,
  mm.blueprint_type_id,
  mm.material_quantity,
  'manufacturing' AS activity,
  st.group_id AS material_group_id,
  sg.category_id AS material_category_id,
  st.market_group_id,
  st.meta_group_id,
  st.faction_id,
  NOW(),
  NOW()
FROM sde_master.manufacturing_materials_v AS mm
JOIN sde_master.products AS prod
  ON prod.product_type_id = mm.product_type_id
 AND prod.blueprint_key = mm.blueprint_key
JOIN sde_types AS st
  ON st.key = mm.material_type_id
LEFT JOIN sde_groups AS sg
  ON sg.key = st.group_id;

COMMIT;
