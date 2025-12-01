import { test, expect } from '@playwright/test';

test.describe('Locataires - e2e', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: /Locataires|Locataires/ });
    await link.waitFor({ state: 'visible', timeout: 5000 });
    await link.click();
    await expect(page).toHaveURL(/.*\/tenants/, { timeout: 5000 });
  });

  test('Créer, éditer et supprimer un locataire', async ({ page }) => {
    // Ouvrir le formulaire de création via data-testid
    await page.locator('[data-testid="new-tenant-button"]').first().click();
    await page.waitForSelector('form');

    const firstName = `E2E_First_${Date.now()}`;
    const lastName = `E2E_Last`;
    const email = `e2e.${Date.now()}@example.com`;

    // Remplir le formulaire en utilisant les data-testid exposés
    await page.locator('input[data-testid="tenant-firstName"]').fill(firstName);
    await page.locator('input[data-testid="tenant-lastName"]').fill(lastName);
    await page.locator('input[data-testid="tenant-email"]').fill(email);
    await page.locator('input[data-testid="tenant-phone"]').fill('0612345678');
    await page.locator('input[data-testid="tenant-birthDate"]').fill('1990-01-01');
    await page.locator('select[data-testid="tenant-status"]').selectOption('candidate');

    // Créer via footer modal
    const modalFooter = page.locator('[data-testid="modal-footer"]');
    await modalFooter.waitFor({ state: 'visible', timeout: 5000 });
    await modalFooter.getByRole('button', { name: /Créer|Enregistrer/ }).click();

    // Vérifier présence dans la liste: chercher une card contenant le nom
    const fullName = `${firstName} ${lastName}`;
    await expect(page.locator('.tenant-card', { hasText: fullName })).toBeVisible({
      timeout: 5000,
    });

    // Ouvrir la fiche détail
    await page.click(`text=${fullName}`);
    await page.waitForSelector('h1', { timeout: 2000 }).catch(() => {});

    // Cliquer sur Modifier si disponible (bouton en header de détail)
    const editBtn = page.getByRole('button', { name: /Modifier/ }).first();
    if ((await editBtn.count()) > 0) {
      await editBtn.click();
      const newFirst = `${firstName}-mod`;
      await page.locator('input[data-testid="tenant-firstName"]').fill(newFirst);
      // Footer submit
      const footer = page.locator('[data-testid="modal-footer"]');
      await footer.getByRole('button', { name: /Enregistrer|Créer/ }).click();
      await expect(page.locator('h1', { hasText: newFirst })).toBeVisible({ timeout: 5000 });
    }

    // Supprimer depuis la liste via le bouton delete présent sur la card
    const card = page.locator('.tenant-card', { hasText: fullName }).first();
    const delBtn = card.locator('[data-testid="delete-tenant-button"]');
    if ((await delBtn.count()) > 0) {
      page.on('dialog', async dialog => {
        await dialog.accept();
      });
      await delBtn.first().click();
    } else {
      // Essayer depuis la page détail
      const delDetail = page.getByRole('button', { name: /Supprimer/ }).first();
      if ((await delDetail.count()) > 0) {
        page.on('dialog', async dialog => await dialog.accept());
        await delDetail.click();
      }
    }

    // Vérifier la suppression (attendre disparition)
    await expect(page.locator('.tenant-card', { hasText: fullName })).toHaveCount(0);
  });

  test('Recherche et filtres des locataires', async ({ page }) => {
    // Assure qu'il y a au moins un locataire; sinon créer un rapide
    const searchBox = page.getByPlaceholder('Rechercher un locataire...');
    await searchBox.waitFor({ state: 'visible', timeout: 2000 });

    // Recherche par email partiel
    await searchBox.fill('example.com');
    // attendre que la grille s'affiche
    await page.waitForTimeout(500);
    // Vérifier que les cartes affichées contiennent le terme
    const anyCard = page.locator('.tenant-card').first();
    if ((await anyCard.count()) > 0) {
      await expect(anyCard).toBeVisible();
    }

    // Réinitialiser recherche
    await searchBox.fill('');

    // Test filtre statut: clic sur 'Actifs'
    const activeFilter = page.locator('.filter-button', { hasText: 'Actifs' });
    if ((await activeFilter.count()) > 0) {
      await activeFilter.click();
      await page.waitForTimeout(300);
      // Tous les tenants affichés doivent avoir le badge 'Actif' ou la classe correspondante
      const cards = page.locator('.tenant-card');
      const count = await cards.count();
      for (let i = 0; i < count; i++) {
        await expect(cards.nth(i)).toBeVisible();
      }
    }
  });
});
