import { test, expect } from '@playwright/test';

test.describe('Chat interactions', () => {
  test('chat opens and displays default message', async ({ page }) => {
    await page.goto('/');

    // Locate the chat FAB (Floating Action Button) by its aria-label or specific selector
    // Based on ChatBox component, the button is "Chat with Lumina"
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
    
    // We mock the network response if needed or just assert the loading state works
    // For now we check the message gets appended
    const sendButton = page.locator('.chatbox-send-button');
    await sendButton.click();

    // The user's message should appear
    const userMessage = page.locator('.chatbox-message.user').last();
    await expect(userMessage).toContainText('I want a sci-fi book');
  });
});
