/* global Buffer */
import { test, expect } from '@playwright/test';

test.describe('Scanner & Main Feed', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Google Books search API
    await page.route(url => url.toString().includes('searchGoogleBooks'), async (route) => {
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
              items: [
                {
                  volumeInfo: {
                    title: 'The Hobbit',
                    authors: ['J.R.R. Tolkien'],
                    categories: ['Fantasy'],
                    description: 'A legendary adventure story of Bilbo Baggins.'
                  }
                }
              ]
            }
          })
        });
      }
    });

    // Intercept Claude generation API
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
              text: JSON.stringify({
                books: [
                  {
                    title: 'Dune',
                    author: 'Frank Herbert',
                    authorBio: 'American sci-fi writer',
                    rating: 4.8,
                    ratingSource: 'Goodreads',
                    summary: 'Classic desert planet space opera.',
                    genre: 'Sci-Fi',
                    readingLevel: 'Advanced',
                    gradeBand: '7+',
                    ageRecommendation: 'Teen',
                    whyRead: 'A masterpiece of world-building.',
                    shelfPick: 'Top Rated',
                    shelfLocation: 'middle row center',
                    scanConfidence: 'high',
                    confidenceReason: 'Clearly visible title on spine',
                    scanType: 'spine'
                  }
                ]
              })
            }
          })
        });
      }
    });
  });

  test('should render the manual ISBN entry toggle', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Lumina is initializing...')).toBeHidden({ timeout: 10000 });
    await page.getByRole('button', { name: '⌕ Scan' }).click();

    // Toggle options to make them visible
    await page.getByRole('button', { name: 'Show barcode & manual options' }).click();

    // Toggle manual entry
    await page.getByRole('button', { name: '✍️ Add Book Manually' }).click();

    // Expect manual entry form to be visible
    await expect(page.getByRole('heading', { name: 'Add Book Manually' })).toBeVisible();
    await expect(page.getByPlaceholder('The Hobbit')).toBeVisible();
  });

  test('should open barcode scanner and handle successful scan', async ({ page }) => {
    // Add init script to mock native Capacitor & BarcodeScanner
    await page.addInitScript(() => {
      window.isNativeAppMock = true;
      window.isAndroidAppMock = true;
      
      // Force Capacitor to identify as Android native
      window.androidBridge = {
        postMessage: () => {}
      };

      window.Capacitor = window.Capacitor || {};
      window.Capacitor.PluginHeaders = window.Capacitor.PluginHeaders || [];
      window.Capacitor.PluginHeaders.push({
        name: 'BarcodeScanner',
        methods: [
          { name: 'isSupported', rtype: 'promise' },
          { name: 'isGoogleBarcodeScannerModuleAvailable', rtype: 'promise' },
          { name: 'requestPermissions', rtype: 'promise' },
          { name: 'scan', rtype: 'promise' }
        ]
      });

      window.Capacitor.nativePromise = async (plugin, method, options) => {
        console.log('Mock nativePromise called:', plugin, method, options);
        if (plugin === 'BarcodeScanner') {
          if (method === 'isSupported') return { supported: true };
          if (method === 'isGoogleBarcodeScannerModuleAvailable') return { available: true };
          if (method === 'requestPermissions') return { camera: 'granted' };
          if (method === 'scan') {
            return {
              barcodes: [{ displayValue: '9780140328721', rawValue: '9780140328721' }]
            };
          }
        }
        throw new Error(`Method ${plugin}.${method} not mocked natively.`);
      };
    });

    // Navigate to apply mock init script
    await page.goto('/');
    await expect(page.getByText('Lumina is initializing...')).toBeHidden({ timeout: 10000 });

    await page.getByRole('button', { name: '⌕ Scan' }).click();
    await page.getByRole('button', { name: 'Show barcode & manual options' }).click();

    const scanButton = page.locator('button:has-text("Scan Barcode")');
    await expect(scanButton).toBeVisible();
    await scanButton.click();

    // The scan should trigger the Google Books API and then open the manual book modal with the results filled in
    await expect(page.getByRole('heading', { name: 'Add Book Manually' })).toBeVisible();
    
    // Check if the mock book details are filled in
    const titleInput = page.locator('input[placeholder="The Hobbit"]');
    await expect(titleInput).toHaveValue('The Hobbit');
    const authorInput = page.locator('input[placeholder="J.R.R. Tolkien"]');
    await expect(authorInput).toHaveValue('J.R.R. Tolkien');
  });

  test('should handle photo upload workflow and show scanned books', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Lumina is initializing...')).toBeHidden({ timeout: 10000 });
    await page.getByRole('button', { name: '⌕ Scan' }).click();

    // Mock file upload by input element
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();

    // Create a valid 1x1 transparent GIF image buffer to satisfy browser's Image onload check
    const buffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    await fileInput.setInputFiles({
      name: 'bookshelf.gif',
      mimeType: 'image/gif',
      buffer: buffer
    });

    // App should now display loading and then render the scanned book "Dune"
    await expect(page.getByText('Dune')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Frank Herbert')).toBeVisible();
    await expect(page.getByText('Classic desert planet space opera.')).toBeVisible();
  });
});
