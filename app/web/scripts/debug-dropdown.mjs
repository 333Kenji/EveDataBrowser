import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173/dropdown-search');
  await page.waitForSelector('[data-testid="dropdown-search-input"]');
  await page.fill('[data-testid="dropdown-search-input"]', 'atr');
  await page.waitForTimeout(1000);
  const types = await page.evaluate(() => {
    // @ts-expect-error debug
    return window.__dropdownTypes ?? [];
  });
  console.log('types', types);
  await page.fill('[data-testid="dropdown-search-input"]', 'zzzz');
  await page.waitForTimeout(1000);
  const statusText = await page.textContent('[role="status"]');
  console.log('status', statusText);
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
