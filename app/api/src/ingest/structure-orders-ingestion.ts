import { Pool } from "pg";

interface StructureOrderPayload {
  order_id: number;
  type_id: number;
  is_buy_order: boolean;
  price: number;
  volume_remain: number;
  issued: string;
}

interface StructureOrdersResult {
  fetched: number;
  upserted: number;
}

const FEATURE_ENABLED = process.env.FEATURE_STRUCTURE_ORDERS === "true";
const STRUCTURE_IDS = (process.env.STRUCTURE_ORDER_STRUCTURE_IDS ?? "")
  .split(",")
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isFinite(value) && value > 0);
const STRUCTURE_TOKEN = process.env.STRUCTURE_ORDER_ESI_TOKEN;

async function fetchStructureOrders(structureId: number): Promise<StructureOrderPayload[]> {
  if (!STRUCTURE_TOKEN) {
    throw new Error("STRUCTURE_ORDER_ESI_TOKEN is required for structure orders ingestion");
  }

  const url = new URL(`https://esi.evetech.net/latest/markets/structures/${structureId}/`);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${STRUCTURE_TOKEN}`
    }
  });

  if (!response.ok) {
    throw new Error(`structure orders request failed (${response.status})`);
  }

  const payload = (await response.json()) as Array<StructureOrderPayload>;
  return payload;
}

async function upsertStructureOrders(pool: Pool, structureId: number, orders: StructureOrderPayload[]): Promise<number> {
  if (orders.length === 0) {
    return 0;
  }

  const values: Array<number | string | boolean> = [];
  const chunks: string[] = [];

  orders.forEach((order, index) => {
    const offset = index * 8;
    values.push(
      structureId,
      order.order_id,
      order.type_id,
      order.is_buy_order,
      order.price,
      order.volume_remain,
      order.issued,
      new Date().toISOString()
    );
    chunks.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`);
  });

  const sql = `
    INSERT INTO structure_orders (
      structure_id,
      order_id,
      type_id,
      is_buy_order,
      price,
      volume_remain,
      issued_at,
      last_updated_at
    )
    VALUES ${chunks.join(",")}
    ON CONFLICT (structure_id, order_id)
    DO UPDATE SET
      type_id = EXCLUDED.type_id,
      is_buy_order = EXCLUDED.is_buy_order,
      price = EXCLUDED.price,
      volume_remain = EXCLUDED.volume_remain,
      issued_at = EXCLUDED.issued_at,
      last_updated_at = EXCLUDED.last_updated_at;
  `;

  await pool.query(sql, values);
  return orders.length;
}

export async function refreshStructureOrders(pool: Pool): Promise<StructureOrdersResult> {
  if (!FEATURE_ENABLED) {
    return { fetched: 0, upserted: 0 };
  }

  if (STRUCTURE_IDS.length === 0) {
    throw new Error("STRUCTURE_ORDER_STRUCTURE_IDS must list at least one structure ID");
  }

  let totalFetched = 0;
  let totalUpserted = 0;

  for (const structureId of STRUCTURE_IDS) {
    const payload = await fetchStructureOrders(structureId);
    totalFetched += payload.length;
    const inserted = await upsertStructureOrders(pool, structureId, payload);
    totalUpserted += inserted;
  }

  return { fetched: totalFetched, upserted: totalUpserted };
}
