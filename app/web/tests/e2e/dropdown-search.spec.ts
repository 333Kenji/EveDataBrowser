import { test, expect } from '@playwright/test';

test('dropdown search supports filtering, responsive layout, and shortlist interactions', async ({ page }) => {
  await page.goto('/dropdown-search');

  await page.getByRole('heading', { name: 'Dropdown Search' }).waitFor();

  const searchInput = page.getByTestId('dropdown-search-input');
  await expect(searchInput).toBeVisible();

  await searchInput.fill('atr');

  const typesList = page.getByTestId('dropdown-search-types');
  await expect(typesList.getByRole('button', { name: 'Atron' })).toBeVisible();
  await typesList.getByRole('button', { name: 'Atron' }).click();

  const shortlist = page.getByRole('heading', { name: 'Shortlist' });
  await expect(shortlist).toBeVisible();
  await expect(page.getByText('Atron — category ships, group frigates', { exact: false })).toBeVisible();

  const detailPanel = page.getByRole('region', { name: /item detail/i });
  await expect(detailPanel).toContainText('Item Detail');

  await searchInput.fill('zzzz');
  await expect(page.getByRole('status')).toHaveText(/No results/i);

  await page.setViewportSize({ width: 720, height: 900 });
  await searchInput.fill('cor');
  await typesList.getByRole('button', { name: 'Cormorant' }).click();
  await expect(page.getByText('Cormorant — category ships, group destroyers', { exact: false })).toBeVisible();

  await page.setViewportSize({ width: 480, height: 900 });
  await page.screenshot({ path: 'docs/assets/dropdown-search-mobile.png', fullPage: true });
});
