import { test, expect } from '@playwright/test';

test.describe('Compare Books', () => {
  test('should allow adding two books and comparing them', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Lumina is initializing...')).toBeHidden({ timeout: 10000 });

    // --- Add Book 1: The Hobbit ---
    await page.getByRole('button', { name: '⌕ Scan' }).click();
    
    // Toggle manual entry if not visible
    const manualBtn1 = page.getByRole('button', { name: '✍️ Add Book Manually' });
    if (!(await manualBtn1.isVisible())) {
      await page.getByRole('button', { name: /Show barcode & manual options|Hide other/ }).click();
    }
    await manualBtn1.click();

    await page.locator('input[placeholder="The Hobbit"]').fill('The Hobbit');
    await page.locator('input[placeholder="J.R.R. Tolkien"]').fill('J.R.R. Tolkien');
    await page.locator('textarea[placeholder="Enter book summary..."]').fill('Bilbo Baggins sets out on a legendary quest.');
    await page.getByRole('button', { name: 'Save Book' }).click();

    // Verify Book 1 is in the feed
    await expect(page.getByText('The Hobbit').first()).toBeVisible();

    // --- Add Book 2: Dune ---
    const manualBtn2 = page.getByRole('button', { name: '✍️ Add Book Manually' });
    if (!(await manualBtn2.isVisible())) {
      await page.getByRole('button', { name: /Show barcode & manual options|Hide other/ }).click();
    }
    await manualBtn2.click();

    await page.locator('input[placeholder="The Hobbit"]').fill('Dune');
    await page.locator('input[placeholder="J.R.R. Tolkien"]').fill('Frank Herbert');
    await page.locator('textarea[placeholder="Enter book summary..."]').fill('Epic space opera set on a desert planet.');
    await page.getByRole('button', { name: 'Save Book' }).click();

    // Verify Book 2 is in the feed
    await expect(page.getByText('Dune').first()).toBeVisible();

    // --- Compare the books ---
    // Select first book's compare button
    const compareButtons = page.locator('button:has-text("Compare with other books")');
    await compareButtons.first().click();

    // Wait for the first button to update its label to "Remove from Compare" to avoid race conditions
    await expect(page.locator('button:has-text("Remove from Compare")')).toBeVisible();

    // Select second book's compare button
    await compareButtons.first().click();

    // Verify compare tray appears and contains the Open Compare button
    const openCompareBtn = page.getByRole('button', { name: 'Open Compare' });
    await expect(openCompareBtn).toBeVisible();

    // Click Open Compare (use force: true to bypass any temporary backdrop/saving status overlays)
    await openCompareBtn.click({ force: true });

    // Verify comparison modal/overlay is visible
    await expect(page.getByRole('heading', { name: 'Side-by-Side Comparison' })).toBeVisible();
    await expect(page.getByText('The Hobbit').first()).toBeVisible();
    await expect(page.getByText('Dune').first()).toBeVisible();
  });
});
