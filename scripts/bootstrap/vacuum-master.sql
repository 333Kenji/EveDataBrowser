-- Refreshes optimizer statistics on master tables after staging cleanup
ANALYZE sde_master.master_products;
ANALYZE sde_master.master_materials;
ANALYZE sde_master.etl_run_log;
