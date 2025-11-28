import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');

    // Vérifier que la page se charge
    await expect(page).toHaveTitle(/Locapilot/);
  });

  test('should navigate to dashboard', async ({ page, isMobile }) => {
    await page.goto('/properties');

    if (isMobile) {
      // Ouvrir le menu burger sur mobile
      await page.click('[data-testid="mobile-menu-toggle"]');
      await page.waitForTimeout(300); // Attendre l'animation
    }

    // Cliquer sur Tableau de bord dans la navigation
    await page.click('text=Tableau de bord');

    // Vérifier l'URL (tableau de bord est à la racine)
    await expect(page).toHaveURL(/\/$/);

    // Vérifier que les stats cards sont présentes
    await expect(page.locator('.stat-card')).toHaveCount(4);
  });

  test('should navigate to properties', async ({ page, isMobile }) => {
    await page.goto('/');

    if (isMobile) {
      // Ouvrir le menu burger sur mobile
      await page.click('[data-testid="mobile-menu-toggle"]');
      await page.waitForTimeout(300);
    }

    await page.click('text=Propriétés');
    await expect(page).toHaveURL(/\/properties/);

    // Vérifier le titre de la page
    await expect(page.locator('h1')).toContainText('Propriétés');
  });

  test('should navigate to tenants', async ({ page, isMobile }) => {
    await page.goto('/');

    if (isMobile) {
      // Ouvrir le menu burger sur mobile
      await page.click('[data-testid="mobile-menu-toggle"]');
      await page.waitForTimeout(300);
    }

    await page.click('text=Locataires');
    await expect(page).toHaveURL(/\/tenants/);

    await expect(page.locator('h1')).toContainText('Locataires');
  });

  test('should navigate to leases', async ({ page, isMobile }) => {
    await page.goto('/');

    if (isMobile) {
      // Ouvrir le menu burger sur mobile
      await page.click('[data-testid="mobile-menu-toggle"]');
      await page.waitForTimeout(300);
    }

    await page.click('text=Baux');
    await expect(page).toHaveURL(/\/leases/);

    await expect(page.locator('h1')).toContainText('Baux');
  });

  test('should navigate to documents', async ({ page, isMobile }) => {
    await page.goto('/');

    if (isMobile) {
      // Ouvrir le menu burger sur mobile
      await page.click('[data-testid="mobile-menu-toggle"]');
      await page.waitForTimeout(300);
    }

    await page.click('text=Documents');
    await expect(page).toHaveURL(/\/documents/);

    await expect(page.locator('h1')).toContainText('Documents');
  });

  test('should have responsive navigation menu', async ({ page, isMobile }) => {
    await page.goto('/');

    if (isMobile) {
      // Vérifier que le header mobile est visible
      await expect(page.locator('.mobile-header')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible();

      // Vérifier que la sidebar est cachée par défaut
      const sidebar = page.locator('.sidebar');
      await expect(sidebar).not.toHaveClass(/open/);
    } else {
      // Sur desktop, la navigation est visible
      const nav = page.locator('nav');
      await expect(nav).toBeAttached();
    }
  });

  test('should toggle mobile menu', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
    }

    await page.goto('/');

    const menuToggle = page.locator('[data-testid="mobile-menu-toggle"]');
    const sidebar = page.locator('.sidebar');
    const overlay = page.locator('[data-testid="sidebar-overlay"]');

    // Ouvrir le menu
    await menuToggle.click();
    await page.waitForTimeout(300);
    await expect(sidebar).toHaveClass(/open/);
    await expect(overlay).toBeVisible();

    // Fermer en cliquant sur l'overlay (force car sidebar est au-dessus)
    await overlay.click({ force: true });
    await page.waitForTimeout(300);
    await expect(sidebar).not.toHaveClass(/open/);
  });

  test('should highlight active navigation item', async ({ page, isMobile }) => {
    await page.goto('/properties');

    if (isMobile) {
      // Ouvrir le menu burger
      await page.click('[data-testid="mobile-menu-toggle"]');
      await page.waitForTimeout(300);
    }

    // Le lien actif devrait avoir une classe spéciale
    const activeLink = page.locator('nav a.router-link-active, nav a.active');
    await expect(activeLink).toBeVisible();
  });
});
