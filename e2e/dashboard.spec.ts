import { test, expect, type Page } from '@playwright/test';
import { resetApp } from './utils/app';

test('Dashboard shows recent activities and upcoming events', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Tableau de bord');

  const recentHeader = page.locator('.section-title', { hasText: 'Activité récente' });
  await expect(recentHeader).toBeVisible();

  // Demo seeding runs concurrently with the dashboard load, so wait until the
  // section settles on either state (populated list OR empty message) before
  // branching on the count — otherwise the count races with the seeding.
  const activityItems = page.locator('.activity-item');
  const activityEmpty = page.locator('.empty-list', { hasText: 'Aucune activité récente' });
  await expect(activityItems.first().or(activityEmpty)).toBeVisible();

  const activityCount = await activityItems.count();
  // Accept either populated list or the empty state message
  if (activityCount === 0) {
    await expect(activityEmpty).toBeVisible();
  } else {
    expect(activityCount).toBeGreaterThanOrEqual(1);
  }

  const upcomingHeader = page.locator('.section-title', { hasText: 'À venir' });
  await expect(upcomingHeader).toBeVisible();

  const eventItems = page.locator('.event-item');
  const eventsEmpty = page.locator('.empty-list', { hasText: 'Aucun événement à venir' });
  await expect(eventItems.first().or(eventsEmpty)).toBeVisible();

  const eventCount = await eventItems.count();
  if (eventCount === 0) {
    await expect(eventsEmpty).toBeVisible();
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

// Seeds a property + active lease + a paid rent in the current month so the
// analysis charts have data to render (revenue point, occupancy, distribution).
async function seedChartsScenario(page: Page, propertyName: string) {
  const result = await page.evaluate(
    async ({ propertyName }) => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const req = indexedDB.open('locapilot');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      function add(store: string, obj: Record<string, unknown>): Promise<number> {
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
        address: '3 rue des Graphiques',
        postalCode: '75011',
        town: 'Paris',
        type: 'apartment',
        surface: 45,
        rooms: 2,
        rent: 1100,
        status: 'occupied',
        photos: [],
        createdAt: now,
        updatedAt: now,
      });
      const tenantId = await add('tenants', {
        civility: 'mr',
        firstName: 'Bob',
        lastName: 'Martin',
        email: `bob.${Date.now()}@test.fr`,
        phone: '0600000001',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      const leaseId = await add('leases', {
        propertyId,
        tenantIds: [tenantId],
        // Active for the whole 12-month window.
        startDate: new Date(now.getFullYear() - 1, now.getMonth(), 1),
        rent: 1100,
        charges: 0,
        deposit: 1100,
        paymentDay: 5,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      // A paid rent in the current month → one revenue point + distribution slice.
      await add('rents', {
        leaseId,
        dueDate: new Date(now.getFullYear(), now.getMonth(), 5),
        amount: 1100,
        charges: 0,
        paidDate: new Date(now.getFullYear(), now.getMonth(), 6),
        paidAmount: 1100,
        status: 'paid',
        createdAt: now,
        updatedAt: now,
      });
      db.close();
      return { propertyId, leaseId };
    },
    { propertyName }
  );

  if (!result?.leaseId) throw new Error('Failed to seed dashboard charts scenario');
  return result;
}

test.describe('Dashboard analysis charts - e2e', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('Analyse section renders the three charts with seeded data', async ({ page }, testInfo) => {
    await waitForDbReady(page);

    const propertyName = `E2E Charts ${testInfo.project.name}-${Date.now()}`;
    await seedChartsScenario(page, propertyName);

    // Reload so the dashboard store picks up the seeded data.
    await page.reload({ waitUntil: 'domcontentloaded' });

    const analyse = page.locator('[data-testid="dashboard-analyse"]');
    await expect(analyse).toBeVisible({ timeout: 10_000 });
    await expect(analyse.locator('.section-title')).toContainText('Analyse');

    // The three chart cards are present.
    const revenueCard = page.locator('[data-testid="dashboard-chart-revenue"]');
    const occupancyCard = page.locator('[data-testid="dashboard-chart-occupancy"]');
    const perPropertyCard = page.locator('[data-testid="dashboard-chart-per-property"]');
    await expect(revenueCard).toBeVisible();
    await expect(occupancyCard).toBeVisible();
    await expect(perPropertyCard).toBeVisible();

    // With data seeded, the charts render (not their empty states).
    await expect(revenueCard.locator('svg.chart-svg')).toBeVisible();
    await expect(occupancyCard.locator('svg.chart-svg')).toBeVisible();
    await expect(perPropertyCard.locator('.bar-row').first()).toBeVisible();
    await expect(perPropertyCard).toContainText(propertyName);
    await expect(page.locator('[data-testid="dashboard-chart-revenue-empty"]')).toHaveCount(0);
  });
});
