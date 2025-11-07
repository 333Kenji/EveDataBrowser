import { test, expect } from '@playwright/test';

test.describe('item detail panel', () => {
  test('cycles shortlist items and supports pinning', async ({ page }) => {
    await page.goto('/dropdown-search');
    await page.getByRole('heading', { name: 'Dropdown Search' }).waitFor();

    const searchInput = page.getByTestId('dropdown-search-input');
    await searchInput.fill('');

    await searchInput.fill('atr');
    await page.getByTestId('dropdown-search-types').getByRole('button', { name: 'Atron' }).click();

    await searchInput.fill('cor');
    await page.getByRole('button', { name: 'Destroyers' }).click();
    await page.getByTestId('dropdown-search-types').getByRole('button', { name: 'Cormorant' }).click();

    const detailPanel = page.getByRole('region', { name: /item detail/i });
    await expect(detailPanel).toContainText('Atron');

    await page.keyboard.down('Control');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.up('Control');

    await expect(detailPanel).toContainText('Cormorant');

    await page.getByRole('button', { name: /Pin panel/i }).click();
    await expect(detailPanel).toContainText('Cormorant');

    await page.keyboard.down('Control');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.up('Control');

    // When pinned the active item remains unchanged.
    await expect(detailPanel).toContainText('Cormorant');
  });
});
