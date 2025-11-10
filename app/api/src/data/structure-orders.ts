import type { Pool } from "pg";
import { resolveCacheEnvelope, type CacheEnvelope, type CacheOptions } from "./shared.js";

export interface StructureOrderRow {
  structureId: number;
  orderId: number;
  typeId: number;
  isBuyOrder: boolean;
  price: number;
  volumeRemain: number;
  issuedAt: string;
  lastUpdatedAt: string;
}

export interface StructureOrdersResult {
  data: StructureOrderRow[];
  cache: CacheEnvelope;
}

interface StructureOrdersQueryOptions {
  cache?: CacheOptions;
  typeId?: number;
}

const DEFAULT_CACHE: CacheEnvelope = {
  scope: "private",
  maxAgeSeconds: 120,
  staleWhileRevalidateSeconds: 60,
  generatedAt: new Date(0)
};

export async function getStructureOrders(
  pool: Pool,
  structureId: number,
  options: StructureOrdersQueryOptions = {}
): Promise<StructureOrdersResult> {
  const values: Array<number> = [structureId];
  const predicates: string[] = ["structure_id = $1"];

  if (options.typeId && options.typeId > 0) {
    values.push(options.typeId);
    predicates.push(`type_id = $${values.length}`);
  }

  const { rows } = await pool.query({
    text: `
      SELECT structure_id, order_id, type_id, is_buy_order, price, volume_remain, issued_at, last_updated_at
      FROM structure_orders
      WHERE ${predicates.join(" AND ")}
      ORDER BY price DESC, order_id ASC;
    `,
    values
  });

  const data = rows.map((row) => ({
    structureId: Number(row.structure_id),
    orderId: Number(row.order_id),
    typeId: Number(row.type_id),
    isBuyOrder: Boolean(row.is_buy_order),
    price: Number(row.price),
    volumeRemain: Number(row.volume_remain),
    issuedAt: row.issued_at instanceof Date ? row.issued_at.toISOString() : String(row.issued_at),
    lastUpdatedAt: row.last_updated_at instanceof Date ? row.last_updated_at.toISOString() : String(row.last_updated_at)
  }));

  return {
    data,
    cache: resolveCacheEnvelope(options.cache, DEFAULT_CACHE)
  };
}
