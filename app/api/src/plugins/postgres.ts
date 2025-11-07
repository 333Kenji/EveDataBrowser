import fp from "fastify-plugin";
import fastifyPostgres from "@fastify/postgres";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

// Removed redundant module augmentation conflicting with upstream types

async function postgresPlugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifyPostgres, {
    connectionString: config.database.connectionString,
    ssl: config.database.useSsl ? { rejectUnauthorized: false } : undefined
  });
}

export default fp(postgresPlugin);
