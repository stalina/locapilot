import type { Page, Locator } from '@playwright/test';

async function deleteAllIndexedDBDatabases(page: Page) {
  await page.evaluate(async () => {
    // Clear storages first
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }

    // Clear Cache Storage (best-effort)
    try {
      // @ts-expect-error caches might not exist in some contexts
      if (typeof caches !== 'undefined' && caches?.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k: string) => caches.delete(k)));
      }
    } catch {
      // ignore
    }

    // Clear IndexedDB databases (Chromium supports indexedDB.databases())
    try {
      // @ts-expect-error databases is not in TS lib by default
      const dbs: Array<{ name?: string }> = (await indexedDB.databases?.()) ?? [];
      await Promise.all(
        dbs
          .map(d => d?.name)
          .filter((name): name is string => typeof name === 'string' && name.length > 0)
          .map(
            name =>
              new Promise<void>(resolve => {
                const req = indexedDB.deleteDatabase(name);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
              })
          )
      );
    } catch {
      // ignore
    }
  });
}

export async function resetApp(page: Page) {
  // Ensure we are on the origin before clearing storage
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await deleteAllIndexedDBDatabases(page);
  // Reload app after deletion so stores re-init on an empty DB
  await page.goto('/', { waitUntil: 'domcontentloaded' });
}

export async function ensureSidebarOpen(page: Page) {
  const toggle = page.locator('[data-testid="mobile-menu-toggle"]').first();
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
    await page.locator('.sidebar.open').first().waitFor({ state: 'visible', timeout: 5000 });
  }
}

export async function navigateFromSidebar(page: Page, linkName: RegExp, expectedUrl: RegExp) {
  await ensureSidebarOpen(page);
  const link = page.getByRole('link', { name: linkName }).first();
  await link.waitFor({ state: 'visible', timeout: 10_000 });
  await link.click();
  // Allow the router to settle
  await page.waitForURL(expectedUrl, { timeout: 10_000 });
}

export function withinModal(page: Page, title: RegExp): Locator {
  return page
    .locator('[data-testid="modal"]')
    .filter({ has: page.locator('[data-testid="modal-title"]', { hasText: title }) })
    .first();
}
