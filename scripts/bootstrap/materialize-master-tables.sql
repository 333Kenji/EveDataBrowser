-- Materialises enriched manufacturing datasets into persistent master tables
BEGIN;

CREATE SCHEMA IF NOT EXISTS sde_master;

DROP TABLE IF EXISTS sde_master.master_products;

CREATE TABLE sde_master.master_products (
  product_type_id bigint PRIMARY KEY,
  product_name text NOT NULL,
  product_group_id bigint,
  product_group_name text,
  product_category_id bigint,
  product_category_name text,
  product_market_group_id bigint,
  product_market_group_name text,
  product_meta_group_id bigint,
  product_meta_group_name text,
  product_faction_id bigint,
  product_faction_name text,
  blueprint_type_id bigint,
  blueprint_name text,
  blueprint_group_id bigint,
  blueprint_group_name text,
  blueprint_category_id bigint,
  blueprint_category_name text,
  product_quantity bigint,
  manufacturing_time bigint,
  max_production_limit bigint,
  activity text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO sde_master.master_products (
  product_type_id,
  product_name,
  product_group_id,
  product_group_name,
  product_category_id,
  product_category_name,
  product_market_group_id,
  product_market_group_name,
  product_meta_group_id,
  product_meta_group_name,
  product_faction_id,
  product_faction_name,
  blueprint_type_id,
  blueprint_name,
  blueprint_group_id,
  blueprint_group_name,
  blueprint_category_id,
  blueprint_category_name,
  product_quantity,
  manufacturing_time,
  max_production_limit,
  activity,
  created_at,
  updated_at
)
SELECT
  pe.product_type_id,
  pe.product_name,
  pe.product_group_id,
  pe.product_group_name,
  pe.product_category_id,
  pe.product_category_name,
  pe.product_market_group_id,
  pe.product_market_group_name,
  pe.product_meta_group_id,
  pe.product_meta_group_name,
  pe.product_faction_id,
  pe.product_faction_name,
  pe.blueprint_type_id,
  pe.blueprint_name,
  pe.blueprint_group_id,
  pe.blueprint_group_name,
  pe.blueprint_category_id,
  pe.blueprint_category_name,
  pe.product_quantity,
  pe.manufacturing_time,
  pe.max_production_limit,
  pe.activity,
  pe.created_at,
  pe.updated_at
FROM sde_master.products_enriched_v AS pe;

CREATE UNIQUE INDEX master_products_blueprint_type_idx
  ON sde_master.master_products (blueprint_type_id)
  WHERE blueprint_type_id IS NOT NULL;

CREATE INDEX master_products_category_idx
  ON sde_master.master_products (product_category_id);

CREATE INDEX master_products_meta_group_idx
  ON sde_master.master_products (product_meta_group_id)
  WHERE product_meta_group_id IS NOT NULL;

CREATE INDEX master_products_product_name_lower_idx
  ON sde_master.master_products (LOWER(product_name));

DROP TABLE IF EXISTS sde_master.master_materials;

CREATE TABLE sde_master.master_materials (
  product_type_id bigint NOT NULL,
  material_type_id bigint NOT NULL,
  material_name text,
  material_group_id bigint,
  material_group_name text,
  material_category_id bigint,
  material_category_name text,
  material_market_group_id bigint,
  material_market_group_name text,
  material_meta_group_id bigint,
  material_meta_group_name text,
  material_faction_id bigint,
  material_faction_name text,
  quantity bigint NOT NULL,
  activity text NOT NULL,
  product_name text,
  product_group_name text,
  product_category_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_type_id, material_type_id, activity)
);

INSERT INTO sde_master.master_materials (
  product_type_id,
  material_type_id,
  material_name,
  material_group_id,
  material_group_name,
  material_category_id,
  material_category_name,
  material_market_group_id,
  material_market_group_name,
  material_meta_group_id,
  material_meta_group_name,
  material_faction_id,
  material_faction_name,
  quantity,
  activity,
  product_name,
  product_group_name,
  product_category_name,
  created_at,
  updated_at
)
SELECT
  me.product_type_id,
  me.material_type_id,
  me.material_name,
  me.material_group_id_actual,
  me.material_group_name_actual,
  me.material_category_id_actual,
  me.material_category_name_actual,
  me.material_market_group_id_actual,
  me.material_market_group_name_actual,
  me.material_meta_group_id_actual,
  me.material_meta_group_name_actual,
  me.material_faction_id_actual,
  me.material_faction_name_actual,
  me.material_quantity,
  me.activity,
  me.product_name,
  me.product_group_name,
  me.product_category_name,
  me.created_at,
  me.updated_at
FROM sde_master.materials_enriched_v AS me;

CREATE INDEX master_materials_material_idx
  ON sde_master.master_materials (material_type_id);

CREATE INDEX master_materials_product_idx
  ON sde_master.master_materials (product_type_id);

CREATE INDEX master_materials_material_name_idx
  ON sde_master.master_materials (material_name);

COMMIT;
