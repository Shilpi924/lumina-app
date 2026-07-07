import { test, expect } from '@playwright/test';

test.describe('Library & Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Lumina is initializing...')).toBeHidden({ timeout: 10000 });
  });

  test('should show empty states for an anonymous user', async ({ page }) => {
    // Navigate to Stash
    await page.getByRole('button', { name: 'Stash' }).click();
    await expect(page.getByRole('heading', { name: 'My Haul 📚' })).toBeVisible();
    
    // Check for empty reading list / library state text
    await expect(page.getByText('No books in this folder.')).toBeVisible();
  });

  // Account settings are only visible to logged in users, tested in auth.spec.js
});
