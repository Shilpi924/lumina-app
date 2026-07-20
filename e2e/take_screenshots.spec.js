import { test, expect } from '@playwright/test';

test('capture screenshots for README', async ({ page }) => {
  // Go to app
  await page.goto('/');
  
  // Wait for Lumina title and loading screen
  await expect(page.getByRole('heading', { name: 'Lumina', exact: true }).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Lumina is initializing...')).toBeHidden({ timeout: 10000 });
  
  // Go to Stash for Library View
  await page.getByRole('button', { name: 'Stash' }).click();
  await expect(page.getByRole('heading', { name: 'My Haul 📚' })).toBeVisible();
  await page.screenshot({ path: 'public/screenshots/library_view.png' });

  // Navigate to Vibe (AI)
  await page.getByRole('button', { name: 'Vibe' }).click();
  await expect(page.getByRole('button', { name: 'Sign in to see your vibe' })).toBeVisible();
  await page.screenshot({ path: 'public/screenshots/ai_recommendations.png' });

  // Navigate to Scan
  await page.getByRole('button', { name: 'Scan' }).click();
  await page.waitForTimeout(1000); // Wait for camera permission prompt or scan UI to settle
  await page.screenshot({ path: 'public/screenshots/barcode_scanner.png' });
});
