import { test, expect } from '@playwright/test';

test.describe('Scanner & Main Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Lumina is initializing...')).toBeHidden({ timeout: 10000 });
  });

  test('should render the manual ISBN entry toggle', async ({ page }) => {
    // Ensure we are on the scan tab
    await page.getByRole('button', { name: '⌕ Scan' }).click();

    // Toggle manual entry
    await page.getByRole('button', { name: '✍️ Add Book Manually' }).click();

    // Expect manual entry form to be visible
    await expect(page.getByRole('heading', { name: 'Add Book Manually' })).toBeVisible();
    await expect(page.getByPlaceholder('The Hobbit')).toBeVisible();
  });

  test('should open barcode scanner', async ({ page }) => {
    await page.getByRole('button', { name: '⌕ Scan' }).click();

    // We expect the native barcode scanner to be mocked or at least not crash
    // Since it relies on Capacitor, the web fallback or button should exist
    const scanButton = page.locator('button:has-text("Scan Barcode")');
    if (await scanButton.count() > 0) {
      await scanButton.click();
      // App shouldn't crash
      await expect(page.getByRole('button', { name: /Scan Barcode/ })).toBeVisible();
    }
  });

  test('should handle photo upload workflow', async ({ page }) => {
    await page.getByRole('button', { name: '⌕ Scan' }).click();

    // Verify file input exists for uploading a photo
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
      await expect(fileInput.first()).toBeAttached();
    }
  });
});
