import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');

    // Vérifier que la page se charge
    await expect(page).toHaveTitle(/Locapilot/);
  });

  test('should navigate to dashboard', async ({ page }) => {
    await page.goto('/properties');

    // Cliquer sur Tableau de bord dans la navigation
    await page.click('text=Tableau de bord');

    // Vérifier l'URL (tableau de bord est à la racine)
    await expect(page).toHaveURL(/\/$/);

    // Vérifier que les stats cards sont présentes
    await expect(page.locator('.stat-card')).toHaveCount(4);
  });

  test('should navigate to properties', async ({ page }) => {
    await page.goto('/');

    await page.click('text=Propriétés');
    await expect(page).toHaveURL(/\/properties/);

    // Vérifier le titre de la page
    await expect(page.locator('h1')).toContainText('Propriétés');
  });

  test('should navigate to tenants', async ({ page }) => {
    await page.goto('/');

    await page.click('text=Locataires');
    await expect(page).toHaveURL(/\/tenants/);

    await expect(page.locator('h1')).toContainText('Locataires');
  });

  test('should navigate to leases', async ({ page }) => {
    await page.goto('/');

    await page.click('text=Baux');
    await expect(page).toHaveURL(/\/leases/);

    await expect(page.locator('h1')).toContainText('Baux');
  });

  test('should navigate to documents', async ({ page }) => {
    await page.goto('/');

    await page.click('text=Documents');
    await expect(page).toHaveURL(/\/documents/);

    await expect(page.locator('h1')).toContainText('Documents');
  });

  test('should have responsive navigation menu', async ({ page }) => {
    await page.goto('/');

    // Vérifier que la navigation est visible
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Vérifier que tous les liens principaux sont présents
    await expect(page.locator('nav a:has-text("Tableau de bord")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Propriétés")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Locataires")')).toBeVisible();
  });

  test('should highlight active navigation item', async ({ page }) => {
    await page.goto('/properties');

    // Le lien actif devrait avoir une classe spéciale
    const activeLink = page.locator('nav a.router-link-active, nav a.active');
    await expect(activeLink).toBeVisible();
  });
});
