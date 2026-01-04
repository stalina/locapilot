import { test } from '@playwright/test';

test('repro lease', async ({ page }) => {
  page.on('console', m => console.log('CONSOLE', m.type(), m.text()));
  page.on('pageerror', e => console.log('PAGEERROR', e));
  page.on('requestfailed', r => console.log('REQ_FAIL', r.url(), r.failure()?.errorText));

  await page.goto('/leases');
  await page.waitForSelector('button[data-testid="new-lease-button"]', { timeout: 5000 });
  await page.click('button[data-testid="new-lease-button"]');
  await page.waitForSelector('form', { timeout: 5000 });

  // Try to fill the modal fields the app actually exposes: select property, pick tenant, dates, numeric inputs
  const prop = await page.$('select');
  if (prop) {
    const opts = await prop.$$('option');
    if (opts.length > 1) {
      await prop.selectOption({ index: 1 }).catch(() => {});
    }
  }
  const tenantCheckbox = await page.$('.tenant-card input[type=checkbox]');
  if (tenantCheckbox) await tenantCheckbox.click().catch(() => {});
  const dates = await page.$$('input[type=date]');
  if (dates[0]) await dates[0].fill(new Date().toISOString().slice(0, 10)).catch(() => {});
  if (dates[1])
    await dates[1]
      .fill(
        new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10)
      )
      .catch(() => {});
  const numbers = await page.$$('input[type=number]');
  if (numbers[0]) await numbers[0].fill('900').catch(() => {});

  try {
    await page.click('button:has-text("Créer")', { timeout: 5000 });
    console.log('clicked create');
  } catch (e) {
    console.log('CLICK_ERR', e);
  }
  await page.waitForTimeout(1000);
});
