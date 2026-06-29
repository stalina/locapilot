import { test, expect } from '@playwright/test';
import { resetApp } from './utils/app';

test.describe('Error handling - capture globale et affichage', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('Cas principal : une erreur non capturée déclenche une notification utilisateur', async ({
    page,
  }) => {
    // Simule une erreur JS non capturée (ex. rejet de promesse, erreur runtime)
    await page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent('error', {
          message: 'Boom e2e',
          error: new Error('Boom e2e'),
        })
      );
    });

    // Le gestionnaire global affiche une notification d'erreur cohérente
    const notification = page.locator('.notification--error');
    await expect(notification).toBeVisible({ timeout: 5_000 });
    await expect(notification).toContainText(/erreur inattendue/i);
  });
});
