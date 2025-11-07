import { test, expect } from '@playwright/test';

test.describe('market browser view toggle', () => {
  test('retains ship selection and orientation while switching views', async ({ page }) => {
    await page.goto('/market-browser');

    await page.getByRole('heading', { name: /Market Browser/i }).waitFor();

    const searchInput = page.getByTestId('dropdown-search-input');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('rif');
    const typesList = page.getByTestId('dropdown-search-types');
    await typesList.getByRole('button', { name: 'Rifter' }).click();

    const preview = page.getByTestId('ship-preview-canvas');
    await expect(preview).toBeVisible();

    const initialRotation = await preview.getAttribute('data-rotation');

    const box = await preview.boundingBox();
    if (!box) {
      throw new Error('preview bounding box not available');
    }

    const interactionLayer = page.getByTestId('ship-preview-interaction-layer');
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const end = { x: box.x + box.width / 2 + 140, y: box.y + box.height / 2 - 80 };

    await interactionLayer.dispatchEvent('pointerdown', {
      bubbles: true,
      clientX: start.x,
      clientY: start.y,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
    });
    await interactionLayer.dispatchEvent('pointermove', {
      bubbles: true,
      clientX: end.x,
      clientY: end.y,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
    });
    await interactionLayer.dispatchEvent('pointerup', {
      bubbles: true,
      clientX: end.x,
      clientY: end.y,
      buttons: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await expect
      .poll(() => preview.getAttribute('data-rotation'), { timeout: 3_000 })
      .not.toBe(initialRotation);
    const rotated = await preview.getAttribute('data-rotation');

    await page.getByRole('tab', { name: 'Blueprint' }).click();
    await expect(page.locator('#market-panel-blueprint')).toContainText(/Blueprint materials/i);

    await page.getByRole('tab', { name: 'Ship' }).click();
    const previewAfterToggle = page.getByTestId('ship-preview-canvas');
    await expect(previewAfterToggle).toBeVisible();

    const rotationAfterToggle = await previewAfterToggle.getAttribute('data-rotation');
    expect(rotationAfterToggle).toBe(rotated);

    const statusDot = page.getByTestId('status-indicator-compact').getByRole('status');
    await expect(statusDot).toHaveAttribute('aria-label', /API status/i);

    const volumeToggle = page.getByRole('button', { name: 'Volume' });
    await expect(volumeToggle).toBeVisible();
    await volumeToggle.click();
    await expect(volumeToggle).toHaveAttribute('aria-pressed', 'false');
    await volumeToggle.click();
    await expect(volumeToggle).toHaveAttribute('aria-pressed', 'true');
  });
});
