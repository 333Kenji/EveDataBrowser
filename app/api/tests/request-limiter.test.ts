import { describe, expect, it } from "vitest";
import { setTimeout as delay } from "node:timers/promises";
import { RequestLimiter } from "../src/ingest/request-limiter.js";

describe("RequestLimiter", () => {
  it("bounds concurrent executions", async () => {
    const limiter = new RequestLimiter({ initialConcurrency: 2 });
    let running = 0;
    let observedMax = 0;

    const tasks = Array.from({ length: 5 }, (_, index) =>
      limiter.schedule(async () => {
        running += 1;
        observedMax = Math.max(observedMax, running);
        await delay(5);
        running -= 1;
        return index;
      })
    );

    const results = await Promise.all(tasks);
    expect(results).toHaveLength(5);
    expect(observedMax).toBeLessThanOrEqual(2);
  });

  it("reduces concurrency when error limit budget is low", () => {
    const limiter = new RequestLimiter({ initialConcurrency: 6, minConcurrency: 1 });
    expect(limiter.concurrency).toBe(6);

    limiter.adjustFromHeaders(new Headers({ "x-esi-error-limit-remain": "4", "x-esi-error-limit-reset": "50" }));
    expect(limiter.concurrency).toBe(3);

    limiter.adjustFromHeaders(new Headers({ "x-esi-error-limit-remain": "2" }));
    expect(limiter.concurrency).toBe(1);
  });

  it("slowly increases concurrency when plenty of budget remains", () => {
    const limiter = new RequestLimiter({ initialConcurrency: 2, maxConcurrency: 5 });
    limiter.adjustFromHeaders(new Headers({ "x-esi-error-limit-remain": "90", "x-esi-error-limit-reset": "30" }));
    expect(limiter.concurrency).toBe(3);
    limiter.adjustFromHeaders(new Headers({ "x-esi-error-limit-remain": "90", "x-esi-error-limit-reset": "30" }));
    expect(limiter.concurrency).toBe(4);
    limiter.adjustFromHeaders(new Headers({ "x-esi-error-limit-remain": "90", "x-esi-error-limit-reset": "30" }));
    expect(limiter.concurrency).toBe(5);
    limiter.adjustFromHeaders(new Headers({ "x-esi-error-limit-remain": "90", "x-esi-error-limit-reset": "30" }));
    expect(limiter.concurrency).toBe(5);
  });
});
