import { test, expect } from '@playwright/test';
import { resetApp, navigateFromSidebar } from './utils/app';

test.describe('Settings - Synchronisation P2P', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await navigateFromSidebar(page, /Param[èe]tres|Settings/i, /\/settings/);
  });

  test('Cas principal : démarrer une session hôte affiche le bouton Arrêter', async ({ page }) => {
    const p2pCard = page
      .locator('.setting-card', { hasText: 'Synchronisation Peer-to-peer' })
      .first();
    await expect(p2pCard).toBeVisible({ timeout: 10_000 });

    // Badge expérimental visible
    await expect(p2pCard.locator('.badge-experimental')).toBeVisible();

    // Le formulaire client expose bien deux champs
    await expect(p2pCard.locator('input[placeholder*="ID de session"]')).toBeVisible();
    await expect(p2pCard.locator('input[placeholder*="Code PIN"]')).toBeVisible();

    // Cliquer "Héberger" → le bouton passe immédiatement en "Arrêter"
    await p2pCard.getByRole('button', { name: 'Héberger' }).click();
    await expect(p2pCard.getByRole('button', { name: 'Arrêter' })).toBeVisible({
      timeout: 5_000,
    });

    // Cliquer "Arrêter" → retour à l'état initial
    await p2pCard.getByRole('button', { name: 'Arrêter' }).click();
    await expect(p2pCard.getByRole('button', { name: 'Héberger' })).toBeVisible({
      timeout: 5_000,
    });
  });

  test('Le formulaire client expose les deux champs requis : ID de session et code PIN', async ({
    page,
  }) => {
    const p2pCard = page
      .locator('.setting-card', { hasText: 'Synchronisation Peer-to-peer' })
      .first();
    await expect(p2pCard).toBeVisible({ timeout: 10_000 });

    const sessionInput = p2pCard.locator('input[placeholder*="ID de session"]');
    const pinInput = p2pCard.locator('input[placeholder*="Code PIN"]');

    await expect(sessionInput).toBeVisible();
    await expect(pinInput).toBeVisible();

    // Les deux champs démarrent vides — aucune credential pré-remplie
    await expect(sessionInput).toHaveValue('');
    await expect(pinInput).toHaveValue('');
  });
});

test.describe('Settings - e2e', () => {
  test('Modifier et persister les paramètres', async ({ page }) => {
    await resetApp(page);
    await navigateFromSidebar(page, /Param[èe]tres|Settings/i, /\/settings/);

    const ownerCard = page.locator('.setting-card', { hasText: 'Nom du propriétaire' }).first();
    await expect(ownerCard).toBeVisible({ timeout: 10_000 });

    const newName = `E2E Owner ${Date.now()}`;
    await ownerCard.locator('input[type="text"]').fill(newName);

    // Le save déclenche un alert(). On attend explicitement le dialog pour éviter le flaky.
    const saveButton = ownerCard.getByRole('button', { name: 'Enregistrer' });
    await expect(saveButton).toBeEnabled();

    const dialogPromise = page.waitForEvent('dialog', { timeout: 10_000 });
    // Le handler du bouton peut déclencher une navigation interne (ou un état router) ;
    // on évite d'attendre la fin de "scheduled navigations".
    await saveButton.click({ noWaitAfter: true });

    const dialog = await dialogPromise;
    await dialog.accept();

    await page.reload();

    const ownerCardAfter = page
      .locator('.setting-card', { hasText: 'Nom du propriétaire' })
      .first();
    await expect(ownerCardAfter).toBeVisible({ timeout: 10_000 });
    await expect(ownerCardAfter.locator('input[type="text"]')).toHaveValue(newName);
  });
});
