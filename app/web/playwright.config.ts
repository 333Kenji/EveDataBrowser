import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/usr/bin/chromium';

const launchOptions = existsSync(chromiumPath)
  ? { executablePath: chromiumPath, args: ['--no-sandbox', '--disable-dev-shm-usage'] }
  : { args: ['--no-sandbox', '--disable-dev-shm-usage'] };

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts$/,
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run preview -- --host 127.0.0.1 --port 4173',
        url: baseURL,
        reuseExistingServer: false,
        stdout: 'pipe',
        stderr: 'pipe',
      },
});
