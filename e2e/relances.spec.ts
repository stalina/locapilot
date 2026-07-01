import { test, expect, type Page } from '@playwright/test';
import { resetApp } from './utils/app';
import { createProperty, createTenant, createLease } from './utils/flows';

// The app has no UI to backdate a rent's due date (rents are only ever
// auto-generated for the current/next payment day). To exercise the
// "Relance" golden path we seed a single overdue rent directly into
// IndexedDB for the lease created via the normal UI flow, then reload so the
// app picks it up like it would after real time had passed.
//
// The rent is seeded already `late` (rather than `pending`) so the row renders
// as "En retard" straight from the initial fetch, without depending on the
// app's async overdue-detection running and persisting before the assertions.
// The write is read back within the same evaluate so a seeding failure surfaces
// here rather than as a confusing "row not found" later.
async function seedOverdueRent(page: Page, leaseId: number, daysAgo: number) {
  const seededId = await page.evaluate(
    async ({ leaseId, daysAgo }) => {
      const dbReq = indexedDB.open('locapilot');
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        dbReq.onsuccess = () => resolve(dbReq.result);
        dbReq.onerror = () => reject(dbReq.error);
        dbReq.onblocked = () => reject(new Error('IndexedDB open blocked'));
      });

      const now = new Date();
      const dueDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      const id = await new Promise<number>((resolve, reject) => {
        const tx = db.transaction('rents', 'readwrite');
        const addReq = tx.objectStore('rents').add({
          leaseId,
          dueDate,
          amount: 900,
          charges: 0,
          status: 'late',
          createdAt: now,
          updatedAt: now,
        });
        let newId: number | undefined;
        addReq.onsuccess = () => {
          newId = addReq.result as number;
        };
        // Resolve on commit (oncomplete), not addReq.onsuccess, so the write is
        // durable before the page reload reads it back.
        tx.oncomplete = () => resolve(newId as number);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('seed transaction aborted'));
      });

      db.close();
      return id;
    },
    { leaseId, daysAgo }
  );

  if (!seededId) throw new Error('Failed to seed overdue rent');
  return seededId;
}

test.describe('Relances des impayés - e2e', () => {
  test('Générer une relance amiable pour un loyer en retard', async ({ page }) => {
    await resetApp(page);

    const { name: propertyName } = await createProperty(page);
    const { fullName: tenantFullName } = await createTenant(page);
    await createLease(page, {
      startDate: '2024-01-01',
      endDate: '2026-12-31',
      propertyName,
      tenantFullName,
    });

    const leaseCard = page.locator('.lease-card', { hasText: propertyName }).first();
    await expect(leaseCard).toBeVisible({ timeout: 10_000 });
    await leaseCard.click();
    await expect(page).toHaveURL(/\/leases\/(\d+)/, { timeout: 10_000 });
    const leaseId = Number(page.url().match(/\/leases\/(\d+)/)?.[1]);

    await seedOverdueRent(page, leaseId, 40);
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

    // The reminder was recorded: the button is gone after the next threshold isn't reached yet.
    await expect(row.getByRole('button', { name: /Relance amiable/i })).toHaveCount(0, {
      timeout: 10_000,
    });
  });
});
