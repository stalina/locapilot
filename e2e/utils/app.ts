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
    // Laisse le temps aux transitions CSS de se stabiliser (mobile)
    await page.waitForTimeout(100);
  }
}

export async function ensureSidebarClosed(page: Page) {
  const toggle = page.locator('[data-testid="mobile-menu-toggle"]').first();
  if (!(await toggle.isVisible().catch(() => false))) return;

  const openSidebar = page.locator('.sidebar.open').first();
  if (await openSidebar.isVisible().catch(() => false)) {
    await toggle.click();
    await openSidebar.waitFor({ state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(100);
  }
}

export async function navigateFromSidebar(page: Page, linkName: RegExp, expectedUrl: RegExp) {
  await ensureSidebarOpen(page);
  const link = page.getByRole('link', { name: linkName }).first();
  await link.waitFor({ state: 'visible', timeout: 10_000 });
  await Promise.all([
    page.waitForURL(expectedUrl, { timeout: 10_000 }),
    // Sur mobile, les animations peuvent rendre l'élément "not stable" si on clique trop tôt.
    link.click({ timeout: 10_000 }),
  ]);

  // Sur mobile, on ferme la sidebar si elle reste ouverte (overlay qui intercepte les clicks)
  await ensureSidebarClosed(page);
}

export function withinModal(page: Page, title: RegExp): Locator {
  return page
    .locator('[data-testid="modal"]')
    .filter({ has: page.locator('[data-testid="modal-title"]', { hasText: title }) })
    .first();
}

/**
 * WCAG 2 contrast ratio (1 to 21) between the computed text colour of
 * `foreground` and the computed background colour of `background`.
 */
export async function contrastRatio(foreground: Locator, background: Locator): Promise<number> {
  const [text, surface] = await Promise.all([
    foreground.evaluate(el => getComputedStyle(el).color),
    background.evaluate(el => getComputedStyle(el).backgroundColor),
  ]);
  const luminance = (color: string) => {
    const channels = (color.match(/\d+(\.\d+)?/g) ?? []).map(Number);
    const linear = (index: number) => {
      const channel = (channels[index] ?? 0) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(0) + 0.7152 * linear(1) + 0.0722 * linear(2);
  };
  const luminances = [luminance(text), luminance(surface)];
  return (Math.max(...luminances) + 0.05) / (Math.min(...luminances) + 0.05);
}
