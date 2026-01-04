import { test, expect } from '@playwright/test';
import { resetApp, navigateFromSidebar } from './utils/app';

test.describe('Settings - e2e', () => {
  test('Modifier et persister les paramètres', async ({ page }) => {
    await resetApp(page);
    await navigateFromSidebar(page, /Param[èe]tres|Settings/i, /\/settings/);

    // Le save déclenche un alert(). On l'accepte pour éviter un blocage.
    page.on('dialog', async d => {
      await d.accept();
    });

    const ownerCard = page.locator('.setting-card', { hasText: 'Nom du propriétaire' }).first();
    await expect(ownerCard).toBeVisible({ timeout: 10_000 });

    const newName = `E2E Owner ${Date.now()}`;
    await ownerCard.locator('input[type="text"]').fill(newName);
    await ownerCard.getByRole('button', { name: 'Enregistrer' }).click();

    await page.reload();
    await expect(ownerCard.locator('input[type="text"]')).toHaveValue(newName);
  });
});
