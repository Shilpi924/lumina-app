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
});
