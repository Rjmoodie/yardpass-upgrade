import { test, expect } from '@playwright/test';

test.describe('Share functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Mock analytics to capture events
    await page.addInitScript(() => {
      (window as any).analyticsEvents = [];
      (window as any).posthog = {
        capture: (event: string, properties: any) => {
          (window as any).analyticsEvents.push({ event, properties });
        }
      };
    });
  });

  test('shows fallback modal on desktop when Web Share API unavailable', async ({ page }) => {
    // Override navigator.share to be undefined
    await page.addInitScript(() => {
      delete (window.navigator as any).share;
    });

    await page.goto('/');
    
    // Wait for page to load and find a share button
    await page.waitForSelector('[aria-label*="Share"]', { timeout: 10000 });
    
    // Click the first share button found
    await page.click('[aria-label*="Share"]');
    
    // Should show the fallback modal
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('text=Share')).toBeVisible();
    await expect(page.locator('text=Copy Link')).toBeVisible();
    await expect(page.locator('text=WhatsApp')).toBeVisible();
  });

  test('calls Web Share API when available', async ({ page }) => {
    let shareApiCalled = false;
    let sharePayload: any = null;

    // Mock navigator.share
    await page.addInitScript(() => {
      (window.navigator as any).share = async (data: any) => {
        (window as any).shareApiCalled = true;
        (window as any).sharePayload = data;
        return Promise.resolve();
      };
    });

    await page.goto('/');
    
    // Wait for page to load and find a share button
    await page.waitForSelector('[aria-label*="Share"]', { timeout: 10000 });
    
    // Click share button
    await page.click('[aria-label*="Share"]');
    
    // Check if Web Share API was called
    shareApiCalled = await page.evaluate(() => (window as any).shareApiCalled);
    sharePayload = await page.evaluate(() => (window as any).sharePayload);
    
    expect(shareApiCalled).toBe(true);
    expect(sharePayload).toBeTruthy();
    expect(sharePayload.title).toBeTruthy();
    expect(sharePayload.url).toBeTruthy();
  });

  test('copy link functionality works', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Override navigator.share to be undefined to force modal
    await page.addInitScript(() => {
      delete (window.navigator as any).share;
    });

    await page.goto('/');
    
    // Wait for share button and click it
    await page.waitForSelector('[aria-label*="Share"]', { timeout: 10000 });
    await page.click('[aria-label*="Share"]');
    
    // Wait for modal and click copy
    await page.waitForSelector('text=Copy Link');
    await page.click('text=Copy Link');
    
    // Check clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('https://yardpass.com');
    expect(clipboardText).toContain('utm_source=share');
    expect(clipboardText).toContain('utm_medium=app');
  });

  test('generates correct deep links with UTM parameters', async ({ page }) => {
    await page.addInitScript(() => {
      delete (window.navigator as any).share;
    });

    await page.goto('/');
    
    // Click share button
    await page.waitForSelector('[aria-label*="Share"]', { timeout: 10000 });
    await page.click('[aria-label*="Share"]');
    
    // Get the URL from the input field
    await page.waitForSelector('input[readonly]');
    const shareUrl = await page.inputValue('input[readonly]');
    
    expect(shareUrl).toContain('https://yardpass.com');
    expect(shareUrl).toContain('utm_source=share');
    expect(shareUrl).toContain('utm_medium=app');
    expect(shareUrl).toContain('utm_campaign=');
  });

  test('tracks analytics events correctly', async ({ page }) => {
    await page.addInitScript(() => {
      delete (window.navigator as any).share;
    });

    await page.goto('/');
    
    // Click share button
    await page.waitForSelector('[aria-label*="Share"]', { timeout: 10000 });
    await page.click('[aria-label*="Share"]');
    
    // Wait for modal and click copy
    await page.waitForSelector('text=Copy Link');
    await page.click('text=Copy Link');
    
    // Check analytics events
    const events = await page.evaluate(() => (window as any).analyticsEvents);
    
    const shareIntentEvent = events.find((e: any) => e.event === 'share_intent');
    const shareCompletedEvent = events.find((e: any) => e.event === 'share_completed');
    
    expect(shareIntentEvent).toBeTruthy();
    expect(shareCompletedEvent).toBeTruthy();
    expect(shareCompletedEvent.properties.channel).toBe('copy');
  });
});