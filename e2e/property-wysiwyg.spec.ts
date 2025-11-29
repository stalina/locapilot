import { test, expect } from '@playwright/test';

test.describe('WYSIWYG Property Description (Quill)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: /propriétés/i }).click();
    await page.waitForLoadState('networkidle');
  });

  test("affiche l'éditeur Quill dans le modal de création", async ({ page }) => {
    await page
      .getByRole('button', { name: /nouveau bien|nouvelle propriété|nouveau bien/i })
      .click();
    await page.waitForSelector('.rich-text-editor', { timeout: 5000 });

    // Quill toolbar and editor
    await expect(page.locator('.ql-toolbar')).toBeVisible();
    await expect(page.locator('.ql-editor')).toBeVisible();
  });

  test('formate le texte en gras et italique et sauvegarde', async ({ page }) => {
    await page
      .getByRole('button', { name: /nouveau bien|nouvelle propriété|nouveau bien/i })
      .click();
    await page.waitForSelector('.rich-text-editor');

    await page.fill('[data-testid="property-name"]', 'Test Property WYSIWYG');
    await page.fill('[data-testid="property-address"]', '123 Test Street');

    const editor = page.locator('.ql-editor');
    await editor.click();

    await editor.type('Texte normal ');

    // Click bold on Quill toolbar
    await page.locator('.ql-toolbar .ql-bold').click();
    await editor.type('texte en gras');
    await page.locator('.ql-toolbar .ql-bold').click();

    await editor.type(' et ');
    await page.locator('.ql-toolbar .ql-italic').click();
    await editor.type('texte en italique');
    await page.locator('.ql-toolbar .ql-italic').click();

    // Fill required fields
    await page.fill('[data-testid="property-surface"]', '50');
    await page.fill('[data-testid="property-rooms"]', '2');
    await page.fill('[data-testid="property-rent"]', '800');

    // Submit form
    await page.getByRole('button', { name: /créer|Créer/i }).click();
    await page.waitForSelector('.rich-text-editor', { state: 'hidden', timeout: 5000 });

    // Open created property details
    await page.getByText('Test Property WYSIWYG').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.rich-text-display')).toBeVisible();
    await expect(page.locator('.rich-text-display strong')).toContainText('texte en gras');
    await expect(page.locator('.rich-text-display em')).toContainText('texte en italique');
  });

  test('crée titres et listes', async ({ page }) => {
    await page
      .getByRole('button', { name: /nouveau bien|nouvelle propriété|nouveau bien/i })
      .click();
    await page.waitForSelector('.rich-text-editor');

    await page.fill('[data-testid="property-name"]', 'Property with Lists');
    await page.fill('[data-testid="property-address"]', '456 List Avenue');

    const editor = page.locator('.ql-editor');
    await editor.click();

    // Use header picker: open first picker and select H2 (if present)
    const headerPicker = page.locator('.ql-toolbar .ql-picker').first();
    if (await headerPicker.count()) {
      await headerPicker.click();
      const optionH2 = page.locator('.ql-picker-options .ql-picker-item').nth(0);
      await optionH2.click();
    }

    await editor.type('Caractéristiques');
    await page.keyboard.press('Enter');

    // Bullet list
    await page.locator('.ql-toolbar .ql-list[value="bullet"]').click();
    await editor.type('Proche métro');
    await page.keyboard.press('Enter');
    await editor.type('Balcon');
    await page.keyboard.press('Enter');
    await editor.type('Cave');

    await page.fill('[data-testid="property-surface"]', '65');
    await page.fill('[data-testid="property-rooms"]', '3');
    await page.fill('[data-testid="property-rent"]', '1200');

    await page.getByRole('button', { name: /créer|Créer/i }).click();
    await page.waitForSelector('.rich-text-editor', { state: 'hidden', timeout: 5000 });

    await page.getByText('Property with Lists').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.rich-text-display h2')).toContainText('Caractéristiques');
    await expect(page.locator('.rich-text-display ul li')).toHaveCount(3);
  });

  test('sanitise le HTML dangereux', async ({ page }) => {
    await page
      .getByRole('button', { name: /nouveau bien|nouvelle propriété|nouveau bien/i })
      .click();
    await page.waitForSelector('.rich-text-editor');

    await page.fill('[data-testid="property-name"]', 'Property with XSS Test');
    await page.fill('[data-testid="property-address"]', '789 Security Street');

    const editor = page.locator('.ql-editor');
    await editor.click();
    await editor.type('Safe text');

    await page.fill('[data-testid="property-surface"]', '40');
    await page.fill('[data-testid="property-rooms"]', '1');
    await page.fill('[data-testid="property-rent"]', '600');

    await page.getByRole('button', { name: /créer|Créer/i }).click();
    await page.waitForSelector('.rich-text-editor', { state: 'hidden', timeout: 5000 });

    await page.getByText('Property with XSS Test').click();
    await page.waitForLoadState('networkidle');

    const pageContent = await page.content();
    expect(pageContent).not.toContain('<script>');
    expect(pageContent).not.toContain('onclick');
  });

  test('édite la description existante', async ({ page }) => {
    await page
      .getByRole('button', { name: /nouveau bien|nouvelle propriété|nouveau bien/i })
      .click();
    await page.waitForSelector('.rich-text-editor');

    await page.fill('[data-testid="property-name"]', 'Property to Edit');
    await page.fill('[data-testid="property-address"]', '101 Edit Street');

    const editor = page.locator('.ql-editor');
    await editor.click();
    await editor.type('Description originale');

    await page.fill('[data-testid="property-surface"]', '55');
    await page.fill('[data-testid="property-rooms"]', '2');
    await page.fill('[data-testid="property-rent"]', '900');

    await page.getByRole('button', { name: /créer|Créer/i }).click();
    await page.waitForSelector('.rich-text-editor', { state: 'hidden', timeout: 5000 });

    // Wait for the properties grid to show the new card
    await page.waitForSelector('.properties-grid', { timeout: 10000 });

    // Locate the property card reliably and click its edit button
    // Click the edit button inside the property card in the list (robust retry)
    const card = page
      .locator('.properties-grid')
      .locator('.property-card', { hasText: 'Property to Edit' })
      .first();
    await card.waitFor({ state: 'visible', timeout: 10000 });

    // Retry loop: some DOM re-renders may detach elements; try several times.
    let clicked = false;
    for (let i = 0; i < 20; i++) {
      try {
        const editRoleBtn = card.getByRole('button', { name: /modifier|edit/i }).first();
        if (await editRoleBtn.count()) {
          await editRoleBtn.click({ force: true });
          clicked = true;
          break;
        }
        const editTestId = card.locator('[data-testid="edit-property-button"]').first();
        if (await editTestId.count()) {
          await editTestId.click({ force: true });
          clicked = true;
          break;
        }
      } catch (e) {
        // ignore and retry
        console.warn('Retrying click on edit button due to error:', e);
      }
      await page.waitForTimeout(250);
    }
    if (!clicked) {
      throw new Error('Could not find edit button for property "Property to Edit"');
    }

    await page.waitForSelector('.rich-text-editor', { timeout: 10000 });

    // Verify existing content is loaded (give Quill extra time to hydrate)
    await expect(page.locator('.ql-editor')).toContainText('Description originale', {
      timeout: 10000,
    });

    await page.locator('.ql-editor').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.locator('.ql-editor').type(' Description modifiée');

    await page.getByRole('button', { name: /enregistrer|Enregistrer/i }).click();
    await page.waitForSelector('.rich-text-editor', { state: 'hidden', timeout: 5000 });

    // Open the created property detail to verify updated content
    await page.waitForSelector('.properties-grid', { timeout: 10000 });
    const createdCard = page
      .locator('.properties-grid .property-card', { hasText: 'Property to Edit' })
      .first();
    await createdCard.scrollIntoViewIfNeeded();
    // Click the property title within the card to open details
    const title = createdCard.locator('.property-name').first();
    if (await title.count()) {
      await title.click({ force: true });
    } else {
      await createdCard.click({ force: true });
    }
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.rich-text-display')).toContainText('Description modifiée', {
      timeout: 10000,
    });
  });
});
