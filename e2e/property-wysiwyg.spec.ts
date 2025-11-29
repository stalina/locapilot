import { test, expect } from '@playwright/test';

test.describe('WYSIWYG Property Description', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to properties page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: /propriétés/i }).click();
    await page.waitForLoadState('networkidle');
  });

  test('should display rich text editor in property creation modal', async ({ page }) => {
    // Click on new property button
    await page.getByRole('button', { name: /nouveau bien/i }).click();

    // Wait for modal to open
    await page.waitForSelector('.rich-text-editor', { timeout: 5000 });

    // Verify editor toolbar is present
    await expect(page.locator('.editor-toolbar')).toBeVisible();

    // Verify editor content area is present
    await expect(page.locator('.rich-text-editor-content')).toBeVisible();
  });

  test('should format text with bold and italic', async ({ page }) => {
    // Open new property modal
    await page.getByRole('button', { name: /nouveau bien/i }).click();
    await page.waitForSelector('.rich-text-editor');

    // Fill required fields
    await page.fill('[data-testid="property-name"]', 'Test Property WYSIWYG');
    await page.fill('[data-testid="property-address"]', '123 Test Street');

    // Click in editor
    const editor = page.locator('.rich-text-editor-content');
    await editor.click();

    // Type some text
    await editor.type('Texte normal ');

    // Click bold button
    await page.locator('.editor-toolbar button[title*="Gras"]').first().click();
    await editor.type('texte en gras');

    // Click bold again to disable
    await page.locator('.editor-toolbar button[title*="Gras"]').first().click();
    await editor.type(' et ');

    // Click italic button
    await page.locator('.editor-toolbar button[title*="Italique"]').first().click();
    await editor.type('texte en italique');

    // Fill other required fields
    await page.fill('[data-testid="property-surface"]', '50');
    await page.fill('[data-testid="property-rooms"]', '2');
    await page.fill('[data-testid="property-rent"]', '800');

    // Submit form
    await page.getByRole('button', { name: /créer/i }).click();

    // Wait for modal to close
    await page.waitForSelector('.rich-text-editor', { state: 'hidden', timeout: 5000 });

    // Click on the created property to view details
    await page.getByText('Test Property WYSIWYG').click();
    await page.waitForLoadState('networkidle');

    // Verify formatted text is displayed
    await expect(page.locator('.rich-text-display')).toBeVisible();
    await expect(page.locator('.rich-text-display strong')).toContainText('texte en gras');
    await expect(page.locator('.rich-text-display em')).toContainText('texte en italique');
  });

  test('should create headings and lists', async ({ page }) => {
    // Open new property modal
    await page.getByRole('button', { name: /nouveau bien/i }).click();
    await page.waitForSelector('.rich-text-editor');

    // Fill required fields
    await page.fill('[data-testid="property-name"]', 'Property with Lists');
    await page.fill('[data-testid="property-address"]', '456 List Avenue');

    // Click in editor
    const editor = page.locator('.rich-text-editor-content');
    await editor.click();

    // Create H2 heading
    await page.locator('.editor-toolbar button:has-text("H2")').click();
    await editor.type('Caractéristiques');
    await page.keyboard.press('Enter');

    // Create bullet list
    await page.locator('.editor-toolbar button[title*="Liste à puces"]').click();
    await editor.type('Proche métro');
    await page.keyboard.press('Enter');
    await editor.type('Balcon');
    await page.keyboard.press('Enter');
    await editor.type('Cave');

    // Fill other required fields
    await page.fill('[data-testid="property-surface"]', '65');
    await page.fill('[data-testid="property-rooms"]', '3');
    await page.fill('[data-testid="property-rent"]', '1200');

    // Submit form
    await page.getByRole('button', { name: /créer/i }).click();
    await page.waitForSelector('.rich-text-editor', { state: 'hidden', timeout: 5000 });

    // View property details
    await page.getByText('Property with Lists').click();
    await page.waitForLoadState('networkidle');

    // Verify heading and list are displayed
    await expect(page.locator('.rich-text-display h2')).toContainText('Caractéristiques');
    await expect(page.locator('.rich-text-display ul li')).toHaveCount(3);
  });

  test('should sanitize dangerous HTML', async ({ page }) => {
    // Open new property modal
    await page.getByRole('button', { name: /nouveau bien/i }).click();
    await page.waitForSelector('.rich-text-editor');

    // Fill required fields
    await page.fill('[data-testid="property-name"]', 'Property with XSS Test');
    await page.fill('[data-testid="property-address"]', '789 Security Street');

    const editor = page.locator('.rich-text-editor-content');
    await editor.click();
    await editor.type('Safe text');

    await page.fill('[data-testid="property-surface"]', '40');
    await page.fill('[data-testid="property-rooms"]', '1');
    await page.fill('[data-testid="property-rent"]', '600');

    await page.getByRole('button', { name: /créer/i }).click();
    await page.waitForSelector('.rich-text-editor', { state: 'hidden', timeout: 5000 });

    // View property details
    await page.getByText('Property with XSS Test').click();
    await page.waitForLoadState('networkidle');

    // Verify no script tags in DOM
    const pageContent = await page.content();
    expect(pageContent).not.toContain('<script>');
    expect(pageContent).not.toContain('onclick');
  });

  test('should edit existing property description with WYSIWYG', async ({ page }) => {
    // Create a property first
    await page.getByRole('button', { name: /nouveau bien/i }).click();
    await page.waitForSelector('.rich-text-editor');

    await page.fill('[data-testid="property-name"]', 'Property to Edit');
    await page.fill('[data-testid="property-address"]', '101 Edit Street');

    const editor = page.locator('.rich-text-editor-content');
    await editor.click();
    await editor.type('Description originale');

    await page.fill('[data-testid="property-surface"]', '55');
    await page.fill('[data-testid="property-rooms"]', '2');
    await page.fill('[data-testid="property-rent"]', '900');

    await page.getByRole('button', { name: /créer/i }).click();
    await page.waitForSelector('.rich-text-editor', { state: 'hidden', timeout: 5000 });

    // View and edit property
    await page.getByText('Property to Edit').click();
    await page.waitForLoadState('networkidle');

    // Click edit button
    await page.getByRole('button', { name: /modifier/i }).click();
    await page.waitForSelector('.rich-text-editor');

    // Verify existing content is loaded in editor
    await expect(editor).toContainText('Description originale');

    // Add more content
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await editor.type(' Description modifiée');

    // Save
    await page.getByRole('button', { name: /enregistrer/i }).click();
    await page.waitForSelector('.rich-text-editor', { state: 'hidden', timeout: 5000 });

    // Verify updated content
    await expect(page.locator('.rich-text-display')).toContainText('Description modifiée');
  });
});
