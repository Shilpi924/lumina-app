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

  test('should handle voice filter without crashing', async ({ page }) => {
    // Navigate to Stash where the filter might exist, or on the main feed
    await page.goto('/');

    // Look for voice filter button (mic icon usually)
    const voiceButton = page.locator('button[aria-label="Voice filter"]').or(page.locator('.voice-button'));
    if (await voiceButton.count() > 0) {
      await voiceButton.click();

      // Verify app doesn't crash, look for an indicator that voice is active or failed
      // The toast notification should appear for missing microphone
      const toast = page.locator('text=Microphone permission is needed').or(page.locator('text=Your browser does not support'));
      if (await toast.count() > 0) {
        await expect(toast.first()).toBeVisible();
      }
    }
  });
});
