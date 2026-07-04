import { test, expect, type Page } from '@playwright/test';
import { resetApp } from './utils/app';

// The app has no UI to backdate a rent's due date (rents are only ever
// auto-generated for the current/next payment day), so to exercise the
// "Relance" golden path we seed a full scenario — property, tenant, active
// lease and one overdue rent — directly into IndexedDB in a single connection,
// then load the Rents page so the app picks it up like it would after real
// time had passed.
//
// Everything is seeded in one evaluate (no UI-creation flow, no leaseId parsed
// from a URL) to keep it deterministic on slow CI runners. The seed polls until
// the object stores exist so it never runs before the app has created the DB,
// and resolves on tx.oncomplete so the writes are durable before the reload.
async function seedScenario(page: Page, opts: { suffix: string; daysLate: number }) {
  const propertyName = `E2E Relance ${opts.suffix}`;
  const result = await page.evaluate(
    async ({ propertyName, daysLate }) => {
      function openWhenReady(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
          let attempts = 0;
          const tryOpen = () => {
            const req = indexedDB.open('locapilot');
            req.onsuccess = () => {
              const db = req.result;
              if (db.objectStoreNames.contains('rents') && db.objectStoreNames.contains('leases')) {
                resolve(db);
              } else {
                db.close();
                if (attempts++ > 50) reject(new Error('DB stores never appeared'));
                else setTimeout(tryOpen, 100);
              }
            };
            req.onerror = () => reject(req.error);
          };
          tryOpen();
        });
      }

      function add(db: IDBDatabase, store: string, obj: any): Promise<number> {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(store, 'readwrite');
          let id: number | undefined;
          const r = tx.objectStore(store).add(obj);
          r.onsuccess = () => {
            id = r.result as number;
          };
          tx.oncomplete = () => resolve(id as number);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error ?? new Error('seed aborted'));
        });
      }

      const db = await openWhenReady();
      const now = new Date();
      const propertyId = await add(db, 'properties', {
        name: propertyName,
        address: '1 rue du Test',
        postalCode: '75011',
        town: 'Paris',
        type: 'studio',
        surface: 25,
        rooms: 1,
        rent: 900,
        status: 'occupied',
        createdAt: now,
        updatedAt: now,
      });
      const tenantId = await add(db, 'tenants', {
        civility: 'mme',
        firstName: 'Alice',
        lastName: 'Durand',
        email: `alice.${Date.now()}@test.fr`,
        phone: '0600000000',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      const leaseId = await add(db, 'leases', {
        propertyId,
        tenantIds: [tenantId],
        startDate: new Date('2024-01-01'),
        rent: 900,
        charges: 0,
        deposit: 900,
        paymentDay: 5,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      const rentId = await add(db, 'rents', {
        leaseId,
        dueDate: new Date(now.getTime() - daysLate * 86400000),
        amount: 900,
        charges: 0,
        status: 'late',
        createdAt: now,
        updatedAt: now,
      });
      db.close();
      return { propertyId, tenantId, leaseId, rentId };
    },
    { propertyName, daysLate: opts.daysLate }
  );

  if (!result?.rentId) throw new Error('Failed to seed overdue rent scenario');
  return { propertyName, ...result };
}

test.describe('Relances des impayés - e2e', () => {
  test('Générer une relance amiable pour un loyer en retard', async ({ page }, testInfo) => {
    await resetApp(page);

    // 10 days late: past the amiable threshold (1 day) but below the recommandée
    // threshold (31 days), so the proposed level is "amiable".
    const { propertyName } = await seedScenario(page, {
      suffix: `${testInfo.project.name}-${Date.now()}`,
      daysLate: 10,
    });

    await page.goto('/rents', { waitUntil: 'domcontentloaded' });

    // The lease also has a virtual (current month) pending rent besides the
    // seeded overdue one — narrow down to the row that is actually late.
    const row = page
      .locator('tr.rent-row', { hasText: propertyName })
      .filter({ hasText: 'En retard' });
    await expect(row).toBeVisible({ timeout: 10_000 });

    const reminderButton = row.getByRole('button', { name: /Relance amiable/i });
    await expect(reminderButton).toBeVisible({ timeout: 10_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await reminderButton.click();

    const confirmDialog = page.locator('.confirm-dialog', { hasText: /relance/i });
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole('button', { name: /Générer et télécharger/i }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/relance_amiable\.docx$/i);

    // The reminder was recorded: the button is gone (next threshold not reached).
    await expect(row.getByRole('button', { name: /Relance amiable/i })).toHaveCount(0, {
      timeout: 10_000,
    });
  });
});
