import { afterAll, beforeAll, expect, test } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = createApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

test("[smoke] GET /health returns ok payload", async () => {
  const response = await app.inject({ method: "GET", url: "/health" });
  expect(response.statusCode).toBe(200);
  const payload = response.json<{ status: string; timestamp: string }>();
  expect(payload.status).toBe("ok");
  expect(payload.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
});
