import { test, expect } from '@playwright/test';

test.describe('XSS Protection Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should sanitize HTML in event descriptions', async ({ page }) => {
    // Mock event with XSS payload
    await page.route('**/events/*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-event',
          title: 'Test Event',
          description: '<script>alert("XSS")</script><p>Safe content</p><img src="x" onerror="alert(\'XSS\')">',
          date: new Date().toISOString(),
          location: 'Test Location'
        })
      });
    });

    // Navigate to event page
    await page.goto('/event/test-event');
    
    // Check that script tags are removed
    const content = await page.content();
    expect(content).not.toContain('<script>');
    expect(content).not.toContain('onerror');
    expect(content).not.toContain('alert(');
    
    // Check that safe content is preserved
    expect(content).toContain('Safe content');
  });

  test('should prevent XSS in search inputs', async ({ page }) => {
    // Try to inject XSS in search
    const searchInput = page.getByPlaceholder(/search/i);
    const xssPayload = '<script>alert("XSS")</script>';
    
    await searchInput.fill(xssPayload);
    await searchInput.press('Enter');
    
    // Check that the payload is treated as text, not executed
    const content = await page.content();
    expect(content).not.toContain('<script>');
    
    // Should not trigger any alerts
    let alertTriggered = false;
    page.on('dialog', () => {
      alertTriggered = true;
    });
    
    await page.waitForTimeout(1000);
    expect(alertTriggered).toBe(false);
  });

  test('should sanitize user profile inputs', async ({ page }) => {
    // Navigate to profile page (assuming it exists)
    await page.goto('/profile');
    
    // Try XSS in display name
    const nameInput = page.getByLabel(/name/i).first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('<img src="x" onerror="alert(\'XSS\')">Test Name');
      
      // Submit or save
      const saveButton = page.getByRole('button', { name: /save/i });
      if (await saveButton.isVisible()) {
        await saveButton.click();
      }
      
      // Check that XSS is prevented
      const content = await page.content();
      expect(content).not.toContain('onerror');
    }
  });

  test('should prevent XSS in event creation form', async ({ page }) => {
    // Navigate to create event page
    await page.goto('/create-event');
    
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(\'XSS\')">',
      'javascript:alert("XSS")',
      '<svg onload="alert(\'XSS\')">',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>'
    ];

    for (const payload of xssPayloads) {
      // Try in title field
      const titleInput = page.getByLabel(/title/i);
      if (await titleInput.isVisible()) {
        await titleInput.fill(payload);
        
        // Try in description field
        const descriptionInput = page.getByLabel(/description/i);
        if (await descriptionInput.isVisible()) {
          await descriptionInput.fill(payload);
        }
        
        // Check that content is safely handled
        const content = await page.content();
        expect(content).not.toContain('<script>');
        expect(content).not.toContain('onerror');
        expect(content).not.toContain('javascript:');
        expect(content).not.toContain('onload');
      }
    }
  });

  test('should validate CSP headers are present', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers();
    
    // Check for security headers
    expect(headers?.['x-content-type-options']).toBe('nosniff');
    expect(headers?.['x-frame-options']).toBe('DENY');
    expect(headers?.['x-xss-protection']).toBe('1; mode=block');
    expect(headers?.['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('should prevent inline script execution', async ({ page }) => {
    let alertTriggered = false;
    
    page.on('dialog', async dialog => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    // Try to execute inline script
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.innerHTML = 'alert("Inline script executed")';
      document.head.appendChild(script);
    });

    await page.waitForTimeout(1000);
    expect(alertTriggered).toBe(false);
  });

  test('should sanitize URL parameters', async ({ page }) => {
    // Test XSS in URL parameters
    await page.goto('/?search=<script>alert("XSS")</script>');
    
    const content = await page.content();
    expect(content).not.toContain('<script>');
    
    // Check that search param is safely handled
    let alertTriggered = false;
    page.on('dialog', () => {
      alertTriggered = true;
    });
    
    await page.waitForTimeout(1000);
    expect(alertTriggered).toBe(false);
  });

  test('should prevent form action manipulation', async ({ page }) => {
    // Check that forms have proper action attributes
    const forms = await page.$$('form');
    
    for (const form of forms) {
      const action = await form.getAttribute('action');
      if (action) {
        expect(action).not.toContain('javascript:');
        expect(action).not.toContain('data:');
        // Should be relative or same-origin
        expect(action.startsWith('/') || action.startsWith('http://localhost') || action.startsWith('https://liventix')).toBe(true);
      }
    }
  });
});