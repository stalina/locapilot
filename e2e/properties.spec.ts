import { test, expect } from '@playwright/test';

test.describe('Properties CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/properties');
    await page.waitForLoadState('networkidle');
  });

  test('should display properties list', async ({ page }) => {
    // Vérifier que la grille de propriétés existe
    const propertiesGrid = page.locator('.properties-grid');
    await expect(propertiesGrid).toBeVisible();
  });

  test('should open create property modal', async ({ page }) => {
    // Cliquer sur le bouton de création
    await page.click('button:has-text("Nouvelle propriété")');

    // Vérifier que le modal s'ouvre
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();

    // Vérifier que le titre du modal est correct
    await expect(modal.locator('h2')).toContainText('Nouveau bien');
  });

  test('should create a new property', async ({ page }) => {
    // Ouvrir le modal de création
    await page.click('button:has-text("Nouvelle propriété")');

    // Attendre que le modal soit visible
    await page.waitForSelector('.modal');

    // Remplir le formulaire en utilisant les data-testid
    await page.fill('[data-testid="property-name"]', 'Appartement Test E2E');
    await page.fill('[data-testid="property-address"]', '123 Rue de Test, 75015 Paris');
    await page.fill('[data-testid="property-surface"]', '50');
    await page.fill('[data-testid="property-rooms"]', '3');
    await page.fill('[data-testid="property-rent"]', '1200');

    // Soumettre le formulaire
    await page.click('button:has-text("Enregistrer")');

    // Attendre que le modal se ferme
    await expect(page.locator('.modal')).not.toBeVisible({ timeout: 10000 });

    // Vérifier que la nouvelle propriété apparaît dans la liste
    await expect(page.locator('text=Appartement Test E2E')).toBeVisible();
  });

  test('should view property details', async ({ page }) => {
    // Vérifier qu'il y a au moins une propriété dans la grille
    const propertyCards = page.locator('.properties-grid .property-card');
    await expect(propertyCards.first()).toBeVisible();

    // Vérifier que les informations de la propriété sont affichées
    await expect(propertyCards.first().locator('.property-name')).toBeVisible();
  });

  test('should filter properties', async ({ page }) => {
    // Trouver le champ de recherche
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Rechercher"], input[placeholder*="recherche"]'
    );

    if (await searchInput.isVisible()) {
      await searchInput.fill('Paris');

      // Attendre que les résultats se mettent à jour
      await page.waitForTimeout(500);

      // Vérifier que seules les propriétés correspondantes sont affichées
      const visibleProperties = page.locator('.property-card, .property-item');
      const count = await visibleProperties.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('should delete a property', async ({ page }) => {
    // Compter le nombre de propriétés avant suppression
    const initialCount = await page.locator('.properties-grid .property-card').count();

    // Trouver le bouton supprimer de la première propriété
    const deleteButton = page.locator('[data-testid="delete-property-button"]').first();
    await deleteButton.click();

    // Attendre et accepter la confirmation
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('supprimer');
      dialog.accept();
    });

    // Attendre que la propriété soit supprimée
    await page.waitForTimeout(500);

    // Vérifier que le nombre de propriétés a diminué
    const newCount = await page.locator('.properties-grid .property-card').count();
    expect(newCount).toBe(initialCount - 1);
  });
});
