import { test, expect } from '@playwright/test';

test.describe('App Navigation and UI', () => {
  test('should load the app and display the main title', async ({ page }) => {
    // Go to the app
    await page.goto('/');
    
    // Check that Lumina title exists
    await expect(page.getByRole('heading', { name: 'Lumina', exact: true }).first()).toBeVisible();
    
    // Ensure the loading screen disappears
    await expect(page.getByText('Lumina is initializing...')).toBeHidden({ timeout: 10000 });
  });

  test('should navigate to Vibe (Discover) tab', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Lumina is initializing...')).toBeHidden({ timeout: 10000 });

    // Click the Vibe tab
    await page.getByRole('button', { name: 'Vibe' }).click();

    // Verify Discover feed loads (for anonymous users it shows a sign in prompt)
    await expect(page.getByRole('button', { name: 'Sign in to see your vibe' })).toBeVisible();
  });

  test('should navigate to Stash (Library) tab', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Lumina is initializing...')).toBeHidden({ timeout: 10000 });

    // Click the Stash tab
    await page.getByRole('button', { name: 'Stash' }).click();

    // Verify Library loads
    await expect(page.getByRole('heading', { name: 'My Haul 📚' })).toBeVisible();
  });
});
