import { expect, type Page } from '@playwright/test';
import { navigateFromSidebar, withinModal } from './app';

export async function createProperty(page: Page, overrides: { name?: string } = {}) {
  const name = overrides.name ?? `E2E Propriété ${Date.now()}`;

  await navigateFromSidebar(page, /Propri[ée]t[ée]s|Properties/i, /\/properties/);

  await page.locator('[data-testid="new-property-button"]').first().click();
  const modal = withinModal(page, /Propri[ée]t[ée]|Bien|property/i);
  await modal.waitFor({ state: 'visible', timeout: 10_000 });

  await modal.locator('[data-testid="property-name"]').fill(name);
  await modal.locator('[data-testid="property-address"]').fill('1 rue E2E');
  await modal.locator('input[data-testid="property-surface"]').fill('30');
  await modal.locator('input[data-testid="property-rooms"]').fill('1');
  await modal.locator('input[data-testid="property-rent"]').fill('900');

  await modal.locator('[data-testid="property-form-submit"]').click();

  await expect(page.locator('.property-card', { hasText: name })).toBeVisible({ timeout: 10_000 });
  return { name };
}

export async function createTenant(
  page: Page,
  overrides: { firstName?: string; lastName?: string } = {}
) {
  const firstName = overrides.firstName ?? `E2E_${Date.now()}`;
  const lastName = overrides.lastName ?? 'Locataire';
  const email = `e2e.${Date.now()}@example.com`;

  await navigateFromSidebar(page, /Locataires|Tenants/i, /\/tenants/);

  await page.locator('[data-testid="new-tenant-button"]').first().click();
  const modal = withinModal(page, /Locataire|Tenant/i);
  await modal.waitFor({ state: 'visible', timeout: 10_000 });

  await modal.locator('input[data-testid="tenant-firstName"]').fill(firstName);
  await modal.locator('input[data-testid="tenant-lastName"]').fill(lastName);
  await modal.locator('input[data-testid="tenant-email"]').fill(email);
  await modal.locator('input[data-testid="tenant-phone"]').fill('0612345678');
  await modal.locator('input[data-testid="tenant-birthDate"]').fill('1990-01-01');
  await modal.locator('select[data-testid="tenant-status"]').selectOption('candidate');

  await modal
    .locator('[data-testid="modal-footer"]')
    .getByRole('button', { name: /Cr[ée]er|Enregistrer/i })
    .click();

  const fullName = `${firstName} ${lastName}`;
  await expect(page.locator('.tenant-card', { hasText: fullName })).toBeVisible({
    timeout: 10_000,
  });
  return { firstName, lastName, email, fullName };
}

export async function createLease(
  page: Page,
  options: {
    startDate: string;
    endDate: string;
    propertyName?: string;
    tenantFullName?: string;
  } = { startDate: '2026-01-01', endDate: '2026-12-31' }
) {
  await navigateFromSidebar(page, /Baux|Leases/i, /\/leases/);

  await page.locator('[data-testid="new-lease-button"]').first().click();
  const modal = withinModal(page, /Bail|Lease/i);
  await modal.waitFor({ state: 'visible', timeout: 10_000 });

  // Property
  const propertySelect = modal.locator('select[data-testid="lease-property"]');
  await propertySelect.waitFor({ state: 'visible', timeout: 10_000 });
  if (options.propertyName) {
    const value = await propertySelect.evaluate((selectEl, propertyName) => {
      const select = selectEl as HTMLSelectElement;
      const opts = Array.from(select.querySelectorAll('option'));
      const match = opts.find(o => (o.textContent || '').includes(propertyName));
      return match?.value || null;
    }, options.propertyName);
    if (!value) {
      throw new Error(`Option de propriété introuvable: ${options.propertyName}`);
    }
    await propertySelect.selectOption(value);
  } else {
    await propertySelect.selectOption({ index: 1 });
  }

  // Tenant
  if (options.tenantFullName) {
    const tenantLabel = modal
      .locator('[data-testid="lease-tenants"] label', { hasText: options.tenantFullName })
      .first();
    await tenantLabel.locator('input[type=checkbox]').check();
  } else {
    const firstTenant = modal.locator('[data-testid="lease-tenants"] input[type=checkbox]').first();
    await firstTenant.check();
  }

  // Dates & amounts
  await modal.locator('input[data-testid="lease-startDate"]').fill(options.startDate);
  await modal.locator('input[data-testid="lease-endDate"]').fill(options.endDate);
  await modal.locator('input[data-testid="lease-rent"]').fill('900');
  await modal.locator('input[data-testid="lease-charges"]').fill('0');
  await modal.locator('input[data-testid="lease-deposit"]').fill('900');
  await modal.locator('input[data-testid="lease-paymentDay"]').fill('5');

  // Active lease so rents are generated
  await modal.locator('select[data-testid="lease-status"]').selectOption('active');

  await modal.locator('[data-testid="lease-form-submit"]').click();

  if (options.propertyName) {
    await expect(page.locator('.lease-card', { hasText: options.propertyName })).toBeVisible({
      timeout: 10_000,
    });
  } else {
    await expect(page.locator('.lease-card').first()).toBeVisible({ timeout: 10_000 });
  }
}
