import { test, expect } from '@playwright/test';

test.describe('Chat interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Claude generation API for Chat call
    await page.route(url => url.toString().includes('generateClaudeContent'), async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Firebase-GMPID, X-Firebase-AppCheck',
          }
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            result: {
              text: 'Lumina recommends: Dune is an amazing sci-fi choice for you!'
            }
          })
        });
      }
    });

    await page.goto('/');
    await expect(page.getByText('Lumina is initializing...')).toBeHidden({ timeout: 10000 });
  });

  test('chat opens and displays response from Lumina', async ({ page }) => {
    // Locate the chat FAB (Floating Action Button)
    const chatFab = page.locator('.chatbox-fab');
    await chatFab.waitFor({ state: 'visible' });
    await chatFab.click();

    // Verify chat UI appears
    const chatContainer = page.locator('.chatbox-window');
    await expect(chatContainer).toBeVisible();

    // Verify default message from Lumina
    const initialMessage = page.locator('.chatbox-message.model').first();
    await expect(initialMessage).toContainText('Hi! I am Lumina');

    // Test sending a message
    const inputField = page.locator('.chatbox-input input');
    await inputField.fill('I want a sci-fi book');
    
    const sendButton = page.locator('.chatbox-send-button');
    await sendButton.click();

    // The user's message should appear
    const userMessage = page.locator('.chatbox-message.user').last();
    await expect(userMessage).toContainText('I want a sci-fi book');

    // Verify chat response gets appended
    const botResponse = page.locator('.chatbox-message.model').last();
    await expect(botResponse).toContainText('Lumina recommends: Dune is an amazing sci-fi choice');
  });
});
