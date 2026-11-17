import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  // Keep tests offline: any outbound retailer request gets a stub page.
  await context.route(/^https:\/\/[a-z]+\.example\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>retailer</title>' }),
  );
});

test('lists in-stock retailers first', async ({ page }) => {
  await page.goto('/demo/index.html');
  const items = page.locator('#good li');
  await expect(items).toHaveCount(4);
  expect(await items.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.retailer))).toEqual([
    'beta-shop',
    'gamma-grocer',
    'acme-mart',
    'delta-direct',
  ]);
});

test('buy link opens retailer with utm params and pushes to dataLayer', async ({ page }) => {
  await page.goto('/demo/index.html');
  const link = page.locator('#good li[data-retailer="beta-shop"] a');
  const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  const url = new URL(popup.url());
  expect(url.host).toBe('beta.example');
  expect(url.searchParams.get('ref')).toBe('demo');
  expect(url.searchParams.get('utm_source')).toBe('wtb');
  expect(url.searchParams.get('utm_content')).toBe('sku-1');
  const layer = await page.evaluate(() => (window as any).dataLayer);
  expect(layer.map((e: any) => e.event)).toEqual(['wtb:view', 'wtb:click']);
  expect(layer[1]).toMatchObject({ productId: 'sku-1', retailerId: 'beta-shop' });
});

test('host page CSS does not leak into the widget', async ({ page }) => {
  await page.goto('/demo/index.html');
  const link = page.locator('#good li[data-retailer="beta-shop"] a');
  await expect(link).toBeVisible();
  const color = await link.evaluate((el) => getComputedStyle(el).color);
  expect(color).toBe('rgb(255, 255, 255)');
});

test('out-of-stock retailers are not clickable', async ({ page }) => {
  await page.goto('/demo/index.html');
  await expect(page.locator('#good li[data-retailer="acme-mart"]')).toHaveClass(/out/);
  await expect(page.locator('#good li[data-retailer="acme-mart"] a')).toHaveCount(0);
});

test('failed catalog fetch shows the fallback', async ({ page }) => {
  await page.goto('/demo/index.html');
  await expect(page.locator('#broken')).toContainText('Where to buy is currently unavailable');
  await expect(page.locator('#good')).not.toContainText('unavailable');
});
