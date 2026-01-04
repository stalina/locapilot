import { test, expect } from '@playwright/test';
import { resetApp, navigateFromSidebar } from './utils/app';

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
