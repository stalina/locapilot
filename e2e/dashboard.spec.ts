import { test, expect, type Page } from '@playwright/test';
import { resetApp } from './utils/app';

test('Dashboard shows recent activities and upcoming events', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Tableau de bord');

  const recentHeader = page.locator('.section-title', { hasText: 'Activité récente' });
  await expect(recentHeader).toBeVisible();

  const activityCount = await page.locator('.activity-item').count();
  // Accept either populated list or the empty state message
  if (activityCount === 0) {
    await expect(page.locator('.empty-list', { hasText: 'Aucune activité récente' })).toBeVisible();
  } else {
    expect(activityCount).toBeGreaterThanOrEqual(1);
  }

  const upcomingHeader = page.locator('.section-title', { hasText: 'À venir' });
  await expect(upcomingHeader).toBeVisible();

  const eventCount = await page.locator('.event-item').count();
  if (eventCount === 0) {
    await expect(page.locator('.empty-list', { hasText: 'Aucun événement à venir' })).toBeVisible();
  } else {
    expect(eventCount).toBeGreaterThanOrEqual(1);
  }
});

// Dexie declares schema version 9, which maps to IndexedDB version 90.
const EXPECTED_IDB_VERSION = 90;

// Wait until the *app* has opened (and migrated) the IndexedDB database, without
// touching it ourselves — see e2e/relances.spec.ts for the rationale.
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

// The app has no UI to backdate a rent's due date or create a lease ending in
// the past-relative future, so the proactive-alerts golden path seeds the
// scenario directly into IndexedDB (same pattern as e2e/relances.spec.ts):
// an active lease ending in 19 days and a rent late by 78 days.
async function seedAlertsScenario(page: Page, propertyName: string) {
  const result = await page.evaluate(
    async ({ propertyName }) => {
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
      const DAY = 86_400_000;
      const propertyId = await add('properties', {
        name: propertyName,
        address: '1 rue de Belleville',
        postalCode: '75020',
        town: 'Paris',
        type: 'studio',
        surface: 25,
        rooms: 1,
        rent: 900,
        status: 'occupied',
        photos: [],
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
        // Active lease ending within the 30-day alert window
        endDate: new Date(now.getTime() + 19 * DAY),
        rent: 900,
        charges: 0,
        deposit: 900,
        paymentDay: 5,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      // Critical arrears: late rent more than 60 days overdue
      const rentId = await add('rents', {
        leaseId,
        dueDate: new Date(now.getTime() - 78 * DAY),
        amount: 900,
        charges: 0,
        status: 'late',
        createdAt: now,
        updatedAt: now,
      });
      db.close();
      return { propertyId, tenantId, leaseId, rentId };
    },
    { propertyName }
  );

  if (!result?.leaseId) throw new Error('Failed to seed dashboard alerts scenario');
  return result;
}

test.describe('Dashboard proactive alerts - e2e', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('Alerts banner surfaces critical arrears and lease expiry with direct links', async ({
    page,
  }, testInfo) => {
    await waitForDbReady(page);

    const propertyName = `E2E Alerte ${testInfo.project.name}-${Date.now()}`;
    const { leaseId } = await seedAlertsScenario(page, propertyName);

    // Reload the dashboard (we are already on '/') so the store picks up the seed.
    await page.reload({ waitUntil: 'domcontentloaded' });

    const banner = page.locator('[data-testid="dashboard-alerts"]');
    await expect(banner).toBeVisible({ timeout: 10_000 });

    // Critical arrears alert is present and listed first (severity ordering).
    const arrearsAlert = banner.locator('.alert-item', { hasText: 'Impayé critique' });
    await expect(arrearsAlert).toBeVisible();
    await expect(banner.locator('.alert-item').first()).toHaveClass(/alert-critical/);

    // Lease-expiry alert for the seeded property is present.
    const leaseAlert = banner.locator('.alert-item', { hasText: 'Fin de bail proche' });
    await expect(leaseAlert).toBeVisible();
    await expect(leaseAlert).toContainText(propertyName);

    // The échéancier section is rendered as well.
    await expect(page.locator('[data-testid="dashboard-schedule"]')).toBeVisible();

    // Clicking the lease alert navigates straight to the lease detail page.
    await leaseAlert.click();
    await expect(page).toHaveURL(new RegExp(`/leases/${leaseId}$`), { timeout: 10_000 });
  });
});
