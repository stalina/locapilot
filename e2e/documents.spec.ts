import { test, expect } from '@playwright/test';
import { resetApp, navigateFromSidebar } from './utils/app';

test.describe('Documents - e2e', () => {
  test('Upload, recherche, filtre et suppression', async ({ page }) => {
    await resetApp(page);
    await navigateFromSidebar(page, /Documents/i, /\/documents/);

    const fileInput = page.locator('.upload-zone input[type=file]').first();
    await fileInput.setInputFiles({
      name: 'tenants_modal.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<!doctype html><html><body>locapilot e2e</body></html>', 'utf-8'),
    });

    const card = page.locator('.document-card', { hasText: 'tenants_modal.html' }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    // Recherche par nom
    const search = page.getByPlaceholder('Rechercher un document...');
    await search.fill('tenants_modal');
    await expect(page.locator('.document-card')).toHaveCount(1);

    // Filtrer "Autres" (le handler upload tag en type 'other')
    await page.locator('.filter-button', { hasText: 'Autres' }).click();
    await expect(page.locator('.document-card', { hasText: 'tenants_modal.html' })).toBeVisible();

    // Supprimer
    page.on('dialog', async d => {
      await d.accept();
    });

    await page
      .locator('.document-card', { hasText: 'tenants_modal.html' })
      .first()
      .getByTitle('Supprimer')
      .click();
    await expect(page.locator('.document-card', { hasText: 'tenants_modal.html' })).toHaveCount(0);
  });
});

test.describe('Documents - aperçu inline', () => {
  // 1x1 transparent PNG
  const PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQDNxjuiAAAAAElFTkSuQmCC';

  test("Aperçu inline d'une image", async ({ page }) => {
    await resetApp(page);
    await navigateFromSidebar(page, /Documents/i, /\/documents/);

    const fileInput = page.locator('.upload-zone input[type=file]').first();
    await fileInput.setInputFiles({
      name: 'apercu.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_BASE64, 'base64'),
    });

    const card = page.locator('.document-card', { hasText: 'apercu.png' }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    // Ouvrir l'aperçu inline
    await card.locator('[data-testid=document-preview-button]').click();

    const modalImage = page.locator('[data-testid=document-preview-image]');
    await expect(modalImage).toBeVisible();
    await expect(modalImage).toHaveAttribute('src', /^blob:/);

    // Fermer l'aperçu
    await page.locator('[data-testid=document-preview-close]').click();
    await expect(page.locator('[data-testid=document-preview]')).toHaveCount(0);
  });
});

test.describe('Documents - aperçu PDF sans type MIME sur le Blob', () => {
  test('un PDF stocké sans type MIME sur son Blob se prévisualise en application/pdf', async ({
    page,
  }) => {
    await resetApp(page);

    // Injecte directement en base un document PDF dont le Blob stocké a un
    // ".type" vide (cas des données seedées/importées). Reproduit le bug #45.
    await page.evaluate(async () => {
      const pdf =
        '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
        '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
        'trailer<</Size 4/Root 1 0 R>>\n%%EOF';
      const blob = new Blob([pdf], { type: '' });
      const now = new Date();
      const rec = {
        name: 'sans-type.pdf',
        type: 'other',
        mimeType: 'application/pdf',
        size: blob.size,
        data: blob,
        createdAt: now,
        updatedAt: now,
      };
      const req = indexedDB.open('locapilot');
      const db: IDBDatabase = await new Promise((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      await new Promise<void>((res, rej) => {
        const tx = db.transaction('documents', 'readwrite');
        tx.objectStore('documents').add(rec);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    });

    await navigateFromSidebar(page, /Documents/i, /\/documents/);

    const card = page.locator('.document-card', { hasText: 'sans-type.pdf' }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    await card.locator('[data-testid=document-preview-button]').click();

    const frame = page.locator('[data-testid=document-preview-pdf]');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('src', /^blob:/);
    await expect(page.locator('[data-testid=document-preview-error]')).toHaveCount(0);

    // L'URL objet doit être servie avec le bon Content-Type, sinon l'iframe
    // afficherait les octets bruts (%PDF...) au lieu de rendre le PDF.
    const contentType = await frame.evaluate(async el => {
      const src = (el as HTMLIFrameElement).src;
      const resp = await fetch(src);
      return resp.headers.get('content-type');
    });
    expect(contentType).toBe('application/pdf');

    await page.locator('[data-testid=document-preview-close]').click();
    await expect(page.locator('[data-testid=document-preview]')).toHaveCount(0);
  });
});
