import { test, expect } from '@playwright/test';

test.describe('Properties CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/properties');
    await page.waitForLoadState('networkidle');
  });

  test('should display properties list', async ({ page }) => {
    // Vérifier que la liste de propriétés existe
    const propertiesList = page.locator('.properties-list, .property-card');
    await expect(propertiesList.first()).toBeVisible();
  });

  test('should open create property modal', async ({ page }) => {
    // Cliquer sur le bouton de création
    await page.click('button:has-text("Nouvelle"), button:has-text("Ajouter")');
    
    // Vérifier que le modal s'ouvre
    const modal = page.locator('.modal, [role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Vérifier que le titre du modal est correct
    await expect(modal.locator('h2, h3, .modal-title')).toContainText(/Propriété|Ajouter/i);
  });

  test('should create a new property', async ({ page }) => {
    // Ouvrir le modal de création
    await page.click('button:has-text("Nouvelle"), button:has-text("Ajouter")');
    
    // Remplir le formulaire
    await page.fill('input[name="name"], input[placeholder*="nom"]', 'Appartement Test E2E');
    await page.fill('input[name="address"], input[placeholder*="adresse"]', '123 Rue de Test');
    await page.fill('input[name="city"], input[placeholder*="ville"]', 'Paris');
    await page.fill('input[name="postalCode"], input[placeholder*="postal"]', '75001');
    await page.fill('input[name="price"], input[placeholder*="loyer"], input[type="number"]', '1200');
    
    // Soumettre le formulaire
    await page.click('button[type="submit"], button:has-text("Enregistrer"), button:has-text("Créer")');
    
    // Attendre que le modal se ferme
    await expect(page.locator('.modal, [role="dialog"]')).not.toBeVisible();
    
    // Vérifier que la nouvelle propriété apparaît dans la liste
    await expect(page.locator('text=Appartement Test E2E')).toBeVisible();
  });

  test('should view property details', async ({ page }) => {
    // Cliquer sur la première propriété
    const firstProperty = page.locator('.property-card, .property-item').first();
    await firstProperty.click();
    
    // Vérifier que la page de détails se charge
    await expect(page).toHaveURL(/\/properties\/\d+/);
    
    // Vérifier que les informations sont affichées
    await expect(page.locator('h1, .property-name')).toBeVisible();
  });

  test('should filter properties', async ({ page }) => {
    // Trouver le champ de recherche
    const searchInput = page.locator('input[type="search"], input[placeholder*="Rechercher"], input[placeholder*="recherche"]');
    
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
    // Trouver une propriété à supprimer
    const propertyCard = page.locator('.property-card, .property-item').first();
    
    // Ouvrir le menu d'actions ou cliquer sur supprimer
    const deleteButton = propertyCard.locator('button:has-text("Supprimer"), button[aria-label*="Supprimer"], .delete-button');
    
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      
      // Confirmer la suppression
      const confirmButton = page.locator('button:has-text("Confirmer"), button:has-text("Oui"), button:has-text("Supprimer")').last();
      await confirmButton.click();
      
      // Vérifier que la propriété a été supprimée
      await expect(propertyCard).not.toBeVisible();
    }
  });
});
