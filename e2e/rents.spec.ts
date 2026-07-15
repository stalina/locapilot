import { test, expect } from '@playwright/test';
import { resetApp, navigateFromSidebar } from './utils/app';
import { createProperty, createTenant, createLease } from './utils/flows';

test.describe('Loyers - e2e', () => {
  test('Payer un loyer (virtual -> rent réel) puis vérifier statut', async ({ page }) => {
    await resetApp(page);

    const { name: propertyName } = await createProperty(page);
    const { fullName: tenantFullName } = await createTenant(page);
    await createLease(page, {
      startDate: '2025-12-01',
      endDate: '2026-12-31',
      propertyName,
      tenantFullName,
    });

    await navigateFromSidebar(page, /Loyers|Rents/i, /\/rents/);

    const row = page.locator('tr.rent-row', { hasText: propertyName }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Ouvrir le paiement
    await row.getByRole('button', { name: /Payer/ }).click();

    // Remplir le modal de paiement
    await expect(page.getByRole('heading', { name: /Enregistrer un paiement/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('#payment-method').selectOption('transfer');
    await page.getByRole('button', { name: /Valider le paiement/i }).click();

    // Vérifier le statut payé (badge + action quittance)
    await expect(row.locator('.status-cell')).toContainText('Payé', { timeout: 10_000 });
    await expect(row.getByRole('button', { name: /Quittance/i })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Loyers - virtual scrolling sur grande liste (issue #64)', () => {
  test('Une grande liste de loyers ne monte que les lignes visibles et en révèle au scroll', async ({
    page,
  }) => {
    await resetApp(page);

    // Seed a large rent list directly in IndexedDB: creating 500 rents through
    // the UI is impractical, and virtualization is a pure rendering concern.
    const seeded = await page.evaluate(async () => {
      function openDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
          const req = indexedDB.open('locapilot');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      }
      const db = await openDB();
      const now = new Date();
      const tx = db.transaction('rents', 'readwrite');
      const store = tx.objectStore('rents');
      // Start from a clean slate regardless of any prior state.
      await new Promise<void>((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      for (let i = 0; i < 500; i++) {
        // Descending due dates so index 0 is the most recent row.
        const dueDate = new Date(now.getFullYear() - 1, 0, 1);
        dueDate.setDate(dueDate.getDate() + (500 - i));
        store.add({
          leaseId: 1,
          dueDate,
          amount: 500 + i,
          charges: 50,
          status: 'paid',
          paidDate: dueDate,
          createdAt: now,
          updatedAt: now,
        });
      }
      const count = await new Promise<number>(resolve => {
        const c = store.count();
        c.onsuccess = () => resolve(c.result);
      });
      db.close();
      return count;
    });
    expect(seeded).toBeGreaterThanOrEqual(500);

    await navigateFromSidebar(page, /Loyers|Rents/i, /\/rents/);

    // The header reflects the full list (500 seeded rents, plus any virtual
    // rents the app derives from demo leases).
    await expect(page.locator('.header-meta')).toContainText(/5\d\d loyers/, { timeout: 10_000 });

    // ...but only a small windowed subset of rows is actually mounted.
    const container = page.locator('[data-testid="rents-scroll-container"]');
    await expect(container).toHaveClass(/is-virtual/, { timeout: 10_000 });

    const rows = page.locator('[data-testid="rent-row"]');
    const initialCount = await rows.count();
    expect(initialCount).toBeGreaterThan(0);
    expect(initialCount).toBeLessThan(100);

    // Capture the top-most rendered amount, then scroll to the bottom.
    const firstAmountBefore = await rows.first().locator('.amount-cell').textContent();

    await container.evaluate(el => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });

    // A different window of rows is rendered on demand (the top row changed),
    // and the count stays windowed (no full-list render).
    await expect(async () => {
      const firstAmountAfter = await rows.first().locator('.amount-cell').textContent();
      expect(firstAmountAfter).not.toBe(firstAmountBefore);
    }).toPass({ timeout: 10_000 });

    const bottomCount = await rows.count();
    expect(bottomCount).toBeLessThan(100);
    // The last seeded row (oldest, highest amount) is reachable at the bottom.
    await expect(rows.last().locator('.amount-cell')).toContainText('999', { timeout: 10_000 });
  });
});

test.describe('Loyers - génération de quittance chargée à la demande (issue #65)', () => {
  test('Générer une quittance télécharge un .docx via le chunk docxtemplater lazy', async ({
    page,
  }) => {
    await resetApp(page);

    const { name: propertyName } = await createProperty(page);
    const { fullName: tenantFullName } = await createTenant(page);
    await createLease(page, {
      startDate: '2025-12-01',
      endDate: '2026-12-31',
      propertyName,
      tenantFullName,
    });

    await navigateFromSidebar(page, /Loyers|Rents/i, /\/rents/);

    const row = page.locator('tr.rent-row', { hasText: propertyName }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Payer le loyer pour faire apparaître l'action "Quittance".
    await row.getByRole('button', { name: /Payer/ }).click();
    await expect(page.getByRole('heading', { name: /Enregistrer un paiement/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('#payment-method').selectOption('transfer');
    await page.getByRole('button', { name: /Valider le paiement/i }).click();
    await expect(row.locator('.status-cell')).toContainText('Payé', { timeout: 10_000 });

    // Cliquer "Quittance" : docxtemplater/pizzip sont importés dynamiquement au
    // premier appel, puis le .docx est généré et téléchargé.
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await row.getByRole('button', { name: /Quittance/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/_quittanceLoyer\.docx$/);
  });
});
