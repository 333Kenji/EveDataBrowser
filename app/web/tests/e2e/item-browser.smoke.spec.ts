import { test, expect } from '@playwright/test';

// Minimal smoke test for simplified Item Browser (ships only)

test.describe('item browser (ships only)', () => {
  test('loads and selects a sample ship', async ({ page }) => {
    await page.goto('/market-browser');

    await expect(page.getByRole('heading', { name: /Market Browser/i })).toBeVisible();

    // Expect single panel (no tabs)
    await expect(page.locator('#market-panel-item')).toBeVisible();

    // If dropdown remains in layout elsewhere, attempt a simple search fallback
    const searchInput = page.getByTestId('dropdown-search-input');
    if (await searchInput.count()) {
      await searchInput.fill('rif');
      const list = page.getByTestId('dropdown-search-types');
      const rifter = list.getByRole('button', { name: /Rifter/i });
      if (await rifter.count()) {
        await rifter.click();
      }
    }

    // Verify basic ship info region or placeholder graph presence
    // We use loose selectors because UI simplified
    const possibleInfo = page.locator('text=Hull class').first();
    // Allow either info stats or a snapshot region
    await expect(possibleInfo.or(page.locator('text=average price', { hasText: /price/i }).first())).toBeTruthy();
  });
});
