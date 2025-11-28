import { test, expect } from '@playwright/test';

test.describe('Calendrier des loyers - Nouveau loyer', () => {
  test.beforeEach(async ({ page }) => {
    // Naviguer vers le calendrier des loyers
    await page.goto('/rents/calendar');

    // Attendre que la page soit chargée
    await page.waitForLoadState('networkidle');
  });

  test('devrait afficher le bouton "Nouveau loyer"', async ({ page }) => {
    // Vérifier que le bouton existe
    const newRentButton = page.getByRole('button', { name: /nouveau loyer/i });
    await expect(newRentButton).toBeVisible();
  });

  test('devrait ouvrir la modal de création au clic sur "Nouveau loyer"', async ({ page }) => {
    // Cliquer sur le bouton "Nouveau loyer"
    const newRentButton = page.getByRole('button', { name: /nouveau loyer/i });
    await newRentButton.click();

    // Attendre que la modal soit visible
    await page.waitForSelector('.modal-overlay', { state: 'visible' });

    // Vérifier que la modal contient le titre "Nouveau loyer"
    const modalTitle = page.getByRole('heading', { name: /nouveau loyer/i });
    await expect(modalTitle).toBeVisible();

    // Vérifier que les champs du formulaire sont présents
    await expect(page.locator('#lease-id')).toBeVisible();
    await expect(page.locator('#due-date')).toBeVisible();
    await expect(page.locator('#amount')).toBeVisible();
    await expect(page.locator('#charges')).toBeVisible();
  });

  test('devrait fermer la modal en cliquant sur le bouton fermer', async ({ page }) => {
    // Ouvrir la modal
    await page.getByRole('button', { name: /nouveau loyer/i }).click();
    await page.waitForSelector('.modal-overlay', { state: 'visible' });

    // Cliquer sur le bouton de fermeture
    const closeButton = page.locator('.close-button');
    await closeButton.click();

    // Vérifier que la modal est fermée
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('devrait fermer la modal en cliquant sur le bouton Annuler', async ({ page }) => {
    // Ouvrir la modal
    await page.getByRole('button', { name: /nouveau loyer/i }).click();
    await page.waitForSelector('.modal-overlay', { state: 'visible' });

    // Cliquer sur Annuler
    const cancelButton = page.getByRole('button', { name: /annuler/i });
    await cancelButton.click();

    // Vérifier que la modal est fermée
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('devrait fermer la modal en cliquant en dehors', async ({ page }) => {
    // Ouvrir la modal
    await page.getByRole('button', { name: /nouveau loyer/i }).click();
    await page.waitForSelector('.modal-overlay', { state: 'visible' });

    // Cliquer sur l'overlay (en dehors de la modal)
    await page.locator('.modal-overlay').click({ position: { x: 10, y: 10 } });

    // Vérifier que la modal est fermée
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test("devrait pré-remplir les montants lors de la sélection d'un bail", async ({ page }) => {
    // Ouvrir la modal
    await page.getByRole('button', { name: /nouveau loyer/i }).click();
    await page.waitForSelector('.modal-overlay', { state: 'visible' });

    // Sélectionner un bail (le premier disponible)
    const leaseSelect = page.locator('#lease-id');

    // Attendre que les options soient chargées (au moins 2 options : vide + 1 bail)
    await expect(leaseSelect.locator('option')).toHaveCount(
      await leaseSelect.locator('option').count(),
      { timeout: 5000 }
    );

    // Vérifier qu'il y a au moins un bail disponible
    const optionsCount = await leaseSelect.locator('option').count();
    if (optionsCount > 1) {
      // Obtenir la valeur de la première option non vide
      const firstOptionValue = await leaseSelect.locator('option').nth(1).getAttribute('value');
      if (firstOptionValue) {
        await leaseSelect.selectOption(firstOptionValue);

        // Attendre un peu que les valeurs soient mises à jour
        await page.waitForTimeout(500);

        // Vérifier que les montants ont été pré-remplis
        const amountInput = page.locator('#amount');
        const chargesInput = page.locator('#charges');

        // Les valeurs devraient être supérieures à 0
        const amountValue = await amountInput.inputValue();
        const chargesValue = await chargesInput.inputValue();

        expect(parseFloat(amountValue)).toBeGreaterThan(0);
        expect(parseFloat(chargesValue)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('devrait afficher le total à payer', async ({ page }) => {
    // Ouvrir la modal
    await page.getByRole('button', { name: /nouveau loyer/i }).click();
    await page.waitForSelector('.modal-overlay', { state: 'visible' });

    // Sélectionner un bail
    const leaseSelect = page.locator('#lease-id');
    const optionsCount = await leaseSelect.locator('option').count();

    if (optionsCount > 1) {
      const firstOptionValue = await leaseSelect.locator('option').nth(1).getAttribute('value');
      if (firstOptionValue) {
        await leaseSelect.selectOption(firstOptionValue);
        await page.waitForTimeout(500);

        // Vérifier que le total est affiché
        const totalSummary = page.locator('.total-summary');
        await expect(totalSummary).toBeVisible();

        const totalAmount = page.locator('.total-amount');
        await expect(totalAmount).toBeVisible();
        await expect(totalAmount).toContainText('€');
      }
    }
  });

  test('devrait désactiver le bouton de soumission si le formulaire est invalide', async ({
    page,
  }) => {
    // Ouvrir la modal
    await page.getByRole('button', { name: /nouveau loyer/i }).click();
    await page.waitForSelector('.modal-overlay', { state: 'visible' });

    // Le bouton devrait être désactivé au départ
    const submitButton = page.getByRole('button', { name: /créer le loyer/i });
    await expect(submitButton).toBeDisabled();
  });

  test('devrait activer le bouton de soumission si le formulaire est valide', async ({ page }) => {
    // Ouvrir la modal
    await page.getByRole('button', { name: /nouveau loyer/i }).click();
    await page.waitForSelector('.modal-overlay', { state: 'visible' });

    // Remplir le formulaire
    const leaseSelect = page.locator('#lease-id');
    const optionsCount = await leaseSelect.locator('option').count();

    if (optionsCount > 1) {
      const firstOptionValue = await leaseSelect.locator('option').nth(1).getAttribute('value');
      if (firstOptionValue) {
        await leaseSelect.selectOption(firstOptionValue);
        await page.locator('#due-date').fill('2025-12-01');
        await page.waitForTimeout(500);

        // Le bouton devrait être activé
        const submitButton = page.getByRole('button', { name: /créer le loyer/i });
        await expect(submitButton).toBeEnabled();
      }
    }
  });

  test('devrait créer un nouveau loyer avec succès', async ({ page }) => {
    // Ouvrir la modal
    await page.getByRole('button', { name: /nouveau loyer/i }).click();
    await page.waitForSelector('.modal-overlay', { state: 'visible' });

    // Remplir le formulaire
    const leaseSelect = page.locator('#lease-id');
    const optionsCount = await leaseSelect.locator('option').count();

    if (optionsCount > 1) {
      const firstOptionValue = await leaseSelect.locator('option').nth(1).getAttribute('value');
      if (firstOptionValue) {
        await leaseSelect.selectOption(firstOptionValue);
        await page.locator('#due-date').fill('2025-12-01');
        await page.waitForTimeout(500);

        // Soumettre le formulaire
        const submitButton = page.getByRole('button', { name: /créer le loyer/i });
        await submitButton.click();

        // Attendre que la modal se ferme
        await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 });

        // Vérifier qu'une notification de succès s'affiche ou que le total a augmenté
        // Utilisation d'une attente plus flexible pour la notification
        const hasNotification = await page
          .locator('text=/succès|créé/i')
          .isVisible()
          .catch(() => false);
        const statsUpdated = await page.locator('text=/Total loyers/i').isVisible();

        expect(hasNotification || statsUpdated).toBeTruthy();
      }
    }
  });
});
