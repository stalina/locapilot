import { test, expect } from '@playwright/test';

test.describe('Offline Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Naviguer vers l'application et attendre que tout se charge
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Attendre que le service worker soit complètement installé et activé
    await page.waitForTimeout(3000);

    // Vérifier que le service worker est actif avant de commencer les tests
    const swActive = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.active !== null;
    });

    if (!swActive) {
      // Recharger la page si le SW n'est pas encore actif
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }
  });

  test('should navigate between pages offline', async ({ page, context }) => {
    // 1. Visiter toutes les pages principales en ligne pour les mettre en cache
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.goto('/properties');
    await page.waitForLoadState('networkidle');

    await page.goto('/tenants');
    await page.waitForLoadState('networkidle');

    await page.goto('/leases');
    await page.waitForLoadState('networkidle');

    await page.goto('/documents');
    await page.waitForLoadState('networkidle');

    // 2. Passer en mode offline
    await context.setOffline(true);

    // 3. Vérifier que la navigation fonctionne toujours
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Tableau de bord');

    await page.goto('/properties');
    await expect(page.locator('h1')).toContainText('Propriétés');

    await page.goto('/tenants');
    await expect(page.locator('h1')).toContainText('Locataires');

    await page.goto('/leases');
    await expect(page.locator('h1')).toContainText('Baux');

    // 4. Remettre en ligne
    await context.setOffline(false);
  });

  test('should create and persist data offline', async ({ page, context }) => {
    // Aller sur la page des propriétés
    await page.goto('/properties');
    await page.waitForLoadState('networkidle');

    // Passer en mode offline
    await context.setOffline(true);

    // Créer une nouvelle propriété en mode offline
    await page.click('button:has-text("Nouvelle propriété")');

    // Remplir le formulaire (adapter selon votre formulaire)
    await page.fill('input[name="name"]', 'Propriété Offline Test');
    await page.fill('input[name="address"]', '123 Rue du Test');
    await page.fill('input[name="surface"]', '75');
    await page.fill('input[name="rooms"]', '3');
    await page.fill('input[name="rent"]', '1200');
    await page.selectOption('select[name="type"]', 'apartment');

    // Soumettre le formulaire
    await page.click('button[type="submit"]');

    // Attendre que le modal se ferme et que la propriété apparaisse
    await page.waitForTimeout(1000);

    // Vérifier que la propriété a été créée
    await expect(page.locator('text=Propriété Offline Test')).toBeVisible();

    // Recharger la page en mode offline pour vérifier la persistance
    await page.reload();
    await page.waitForLoadState('networkidle');

    // La propriété doit toujours être là
    await expect(page.locator('text=Propriété Offline Test')).toBeVisible();

    // Remettre en ligne et nettoyer
    await context.setOffline(false);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // La propriété doit toujours être présente après retour en ligne
    await expect(page.locator('text=Propriété Offline Test')).toBeVisible();
  });

  test('should display cached content when offline', async ({ page, context }) => {
    // Charger le dashboard en ligne
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Vérifier qu'il y a du contenu
    const hasContent = await page.locator('.view-container').isVisible();
    expect(hasContent).toBe(true);

    // Passer en mode offline
    await context.setOffline(true);

    // Recharger la page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Le contenu doit toujours être visible grâce au cache
    await expect(page.locator('.view-container')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();

    // Remettre en ligne
    await context.setOffline(false);
  });

  test('should handle offline/online transitions gracefully', async ({ page, context }) => {
    // Commencer en ligne
    await page.goto('/properties');
    await page.waitForLoadState('networkidle');

    // Passer offline
    await context.setOffline(true);
    await page.waitForTimeout(500);

    // Vérifier que l'app fonctionne toujours
    await expect(page.locator('h1')).toBeVisible();

    // Revenir en ligne
    await context.setOffline(false);
    await page.waitForTimeout(500);

    // L'app doit toujours fonctionner
    await expect(page.locator('h1')).toBeVisible();

    // Plusieurs transitions
    for (let i = 0; i < 3; i++) {
      await context.setOffline(true);
      await page.waitForTimeout(300);
      await context.setOffline(false);
      await page.waitForTimeout(300);
    }

    // L'app doit toujours être fonctionnelle
    await expect(page.locator('.view-container')).toBeVisible();
  });

  test('should have service worker controlling the page', async ({ page }) => {
    await page.goto('/');

    // Vérifier que le service worker contrôle la page
    const isControlled = await page.evaluate(async () => {
      return navigator.serviceWorker.controller !== null;
    });

    expect(isControlled).toBe(true);
  });

  test('should cache API responses in IndexedDB', async ({ page }) => {
    await page.goto('/properties');
    await page.waitForLoadState('networkidle');

    // Vérifier que la base de données IndexedDB existe
    const dbExists = await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      return databases.some(db => db.name === 'locapilot');
    });

    expect(dbExists).toBe(true);

    // Vérifier qu'on peut lire les données
    const canReadData = await page.evaluate(async () => {
      try {
        const request = indexedDB.open('locapilot');
        return new Promise(resolve => {
          request.onsuccess = () => {
            const db = request.result;
            resolve(db.objectStoreNames.length > 0);
          };
          request.onerror = () => resolve(false);
        });
      } catch {
        return false;
      }
    });

    expect(canReadData).toBe(true);
  });
});
