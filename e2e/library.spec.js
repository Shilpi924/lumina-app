import { test, expect } from '@playwright/test';

test.describe('Library & Settings - Voice Filter & Empty States', () => {
  test.beforeEach(async ({ page }) => {
    // Add init script to mock SpeechRecognition and getUserMedia
    await page.addInitScript(() => {
      class MockSpeechRecognition {
        constructor() {
          this.lang = '';
          this.continuous = false;
          this.interimResults = false;
          this.maxAlternatives = 1;
        }
        start() {
          if (this.onstart) this.onstart();
          setTimeout(() => {
            if (this.onresult) {
              this.onresult({
                results: [
                  [{ transcript: 'Fantasy' }]
                ]
              });
            }
            if (this.onend) this.onend();
          }, 300);
        }
        stop() {
          if (this.onend) this.onend();
        }
      }

      window.webkitSpeechRecognition = MockSpeechRecognition;
      window.SpeechRecognition = MockSpeechRecognition;

      // Mock mediaDevices.getUserMedia
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          if (window.mockMicPermissionDenied) {
            throw new Error('NotAllowedError: Permission denied');
          }
          return {
            getTracks: () => [{ stop: () => {} }]
          };
        };
      }
    });

    await page.goto('/');
    await expect(page.getByText('Lumina is initializing...')).toBeHidden({ timeout: 10000 });
  });

  test('should show empty states for an anonymous user', async ({ page }) => {
    // Navigate to Stash
    await page.locator('nav').getByRole('button', { name: 'Stash' }).click();
    await expect(page.getByRole('heading', { name: 'My Haul 📚' })).toBeVisible();

    // Check for empty reading list / library state text
    await expect(page.getByText('No books in this folder.')).toBeVisible();
  });

  test('should handle successful voice filter input', async ({ page }) => {
    // Go to scan tab where filters are rendered
    await page.getByRole('button', { name: '⌕ Scan' }).click();

    // Locate voice search button
    const micButton = page.locator('button[aria-label="Start voice search"]');
    await expect(micButton).toBeVisible();
    await micButton.click();

    // Assert it shows listening state
    await expect(page.getByPlaceholder('Listening for genre, age, rating, or level...')).toBeVisible();

    // Wait for the mock speech recognition to insert 'Fantasy'
    await expect(page.locator('input[type="search"]')).toHaveValue('Fantasy');
  });

  test('should display settings error message when mic permission is denied', async ({ page }) => {
    // Inject mock failure state
    await page.evaluate(() => {
      window.mockMicPermissionDenied = true;
    });

    await page.getByRole('button', { name: '⌕ Scan' }).click();

    const micButton = page.locator('button[aria-label="Start voice search"]');
    await expect(micButton).toBeVisible();
    await micButton.click();

    // Verify it handles microphone permission failure and shows correct tip
    await expect(page.getByPlaceholder('Search or speak filters...')).toBeVisible();
    const inputEl = page.locator('input[type="search"]');
    // Check voice search status or error toast/alert is rendered
    const statusText = page.locator('text=Microphone permission is needed');
    await expect(statusText.first()).toBeVisible();
  });
});
