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

  test('Golden path : héberger génère un ID de session UUID v4 et un PIN 6 chiffres (crypto)', async ({
    page,
  }) => {
    const p2pCard = page
      .locator('.setting-card', { hasText: 'Synchronisation Peer-to-peer' })
      .first();
    await expect(p2pCard).toBeVisible({ timeout: 10_000 });

    // Le descriptif reflète la clé de session par appairage (pas de secret de build).
    await expect(p2pCard).toContainText(/clé de session propre à chaque appairage/i);

    // Démarrer l'hébergement : les identifiants de session s'affichent.
    await p2pCard.getByRole('button', { name: 'Héberger' }).click();

    const sessionInfo = p2pCard.locator('.peer-session-info');
    await expect(sessionInfo).toBeVisible({ timeout: 15_000 });

    // L'ID de session est un UUID v4 généré via crypto.getRandomValues,
    // préfixé "lcp-", sans timestamp ni composant devinable.
    const sessionId = (await sessionInfo.locator('code').first().innerText()).trim();
    expect(sessionId).toMatch(
      /^lcp-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    // Le PIN est composé de 6 chiffres.
    const pin = (await sessionInfo.locator('.peer-pin').first().innerText()).trim();
    expect(pin).toMatch(/^\d{6}$/);

    // Le PIN n'est jamais inclus dans l'ID de session.
    expect(sessionId).not.toContain(pin);
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

test.describe('Settings - Import strict validation (#80 C2)', () => {
  const iso = '2026-01-01T00:00:00.000Z';

  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await navigateFromSidebar(page, /Param[èe]tres|Settings/i, /\/settings/);
  });

  test('Cas principal : un backup valide est importé, un backup corrompu est rejeté sans perte de données', async ({
    page,
  }) => {
    const villaName = `E2E Import Villa ${Date.now()}`;

    const validBackup = {
      properties: [
        {
          id: 1,
          name: villaName,
          address: '1 rue de l Import',
          type: 'house',
          surface: 120,
          rooms: 5,
          rent: 1500,
          charges: 100,
          status: 'vacant',
          createdAt: iso,
          updatedAt: iso,
        },
      ],
      tenants: [],
      version: '1.0.0',
    };

    // Un seul enregistrement corrompu (email en nombre) doit rejeter TOUT l'import.
    const corruptedBackup = {
      properties: [],
      tenants: [
        {
          id: 1,
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 12345,
          phone: '0601020304',
          status: 'active',
          createdAt: iso,
          updatedAt: iso,
        },
      ],
      version: '1.0.0',
    };

    // Confirmations (« remplacer les données ») et alerts sont acceptées.
    page.on('dialog', dialog => dialog.accept().catch(() => {}));

    const importButton = page
      .locator('.setting-card', { hasText: 'Importer les données' })
      .getByRole('button', { name: /Importer/i });
    await expect(importButton).toBeVisible({ timeout: 10_000 });

    // 1) Import d'un backup VALIDE → succès, données présentes.
    const [chooser1] = await Promise.all([page.waitForEvent('filechooser'), importButton.click()]);
    await chooser1.setFiles({
      name: 'backup-valide.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(validBackup)),
    });

    // L'app redirige vers l'accueil après un import réussi.
    await page.waitForURL(/\/$|\/dashboard/, { timeout: 10_000 }).catch(() => {});

    await navigateFromSidebar(page, /Propri[ée]t[ée]s|Properties/i, /\/properties/);
    await expect(page.locator('.property-card', { hasText: villaName }).first()).toBeVisible({
      timeout: 10_000,
    });

    // 2) Import d'un backup CORROMPU → rejeté, données existantes intactes.
    await navigateFromSidebar(page, /Param[èe]tres|Settings/i, /\/settings/);
    const importButton2 = page
      .locator('.setting-card', { hasText: 'Importer les données' })
      .getByRole('button', { name: /Importer/i });
    await expect(importButton2).toBeVisible({ timeout: 10_000 });

    const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), importButton2.click()]);
    await chooser2.setFiles({
      name: 'backup-corrompu.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(corruptedBackup)),
    });

    // La villa importée au préalable doit toujours être là (aucune destruction).
    await navigateFromSidebar(page, /Propri[ée]t[ée]s|Properties/i, /\/properties/);
    await expect(page.locator('.property-card', { hasText: villaName }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
