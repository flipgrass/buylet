import { expect, test, type Page } from '@playwright/test';

let n = 0;
async function signup(page: Page, brand: string) {
  const email = `owner${Date.now()}${n++}@example.test`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Need an account? Sign up' }).click();
  await page.getByLabel('Brand name').fill(brand);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct-horse-9');
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await expect(page.getByRole('banner')).toContainText(brand);
  return email;
}
const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

const CSV = `product_id,product_name,retailer,url,price,in_stock
sku-1,Oat Spread,Acme Mart,https://acme.example/oat,4.99,yes
sku-1,Oat Spread,Beta Shop,https://beta.example/oat,,no
`;

test('manual entry: retailers, product, offers, embed preview, logout', async ({ page }) => {
  const email = await signup(page, 'Manual Foods');

  await tab(page, 'Retailers');
  for (const name of ['Acme Mart', 'Beta Shop']) {
    await page.getByLabel('Retailer name').fill(name);
    await page.getByRole('button', { name: 'Add retailer' }).click();
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
  }

  await tab(page, 'Products');
  await page.getByLabel('Product name').fill('Oat Spread');
  await page.getByRole('button', { name: 'Add product' }).click();
  await expect(page.getByRole('cell', { name: 'oat-spread' })).toBeVisible();

  await tab(page, 'Offers');
  await page.getByLabel('Acme Mart URL').fill('https://acme.example/oat');
  await page.getByLabel('Acme Mart price').fill('4.99');
  await page.getByLabel('Acme Mart currency').fill('usd');
  await page.getByRole('button', { name: 'Save Acme Mart' }).click();
  await expect(page.getByRole('status').first()).toHaveText('Saved');

  await page.getByLabel('Beta Shop URL').fill('https://beta.example/oat');
  await page.getByLabel('Beta Shop in stock').uncheck();
  await page.getByRole('button', { name: 'Save Beta Shop' }).click();
  await expect(page.getByRole('status').nth(1)).toHaveText('Saved');

  await page.getByLabel('Acme Mart URL').fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Save Acme Mart' }).click();
  await expect(page.getByRole('status').first()).toContainText('http');

  await tab(page, 'Embed');
  await expect(page.getByLabel('Embed snippet')).toContainText('data-brand="manual-foods"');
  await expect(page.getByLabel('Embed snippet')).toContainText('product="oat-spread"');
  const widget = page.locator('where-to-buy');
  await expect(widget.getByRole('link', { name: 'Buy Oat Spread at Acme Mart' })).toBeVisible();
  await expect(widget.locator('li.out')).toContainText('Beta Shop');

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct-horse-9');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('banner')).toContainText('Manual Foods');
});

test('CSV import: preview, errors, commit', async ({ page }) => {
  await signup(page, 'Csv Foods');
  await tab(page, 'Import');

  await page.getByLabel('…or paste CSV').fill(CSV + 'sku-2,Jam,Acme Mart,ftp://bad,1,yes\n');
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByRole('alert')).toContainText('data row 3');
  await expect(page.getByRole('main').getByRole('button', { name: 'Import', exact: true })).toBeDisabled();

  await page.getByLabel('…or paste CSV').fill(CSV);
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByRole('status')).toContainText('1 products, 2 retailers, 2 offers');
  await page.getByRole('main').getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Imported 1 products');

  await tab(page, 'Products');
  await expect(page.getByRole('cell', { name: 'Oat Spread', exact: true })).toBeVisible();
  await tab(page, 'Embed');
  await expect(page.locator('where-to-buy').getByRole('link', { name: /Acme Mart/ })).toBeVisible();
});

test('a third-party site can embed the widget with data-brand (cross-origin: CORS + CORP)', async ({ page, browser }) => {
  await signup(page, 'Embed Foods');
  await tab(page, 'Import');
  await page.getByLabel('…or paste CSV').fill(CSV);
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('main').getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Imported');

  // 127.0.0.1 vs localhost is cross-origin but the same address space, so Chrome's
  // Private Network Access rules don't mask the CORS/CORP behavior under test.
  const ctx = await browser.newContext();
  const site = await ctx.newPage();
  await site.route('http://127.0.0.1:4174/customer-site', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><title>Customer</title>
        <script async src="http://localhost:4174/wtb.js" data-brand="embed-foods"></script>
        <where-to-buy product="sku-1"></where-to-buy>`,
    }),
  );
  await site.goto('http://127.0.0.1:4174/customer-site');
  const widget = site.locator('where-to-buy');
  await expect(widget.getByRole('link', { name: 'Buy Oat Spread at Acme Mart' })).toBeVisible();
  await ctx.close();
});

test('another brand sees none of this data', async ({ page, browser }) => {
  await signup(page, 'Private Foods');
  await tab(page, 'Import');
  await page.getByLabel('…or paste CSV').fill(CSV);
  await page.getByRole('button', { name: 'Preview' }).click();
  await page.getByRole('main').getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Imported');

  const ctx = await browser.newContext({ baseURL: 'http://localhost:4174' });
  const other = await ctx.newPage();
  await signup(other, 'Rival Foods');
  await tab(other, 'Products');
  await expect(other.getByText('No products yet.')).toBeVisible();
  await ctx.close();
});
