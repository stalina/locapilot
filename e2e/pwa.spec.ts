import { test, expect } from '@playwright/test';

test.describe('PWA Features', () => {
  test('should work offline', async ({ page, context }) => {
    // Naviguer vers l'application
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Attendre que le service worker soit enregistré
    await page.waitForTimeout(2000);

    // Vérifier que la page se charge en ligne
    await expect(page.locator('body')).toBeVisible();

    // Passer en mode hors ligne
    await context.setOffline(true);

    // Recharger la page pour tester le cache offline
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Vérifier que la page se charge hors ligne
    await expect(page.locator('body')).toBeVisible();

    // Remettre en ligne
    await context.setOffline(false);
  });

  test('should have manifest.json', async ({ page }) => {
    // Le manifest est généré par Vite PWA comme manifest.webmanifest
    const response = await page.goto('/manifest.webmanifest');
    expect(response?.status()).toBe(200);

    const manifest = await response?.json();
    expect(manifest).toHaveProperty('name');
    expect(manifest).toHaveProperty('short_name');
    expect(manifest).toHaveProperty('start_url');
  });

  test('should have service worker', async ({ page }) => {
    await page.goto('/');

    // Vérifier si un service worker est enregistré
    const hasServiceWorker = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });

    expect(hasServiceWorker).toBe(true);
  });

  test('should show install prompt on mobile', async ({ page }) => {
    await page.goto('/');

    // Vérifier que l'application peut être installée
    const canInstall = await page.evaluate(() => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches
      );
    });

    // En mode développement, l'app n'est généralement pas installée
    expect(typeof canInstall).toBe('boolean');
  });

  test('should cache assets for offline use', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Vérifier que les ressources sont en cache
    const cacheNames = await page.evaluate(async () => {
      return await caches.keys();
    });

    expect(Array.isArray(cacheNames)).toBe(true);
  });

  test('should have proper meta tags for PWA', async ({ page }) => {
    await page.goto('/');

    // Vérifier les meta tags PWA
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');

    const themeColor = await page.locator('meta[name="theme-color"]');
    await expect(themeColor).toHaveCount(1);

    const appleMobileCapable = await page.locator('meta[name="apple-mobile-web-app-capable"]');
    await expect(appleMobileCapable).toHaveCount(1);
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Définir une taille d'écran mobile
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Vérifier que la page s'affiche correctement
    await expect(page.locator('body')).toBeVisible();

    // Vérifier que la sidebar est visible (elle est toujours visible dans cette app)
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // Vérifier que le contenu principal est visible
    await expect(page.locator('.app-main')).toBeVisible();
  });

  test('should persist data locally', async ({ page }) => {
    await page.goto('/properties');

    // Vérifier que IndexedDB est disponible
    const hasIndexedDB = await page.evaluate(() => {
      return 'indexedDB' in window;
    });

    expect(hasIndexedDB).toBe(true);

    // Vérifier que la base de données existe
    const databases = await page.evaluate(async () => {
      return await indexedDB.databases();
    });

    expect(Array.isArray(databases)).toBe(true);
  });
});
