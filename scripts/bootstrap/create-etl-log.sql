-- Creates ETL logging table and helper procedures for pipeline checkpoints
BEGIN;

CREATE SCHEMA IF NOT EXISTS sde_master;

CREATE TABLE IF NOT EXISTS sde_master.etl_run_log (
  log_id bigserial PRIMARY KEY,
  phase text NOT NULL,
  status text NOT NULL,
  message text NOT NULL,
  sample_product jsonb,
  sample_material jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sde_master_etl_run_log_phase_idx
  ON sde_master.etl_run_log (phase);

CREATE INDEX IF NOT EXISTS sde_master_etl_run_log_status_idx
  ON sde_master.etl_run_log (status);

CREATE OR REPLACE FUNCTION sde_master.log_event(
  p_phase text,
  p_status text,
  p_message text,
  p_sample_product jsonb DEFAULT NULL,
  p_sample_material jsonb DEFAULT NULL
) RETURNS bigint AS
$$
DECLARE
  v_log_id bigint;
BEGIN
  INSERT INTO sde_master.etl_run_log (
    phase,
    status,
    message,
    sample_product,
    sample_material
  )
  VALUES (
    p_phase,
    p_status,
    p_message,
    p_sample_product,
    p_sample_material
  )
  RETURNING log_id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE sde_master.log_load_event(
  p_status text,
  p_message text,
  p_sample_product jsonb DEFAULT NULL,
  p_sample_material jsonb DEFAULT NULL
)
LANGUAGE plpgsql
AS
$$
BEGIN
  PERFORM sde_master.log_event('load', p_status, p_message, p_sample_product, p_sample_material);
END;
$$;

CREATE OR REPLACE PROCEDURE sde_master.log_transform_event(
  p_status text,
  p_message text,
  p_sample_product jsonb DEFAULT NULL,
  p_sample_material jsonb DEFAULT NULL
)
LANGUAGE plpgsql
AS
$$
BEGIN
  PERFORM sde_master.log_event('transform', p_status, p_message, p_sample_product, p_sample_material);
END;
$$;

CREATE OR REPLACE PROCEDURE sde_master.log_merge_event(
  p_status text,
  p_message text,
  p_sample_product jsonb DEFAULT NULL,
  p_sample_material jsonb DEFAULT NULL
)
LANGUAGE plpgsql
AS
$$
BEGIN
  PERFORM sde_master.log_event('merge', p_status, p_message, p_sample_product, p_sample_material);
END;
$$;

CREATE OR REPLACE PROCEDURE sde_master.log_cleanup_event(
  p_status text,
  p_message text,
  p_sample_product jsonb DEFAULT NULL,
  p_sample_material jsonb DEFAULT NULL
)
LANGUAGE plpgsql
AS
$$
BEGIN
  PERFORM sde_master.log_event('cleanup', p_status, p_message, p_sample_product, p_sample_material);
END;
$$;

COMMIT;
