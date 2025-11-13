import { test, expect } from '@playwright/test';

test.describe('OG/Twitter meta validation', () => {
  test('homepage has correct meta tags', async ({ page }) => {
    await page.goto('/');
    
    // Check basic meta tags
    const title = await page.title();
    expect(title).toBeTruthy();
    
    // Check OG tags
    const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
    const ogDescription = await page.getAttribute('meta[property="og:description"]', 'content');
    const ogType = await page.getAttribute('meta[property="og:type"]', 'content');
    const ogUrl = await page.getAttribute('meta[property="og:url"]', 'content');
    
    expect(ogTitle).toBeTruthy();
    expect(ogDescription).toBeTruthy();
    expect(ogType).toBe('website');
    expect(ogUrl).toContain('liventix.com');
    
    // Check Twitter Card tags
    const twitterCard = await page.getAttribute('meta[name="twitter:card"]', 'content');
    const twitterTitle = await page.getAttribute('meta[name="twitter:title"]', 'content');
    const twitterDescription = await page.getAttribute('meta[name="twitter:description"]', 'content');
    
    expect(twitterCard).toBe('summary_large_image');
    expect(twitterTitle).toBeTruthy();
    expect(twitterDescription).toBeTruthy();
  });

  test('event page has correct meta tags', async ({ page }) => {
    // First go to homepage to load an event
    await page.goto('/');
    
    // Try to find and click on an event
    const eventCard = page.locator('[data-testid="event-card"]').first();
    if (await eventCard.count() > 0) {
      await eventCard.click();
      
      // Check event-specific meta tags
      const title = await page.title();
      expect(title).toContain('Liventix'); // Should contain event title and Liventix
      
      const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
      const ogDescription = await page.getAttribute('meta[property="og:description"]', 'content');
      const ogImage = await page.getAttribute('meta[property="og:image"]', 'content');
      
      expect(ogTitle).toBeTruthy();
      expect(ogDescription).toBeTruthy();
      expect(ogImage).toBeTruthy();
    }
  });

  test('user profile page has correct meta tags', async ({ page }) => {
    // Navigate to a user profile page
    await page.goto('/u/testuser');
    
    const title = await page.title();
    expect(title).toBeTruthy();
    
    const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
    const ogDescription = await page.getAttribute('meta[property="og:description"]', 'content');
    
    expect(ogTitle).toBeTruthy();
    expect(ogDescription).toBeTruthy();
  });
});