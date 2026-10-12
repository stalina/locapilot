import { test, expect, type Page } from '@playwright/test';
import { resetApp, navigateFromSidebar, withinModal } from './utils/app';
import { createProperty } from './utils/flows';

// Amounts are formatted by Intl (fr-FR), whose group separator is a narrow
// no-break space: match any whitespace between the groups (and trailing).
const amount = (text: string) => new RegExp(`^\\s*${text.replace(/ /g, '\\s')}\\s*$`);

/**
 * Seed an active lease of `propertyName` with 12 rents of 800 € (+50 € charges)
 * paid during `year`. Paying a year of rents in the past through the UI is
 * impractical (the payment form records today's date).
 */
async function seedPaidRents(page: Page, propertyName: string, year: number) {
  await page.evaluate(
    async ({ propertyName, year }) => {
      function request<T>(req: IDBRequest<T>): Promise<T> {
        return new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      }
      const db = await request(indexedDB.open('locapilot'));
      const now = new Date();
      const tx = db.transaction(['properties', 'leases', 'rents'], 'readwrite');
      const properties = (await request(tx.objectStore('properties').getAll())) as {
        id: number;
        name: string;
      }[];
      const property = properties.find(p => p.name === propertyName);
      if (!property) throw new Error(`Property not found: ${propertyName}`);
      const leaseId = await request(
        tx.objectStore('leases').add({
          propertyId: property.id,
          tenantIds: [],
          startDate: new Date(year, 0, 1),
          rent: 800,
          charges: 50,
          deposit: 800,
          paymentDay: 5,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })
      );
      for (let month = 0; month < 12; month++) {
        const date = new Date(year, month, 5, 12);
        tx.objectStore('rents').add({
          leaseId,
          dueDate: date,
          paidDate: date,
          amount: 800,
          charges: 50,
          paidAmount: 850,
          status: 'paid',
          createdAt: now,
          updatedAt: now,
        });
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { propertyName, year }
  );
}

async function addExpense(
  page: Page,
  expense: { category: string; label: string; amount: string; date: string }
) {
  const section = page.locator('[data-testid="property-expenses-section"]');
  await section.scrollIntoViewIfNeeded();
  await section.locator('[data-testid="add-expense-button"]').click();
  const modal = withinModal(page, /Ajouter une dépense/i);
  await modal.waitFor({ state: 'visible' });
  await modal.locator('[data-testid="expense-category"]').selectOption(expense.category);
  await modal.locator('[data-testid="expense-label"]').fill(expense.label);
  await modal.locator('[data-testid="expense-amount"]').fill(expense.amount);
  await modal.locator('[data-testid="expense-date"]').fill(expense.date);
  await modal.locator('[data-testid="expense-form-submit"]').click();
  await expect(modal).toBeHidden();
}

test.describe('Récapitulatif fiscal 2044 (issue #48)', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('Le récapitulatif calcule les lignes 2044 et exporte le CSV', async ({ page }) => {
    const year = new Date().getFullYear() - 1;
    const name = `E2E Fiscal ${Date.now()}`;

    // A property with a year of paid rents...
    await createProperty(page, { name });
    await seedPaidRents(page, name, year);

    // ...and expenses recorded from its detail page, including loan interest.
    const card = page.locator('.property-card', { hasText: name }).first();
    await Promise.all([page.waitForURL(/\/properties\/\d+$/), card.click()]);
    await addExpense(page, {
      category: 'property-tax',
      label: 'Taxe foncière',
      amount: '1250',
      date: `${year}-10-15`,
    });
    await addExpense(page, {
      category: 'loan-interest',
      label: 'Intérêts prêt',
      amount: '2100',
      date: `${year}-12-31`,
    });

    await navigateFromSidebar(page, /Fiscalit[ée]/i, /\/fiscal$/);
    await expect(page.getByRole('heading', { name: 'Récapitulatif fiscal' })).toBeVisible();
    await page.locator('[data-testid="fiscal-year-select"]').selectOption(String(year));

    const total = (line: number) =>
      page.locator(`[data-testid="fiscal-line-${line}"] [data-testid="fiscal-line-total"]`);
    await expect(total(211)).toHaveText(amount('9 600 €'));
    await expect(total(240)).toHaveText(amount('1 270 €')); // 20 (forfait) + 1 250
    await expect(total(250)).toHaveText(amount('2 100 €'));
    await expect(total(261)).toHaveText(amount('6 230 €'));
    await expect(page.locator('[data-testid="fiscal-micro-foncier-hint"]')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="fiscal-export-csv"]').click(),
    ]);
    expect(download.suggestedFilename()).toBe(`recapitulatif-fiscal-${year}.csv`);
  });
});
