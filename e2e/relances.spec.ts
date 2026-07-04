import { test, expect, type Page } from '@playwright/test';
import { navigateFromSidebar, resetApp } from './utils/app';

// Dexie declares schema version 9, which maps to IndexedDB version 90.
const EXPECTED_IDB_VERSION = 90;

// Wait until the *app* has opened (and migrated) the IndexedDB database, without
// touching it ourselves. `indexedDB.databases()` only lists existing databases —
// it never creates one — so this avoids the race where a bare
// `indexedDB.open('locapilot')` would create an empty version-1 DB before Dexie
// gets to create the real schema (which breaks data reads on slow CI runners).
async function waitForDbReady(page: Page) {
  await page.waitForFunction(
    async expected => {
      const dbs = (await indexedDB.databases?.()) ?? [];
      return dbs.some(d => d.name === 'locapilot' && (d.version ?? 0) >= expected);
    },
    EXPECTED_IDB_VERSION,
    { timeout: 15_000 }
  );
}

// The app has no UI to backdate a rent's due date (rents are only ever
// auto-generated for the current/next payment day), so to exercise the
// "Relance" golden path we seed a full scenario — property, tenant, active
// lease and one overdue rent — directly into IndexedDB in a single connection,
// then load the Rents page so the app picks it up like it would after real
// time had passed. Must be called only after waitForDbReady().
async function seedScenario(page: Page, opts: { suffix: string; daysLate: number }) {
  const propertyName = `E2E Relance ${opts.suffix}`;
  const result = await page.evaluate(
    async ({ propertyName, daysLate }) => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const req = indexedDB.open('locapilot');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      function add(store: string, obj: any): Promise<number> {
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

      const now = new Date();
      const propertyId = await add('properties', {
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
      const tenantId = await add('tenants', {
        civility: 'mme',
        firstName: 'Alice',
        lastName: 'Durand',
        email: `alice.${Date.now()}@test.fr`,
        phone: '0600000000',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      const leaseId = await add('leases', {
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
      const rentId = await add('rents', {
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
    // Ensure the app created the DB (v90) before we seed, so our bare open never
    // races Dexie into creating an empty version-1 database.
    await waitForDbReady(page);

    // 10 days late: past the amiable threshold (1 day) but below the recommandée
    // threshold (31 days), so the proposed level is "amiable".
    await seedScenario(page, {
      suffix: `${testInfo.project.name}-${Date.now()}`,
      daysLate: 10,
    });

    // Navigate through the app (not page.goto('/rents')): when e2e runs with
    // ENABLE_PWA_IN_DEV=1 (as on CI) the dev server serves the app under the
    // /locapilot/ base path, and a raw URL navigation lands on vite's
    // "wrong base URL" helper page instead of the app.
    await navigateFromSidebar(page, /Loyers|Rents/i, /\/rents/);

    // The only overdue rent in the whole table is the one we seeded (demo and
    // virtual rents are never late), so match it by its "En retard" status
    // rather than depending on the property name resolving in the row.
    const row = page.locator('tr.rent-row').filter({ hasText: 'En retard' }).first();
    try {
      await expect(row).toBeVisible({ timeout: 10_000 });
    } catch (e) {
      // Diagnostics for CI: distinguish "seed lost" from "rendered but not late".
      const diag = await page.evaluate(async () => {
        const db: IDBDatabase = await new Promise((resolve, reject) => {
          const req = indexedDB.open('locapilot');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const getAll = (s: string) =>
          new Promise<any[]>((res, rej) => {
            const r = db.transaction(s, 'readonly').objectStore(s).getAll();
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
          });
        const [rents, leases, properties] = await Promise.all([
          getAll('rents'),
          getAll('leases'),
          getAll('properties'),
        ]);
        db.close();
        return {
          rents: rents.map(r => ({ id: r.id, leaseId: r.leaseId, status: r.status })),
          leaseIds: leases.map(l => l.id),
          propertyNames: properties.map(p => p.name),
        };
      });
      const renderedRows = await page
        .locator('tr.rent-row')
        .evaluateAll(els => els.map(el => (el.textContent || '').replace(/\s+/g, ' ').trim()));
      console.log('RELANCE_DIAG db=', JSON.stringify(diag));
      console.log('RELANCE_DIAG rows=', JSON.stringify(renderedRows));
      throw e;
    }

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
