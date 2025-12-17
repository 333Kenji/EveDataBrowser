import { Pool } from "pg";
import { refreshEligibleTypeViews } from "./eligible-types.js";

interface MarketPricePayload {
  type_id: number;
  average_price?: number | null;
  adjusted_price?: number | null;
}

export interface RefreshMarketPricesOptions {
  chunkSize?: number;
  retryAttempts?: number;
  refreshEligibleViews?: boolean;
}

export interface RefreshMarketPricesResult {
  fetched: number;
  updated: number;
  refreshedEligibleViews: boolean;
}

async function fetchPricesFromEsi(attempts: number): Promise<MarketPricePayload[]> {
  const url = "https://esi.evetech.net/latest/markets/prices/";
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "evedatabrowser-market-prices/1.0" } });
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`ESI throttled (${response.status})`);
      }
      if (!response.ok) {
        throw new Error(`Unable to load prices (${response.status})`);
      }
      const payload = (await response.json()) as MarketPricePayload[];
      return payload;
    } catch (error) {
      lastError = error;
      const delay = Math.min(10_000, 500 * attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function upsertPrices(executor: { query: Pool["query"] }, rows: MarketPricePayload[], chunkSize: number): Promise<number> {
  let updated = 0;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    if (chunk.length === 0) continue;
    const values: number[] = [];
    const placeholders = chunk.map((row, idx) => {
      const updatedAt = new Date().toISOString();
      values.push(row.type_id, row.average_price ?? null, row.adjusted_price ?? null, updatedAt);
      const offset = idx * 4;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    });

    const sql = `
      INSERT INTO item_prices_fact (type_id, average, adjusted, updated_at)
      VALUES ${placeholders.join(",")}
      ON CONFLICT (type_id)
      DO UPDATE SET
        average = EXCLUDED.average,
        adjusted = EXCLUDED.adjusted,
        updated_at = EXCLUDED.updated_at;
    `;

    await executor.query(sql, values);
    updated += chunk.length;
  }
  return updated;
}

export async function refreshMarketPrices(
  pool: Pool,
  options: RefreshMarketPricesOptions = {}
): Promise<RefreshMarketPricesResult> {
  const chunkSize = Number(options.chunkSize ?? 400);
  const retryAttempts = options.retryAttempts ?? 5;

  const rows = await fetchPricesFromEsi(retryAttempts);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await upsertPrices(client, rows, chunkSize);
    await client.query("COMMIT");

    if (options.refreshEligibleViews !== false) {
      await refreshEligibleTypeViews(pool);
    }

    return {
      fetched: rows.length,
      updated,
      refreshedEligibleViews: options.refreshEligibleViews !== false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
