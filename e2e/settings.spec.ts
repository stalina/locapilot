import { test, expect, type Page } from '@playwright/test';
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

  test('Golden path : héberger génère un ID de session court dictable et un PIN 6 chiffres (crypto)', async ({
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

    // L'ID est un code court dictable (préfixe "LP" + 8 caractères d'un alphabet
    // sans caractères ambigus), généré via crypto.getRandomValues, ≤ 10 chars.
    const sessionId = (await sessionInfo.locator('code').first().innerText()).trim();
    expect(sessionId).toMatch(/^LP[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
    expect(sessionId.length).toBeLessThanOrEqual(10);

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

test.describe("Settings - Session hôte P2P après la déconnexion d'un appareil", () => {
  test("Golden path : un PIN incorrect ne met pas fin à la session de l'hôte", async ({
    page,
    browser,
  }) => {
    // Hôte (contexte par défaut) : démarrer une session.
    await resetApp(page);
    await navigateFromSidebar(page, /Param[èe]tres|Settings/i, /\/settings/);
    const hostCard = page.getByTestId('p2p-sync-card');
    await hostCard.getByRole('button', { name: 'Héberger' }).click();
    const sessionInfo = hostCard.locator('.peer-session-info');
    await expect(sessionInfo).toBeVisible({ timeout: 15_000 });
    const sessionId = (await sessionInfo.locator('code').first().innerText()).trim();
    const pin = (await sessionInfo.locator('.peer-pin').first().innerText()).trim();

    // Client (second navigateur isolé) : se connecter avec un PIN incorrect.
    const clientContext = await browser.newContext();
    try {
      const client = await clientContext.newPage();
      await resetApp(client);
      await navigateFromSidebar(client, /Param[èe]tres|Settings/i, /\/settings/);
      const clientCard = client.getByTestId('p2p-sync-card');
      await clientCard.locator('input[placeholder*="ID de session"]').fill(sessionId);
      await clientCard
        .locator('input[placeholder*="Code PIN"]')
        .fill(pin === '000000' ? '111111' : '000000');
      await clientCard.getByRole('button', { name: 'Se connecter' }).click();

      await expect(clientCard).toContainText('Authentification échouée — PIN incorrect', {
        timeout: 20_000,
      });

      // L'hôte rejette la connexion mais garde sa session ouverte et visible.
      await expect(hostCard).toContainText('Connexion rejetée — PIN incorrect');
      await expect(sessionInfo.locator('code').first()).toHaveText(sessionId);
      await expect(sessionInfo.locator('.peer-pin').first()).toHaveText(pin);
      await expect(sessionInfo.getByTestId('p2p-qr-code')).toBeVisible();
      await expect(hostCard.getByRole('button', { name: 'Arrêter' })).toBeVisible();
      await expect(hostCard).not.toContainText('stopped');
      await expect(clientCard).not.toContainText('stopped');
    } finally {
      await clientContext.close();
    }
  });
});

test.describe('Settings - QR code de synchronisation P2P', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await navigateFromSidebar(page, /Param[èe]tres|Settings/i, /\/settings/);
  });

  test("Golden path : l'hôte affiche un QR code et le lien d'appairage pré-remplit l'ID et le PIN", async ({
    page,
  }) => {
    const p2pCard = page.getByTestId('p2p-sync-card');
    await expect(p2pCard).toBeVisible({ timeout: 10_000 });

    // 1) Hôte : le QR code (généré localement) s'affiche à côté de l'ID et du PIN.
    await p2pCard.getByRole('button', { name: 'Héberger' }).click();
    const sessionInfo = p2pCard.locator('.peer-session-info');
    await expect(sessionInfo).toBeVisible({ timeout: 15_000 });

    const qrCode = sessionInfo.getByTestId('p2p-qr-code');
    await expect(qrCode).toBeVisible();
    await expect(qrCode).toHaveAttribute('alt', 'QR code de synchronisation');
    await expect(qrCode).toHaveAttribute('src', /^data:image\//);

    const sessionId = (await sessionInfo.locator('code').first().innerText()).trim();
    const pin = (await sessionInfo.locator('.peer-pin').first().innerText()).trim();
    expect(sessionId).toMatch(/^LP[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
    expect(pin).toMatch(/^\d{6}$/);

    // Arrêter l'hébergement : le QR code disparaît.
    await p2pCard.getByRole('button', { name: 'Arrêter' }).click();
    await expect(qrCode).toBeHidden();

    // 2) Ouvrir le lien d'appairage encodé dans le QR code : racine de l'app
    //    (base path Playwright, ex. /locapilot/) + identifiants dans le fragment.
    const appRootUrl = new URL('./', page.url()).href;
    await page.goto(`${appRootUrl}#p2p=${sessionId}&pin=${pin}`);

    // 3) Redirigé vers Paramètres, fragment retiré, champs pré-remplis, pas de connexion auto.
    await expect(page).toHaveURL(/\/settings$/, { timeout: 10_000 });
    expect(new URL(page.url()).hash).toBe('');

    const clientCard = page.getByTestId('p2p-sync-card');
    await expect(clientCard.locator('input[placeholder*="ID de session"]')).toHaveValue(sessionId);
    await expect(clientCard.locator('input[placeholder*="Code PIN"]')).toHaveValue(pin);
    await expect(clientCard).toContainText('Session de synchronisation détectée');
  });
});

test.describe('Settings - Synchronisation P2P large data', () => {
  // Dexie declares schema version 9, which maps to IndexedDB version 90.
  const EXPECTED_IDB_VERSION = 90;
  const SYNC_SUCCESS = 'Données synchronisées avec succès !';

  // Wait until the app has opened (and migrated) its database, without opening
  // it ourselves first (see relances.spec.ts).
  async function waitForDbReady(page: Page) {
    await page.waitForFunction(
      async expected => {
        const dbs = (await indexedDB.databases?.()) ?? [];
        return dbs.some(d => d.name === 'locapilot' && (d.version ?? 0) >= expected);
      },
      EXPECTED_IDB_VERSION,
      { timeout: 15_000 }
    );
  }

  /** Seed raw records (documents carry real Blobs) straight into IndexedDB. */
  async function seed(page: Page, opts: { propertyName: string; documentSizes: number[] }) {
    await page.evaluate(async ({ propertyName, documentSizes }) => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const req = indexedDB.open('locapilot');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const add = (store: string, value: unknown) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).add(value);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      const now = new Date();
      await add('properties', {
        name: propertyName,
        address: '1 rue du Stream',
        type: 'house',
        surface: 90,
        rooms: 4,
        rent: 1200,
        status: 'vacant',
        createdAt: now,
        updatedAt: now,
      });
      for (const [i, size] of documentSizes.entries()) {
        const content = new Uint8Array(size);
        for (let b = 0; b < size; b++) content[b] = (b * 31 + i) & 0xff;
        const blob = new Blob([content], { type: 'image/jpeg' });
        await add('documents', {
          name: `photo-${i}.jpg`,
          type: 'photo',
          mimeType: blob.type,
          size: blob.size,
          data: blob,
          createdAt: now,
          updatedAt: now,
        });
      }
      db.close();
    }, opts);
  }

  /** Name, byte size and a content checksum of every stored document Blob. */
  async function readDocuments(page: Page) {
    return page.evaluate(async () => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const req = indexedDB.open('locapilot');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const docs: Array<{ name: string; data: Blob | null }> = await new Promise(
        (resolve, reject) => {
          const req = db.transaction('documents').objectStore('documents').getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }
      );
      db.close();
      const out: Array<{ name: string; size: number; checksum: number }> = [];
      for (const doc of docs) {
        const bytes = doc.data ? new Uint8Array(await doc.data.arrayBuffer()) : new Uint8Array();
        let checksum = 0;
        for (const b of bytes) checksum = (checksum * 31 + b) >>> 0;
        out.push({ name: doc.name, size: bytes.byteLength, checksum });
      }
      return out.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await waitForDbReady(page);
  });

  async function openSettings(page: Page) {
    await navigateFromSidebar(page, /Param[èe]tres|Settings/i, /\/settings/);
    const card = page.getByTestId('p2p-sync-card');
    await expect(card).toBeVisible({ timeout: 10_000 });
    return card;
  }

  test('Golden path : synchroniser plusieurs Mo de documents entre deux appareils, en flux chiffré par morceaux', async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(120_000);
    // The P2P pairing goes through the public PeerJS broker.
    const brokerReachable = await fetch(`https://0.peerjs.com/peerjs/id?ts=${Date.now()}`, {
      signal: AbortSignal.timeout(5_000),
    })
      .then(r => r.ok)
      .catch(() => false);
    test.skip(!brokerReachable, 'Public PeerJS broker unreachable');

    // Device A (host): a few MB of documents → many 64 KiB chunks.
    const hostPage = page;
    await seed(hostPage, {
      propertyName: 'E2E Villa synchronisée',
      documentSizes: [1_500_000, 2 * 64 * 1024, 900_000],
    });
    const hostDocuments = await readDocuments(hostPage);
    expect(hostDocuments).toHaveLength(3);

    // Device B (client): its own browser context (own IndexedDB) with older data.
    const use = testInfo.project.use;
    const clientContext = await browser.newContext({
      baseURL: use.baseURL,
      viewport: use.viewport,
      userAgent: use.userAgent,
      isMobile: use.isMobile,
      hasTouch: use.hasTouch,
      deviceScaleFactor: use.deviceScaleFactor,
      serviceWorkers: 'block',
    });
    try {
      const clientPage = await clientContext.newPage();
      await resetApp(clientPage);
      await waitForDbReady(clientPage);
      await seed(clientPage, { propertyName: 'E2E Ancienne propriété B', documentSizes: [] });

      // Both confirmations are accepted; the client records what it is asked.
      hostPage.on('dialog', dialog => dialog.accept().catch(() => {}));
      const clientDialogs: string[] = [];
      clientPage.on('dialog', dialog => {
        clientDialogs.push(dialog.message());
        dialog.accept().catch(() => {});
      });

      // A hosts…
      const hostCard = await openSettings(hostPage);
      await hostCard.getByRole('button', { name: 'Héberger' }).click();
      const sessionInfo = hostCard.locator('.peer-session-info');
      await expect(sessionInfo).toBeVisible({ timeout: 15_000 });
      const sessionId = (await sessionInfo.locator('code').first().innerText()).trim();
      const pin = (await sessionInfo.locator('.peer-pin').first().innerText()).trim();

      // …B connects with the session ID and PIN.
      const clientCard = await openSettings(clientPage);
      await clientCard.locator('input[placeholder*="ID de session"]').fill(sessionId);
      await clientCard.locator('input[placeholder*="Code PIN"]').fill(pin);
      await clientCard.getByRole('button', { name: 'Se connecter' }).click();

      await expect.poll(() => clientDialogs, { timeout: 60_000 }).toContain(SYNC_SUCCESS);

      // B was asked to confirm with the announced size, before the bulk transfer.
      const consent = clientDialogs.find(m => m.startsWith('Recevoir des données'));
      expect(consent).toMatch(/≈ [\d,]+ Mo, 3 document\(s\)/);
      await expect(clientCard).toContainText('Synchronisation terminée');
      // A's session ends once B acknowledged the end of the stream and left.
      await expect(hostCard).toContainText(
        'Données envoyées — session de synchronisation terminée',
        { timeout: 30_000 }
      );
      await expect(sessionInfo).toHaveCount(0);
      await expect(hostCard.getByRole('button', { name: 'Héberger' })).toBeVisible();

      // B now holds exactly A's documents: same names, sizes and bytes.
      expect(await readDocuments(clientPage)).toEqual(hostDocuments);
      await navigateFromSidebar(clientPage, /Propri[ée]t[ée]s|Properties/i, /\/properties/);
      await expect(
        clientPage.locator('.property-card', { hasText: 'E2E Villa synchronisée' })
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        clientPage.locator('.property-card', { hasText: 'E2E Ancienne propriété B' })
      ).toHaveCount(0);
    } finally {
      await clientContext.close();
    }
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
