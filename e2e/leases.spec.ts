import { test, expect } from '@playwright/test';
import { resetApp } from './utils/app';
import { createProperty, createTenant, createLease } from './utils/flows';

test.describe('Baux - e2e', () => {
  test('Créer puis terminer un bail', async ({ page }) => {
    await resetApp(page);

    const { name: propertyName } = await createProperty(page);
    const { fullName: tenantFullName } = await createTenant(page);
    await createLease(page, {
      startDate: '2025-12-01',
      endDate: '2026-12-31',
      propertyName,
      tenantFullName,
    });

    // Ouvrir le détail du bail
    const leaseCard = page.locator('.lease-card', { hasText: propertyName }).first();
    await expect(leaseCard).toBeVisible({ timeout: 10_000 });
    await leaseCard.click();
    await expect(page).toHaveURL(/\/leases\/\d+/, { timeout: 10_000 });

    // Terminer via confirmation
    await page
      .locator('.view-header .header-actions')
      .getByRole('button', { name: /Terminer/ })
      .click();

    const confirmDialog = page.locator('.confirm-dialog', { hasText: 'Terminer le bail' }).first();
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole('button', { name: /Terminer/ }).click();

    // Retour liste et vérifier qu'on a un bail terminé
    await page.getByRole('button', { name: /Retour/ }).click();
    await expect(page).toHaveURL(/\/leases/, { timeout: 10_000 });
    await page.locator('.filter-button', { hasText: 'Terminés' }).click();
    await page
      .getByPlaceholder(/Rechercher par propri[ée]t[ée], locataire\.\.\./i)
      .fill(propertyName);
    await expect(page.locator('.lease-card', { hasText: propertyName })).toHaveCount(1, {
      timeout: 10_000,
    });
  });

  test('Générer un mandat de location pour un bail à 2 locataires', async ({ page }) => {
    await resetApp(page);

    const { name: propertyName } = await createProperty(page);
    const tenant1 = await createTenant(page, {
      firstName: `Jean_${Date.now()}`,
      lastName: 'Dupont',
    });
    const tenant2 = await createTenant(page, {
      firstName: `Marie_${Date.now()}`,
      lastName: 'Martin',
    });

    await createLease(page, {
      startDate: '2025-12-01',
      endDate: '2026-12-31',
      propertyName,
      tenantFullNames: [tenant1.fullName, tenant2.fullName],
    });

    // Ouvrir le détail du bail
    const leaseCard = page.locator('.lease-card', { hasText: propertyName }).first();
    await expect(leaseCard).toBeVisible({ timeout: 10_000 });
    await leaseCard.click();
    await expect(page).toHaveURL(/\/leases\/\d+/, { timeout: 10_000 });

    // Les deux locataires sont listés sur la page de détail
    const tenantsList = page.locator('.tenants-list');
    await expect(tenantsList).toContainText(tenant1.fullName, { timeout: 10_000 });
    await expect(tenantsList).toContainText(tenant2.fullName);

    // Générer le mandat de location : le téléchargement doit aboutir
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await page.getByRole('button', { name: /Générer mandat de location/i }).click();

    // Choisir "Télécharger uniquement" dans la boîte de confirmation
    const confirmDialog = page.locator('.confirm-dialog', { hasText: /mandat de location/i });
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole('button', { name: /Télécharger uniquement/i }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.docx$/i);
  });
});

test.describe('Baux - documents attachés', () => {
  test('Attacher un document à un bail depuis sa page de détail', async ({ page }) => {
    await resetApp(page);

    const { name: propertyName } = await createProperty(page);
    const { fullName: tenantFullName } = await createTenant(page);
    await createLease(page, {
      startDate: '2025-12-01',
      endDate: '2026-12-31',
      propertyName,
      tenantFullName,
    });

    // Ouvrir le détail du bail
    const leaseCard = page.locator('.lease-card', { hasText: propertyName }).first();
    await expect(leaseCard).toBeVisible({ timeout: 10_000 });
    await leaseCard.click();
    await expect(page).toHaveURL(/\/leases\/\d+/, { timeout: 10_000 });

    // La section Documents est présente avec un état vide
    const section = page.locator('[data-testid="lease-documents"]');
    await expect(section).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="lease-documents-empty"]')).toBeVisible();

    // Ouvrir le formulaire d'ajout et téléverser un document "Garant"
    await page.locator('[data-testid="lease-documents-empty"]').getByRole('button').click();
    await expect(page.locator('[data-testid="lease-documents-upload-form"]')).toBeVisible();

    await page.locator('[data-testid="lease-document-category"]').selectOption('garant');
    await page.locator('[data-testid="lease-document-file"]').setInputFiles({
      name: 'garant.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test garant'),
    });
    await page.locator('[data-testid="lease-document-submit"]').click();

    // Le document apparaît dans la liste avec son nom et sa catégorie
    const list = page.locator('[data-testid="lease-documents-list"]');
    await expect(list).toBeVisible({ timeout: 10_000 });
    await expect(list.locator('.document-card', { hasText: 'garant.pdf' })).toHaveCount(1);
    await expect(list).toContainText('Garant');
  });
});
