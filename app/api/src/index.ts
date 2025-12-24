import { createApp } from "./app.js";
import { runSdeBootstrapIfNeeded } from "./ops/sde-bootstrap.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

async function main(): Promise<void> {
  const app = createApp();

  try {
    await app.listen({ port, host });
    // eslint-disable-next-line no-console
    console.log(`API listening on http://${host}:${port}`);
    void runSdeBootstrapIfNeeded();
  } catch (error) {
    app.log.error(error);
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  }
}

void main();
