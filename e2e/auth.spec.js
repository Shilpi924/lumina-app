import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigating to the Vibe tab which requires login for anonymous users
    await page.goto('/');
    await expect(page.getByText('Lumina is initializing...')).toBeHidden({ timeout: 10000 });
    await page.getByRole('button', { name: 'Vibe' }).click();
  });

  test('should render the login form correctly', async ({ page }) => {
    // Click 'Sign in to see your vibe'
    await page.getByRole('button', { name: 'Sign in to see your vibe' }).click();

    // The Login page should be visible
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
  });

  test('should toggle between Login and Registration', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in to see your vibe' }).click();

    // Click "Sign up"
    await page.getByText('Need an account? Sign up').click();

    // Verify registration fields appear (has Confirm Password)
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
    await expect(page.getByPlaceholder('Confirm Password')).toBeVisible();

    // Toggle back to Login
    await page.getByText('Already have an account? Log in').click();
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  });

  test('should open the password reset UI', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in to see your vibe' }).click();

    // Click Forgot password without entering email
    await page.getByText('Forgot password').click();

    // Verify reset error message prompt
    await expect(page.getByText('Enter your email first, then click Forgot password.')).toBeVisible();
  });
});
