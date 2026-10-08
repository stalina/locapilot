import { test, expect } from '@playwright/test';
import { resetApp, navigateFromSidebar, withinModal } from './utils/app';

// Amounts are formatted by Intl (fr-FR), whose group separator is a narrow
// no-break space: match any whitespace between the groups.
const amount = (text: string) => new RegExp(`^${text.replace(/ /g, '\\s')}$`);

test.describe('Dépenses & rentabilité (issue #47)', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await navigateFromSidebar(page, /Propri[ée]t[ée]s|Properties/i, /\/properties/);
  });

  test("Ajouter une dépense met à jour le total et le rendement d'un bien", async ({ page }) => {
    const name = `E2E Bien rentabilité ${Date.now()}`;
    const year = new Date().getFullYear();

    // Create a property with a purchase price and acquisition costs.
    await page.locator('[data-testid="new-property-button"]').first().click();
    const propertyModal = withinModal(page, /Nouveau bien/i);
    await propertyModal.waitFor({ state: 'visible', timeout: 10_000 });
    await propertyModal.locator('[data-testid="property-name"]').fill(name);
    await propertyModal.locator('[data-testid="property-address"]').fill('10 rue Gambetta');
    await propertyModal.locator('input[data-testid="property-surface"]').fill('45');
    await propertyModal.locator('input[data-testid="property-rooms"]').fill('2');
    await propertyModal.locator('input[data-testid="property-rent"]').fill('800');
    await propertyModal.locator('input[data-testid="property-purchasePrice"]').fill('180000');
    await propertyModal.locator('input[data-testid="property-acquisitionCosts"]').fill('15000');
    await propertyModal.locator('[data-testid="property-form-submit"]').click();

    // Open its detail page.
    const card = page.locator('.property-card', { hasText: name }).first();
    await expect(card).toBeVisible();
    await Promise.all([page.waitForURL(/\/properties\/\d+$/), card.click()]);

    const section = page.locator('[data-testid="property-expenses-section"]');
    await section.scrollIntoViewIfNeeded();
    await expect(section.locator('[data-testid="expenses-empty"]')).toHaveText(
      'Aucune dépense enregistrée pour cette année'
    );
    await expect(section.locator('[data-testid="kpi-expenses"]')).toHaveText(amount('0,00 €'));
    await expect(section.locator('[data-testid="kpi-net-yield"]')).toHaveText(amount('0,00 %'));

    // Add an expense.
    await section.locator('[data-testid="add-expense-button"]').click();
    const expenseModal = withinModal(page, /Ajouter une dépense/i);
    await expenseModal.waitFor({ state: 'visible' });
    await expenseModal.locator('[data-testid="expense-category"]').selectOption('works');
    await expenseModal.locator('[data-testid="expense-label"]').fill('Remplacement chaudière');
    await expenseModal.locator('[data-testid="expense-amount"]').fill('2400');
    await expenseModal.locator('[data-testid="expense-date"]').fill(`${year}-04-02`);
    await expenseModal.locator('[data-testid="expense-form-submit"]').click();
    await expect(expenseModal).toBeHidden();

    // The expense is listed, and the totals and yields are updated:
    // net yield = -2 400 / (180 000 + 15 000) = -1,23 %.
    const row = section.locator('[data-testid="expense-row"]');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Remplacement chaudière');
    await expect(row).toContainText('Travaux');
    await expect(section.locator('[data-testid="kpi-expenses"]')).toHaveText(amount('2 400,00 €'));
    await expect(section.locator('[data-testid="kpi-net-result"]')).toHaveText(
      amount('-2 400,00 €')
    );
    await expect(section.locator('[data-testid="kpi-gross-yield"]')).toHaveText(amount('0,00 %'));
    await expect(section.locator('[data-testid="kpi-net-yield"]')).toHaveText(amount('-1,23 %'));
    await expect(section.locator('[data-testid="expense-category-totals"]')).toContainText(
      'Travaux'
    );
  });
});
