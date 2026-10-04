import { test, expect, type Locator } from '@playwright/test';
import { resetApp, navigateFromSidebar, withinModal } from './utils/app';
import { createTenant } from './utils/flows';

/**
 * True when the element is the topmost hit target at its center and next to the middle
 * of each edge (edge midpoints, unlike corners, are not clipped by border-radius).
 */
function isTopmost(locator: Locator): Promise<boolean> {
  return locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    const inset = 3;
    const midX = r.left + r.width / 2;
    const midY = r.top + r.height / 2;
    const points: Array<[number, number]> = [
      [midX, midY],
      [r.left + inset, midY],
      [r.right - inset, midY],
      [midX, r.top + inset],
      [midX, r.bottom - inset],
    ];
    return points.every(([x, y]) => el.contains(document.elementFromPoint(x, y)));
  });
}

test.describe('Locataires - e2e', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await navigateFromSidebar(page, /Locataires|Tenants/i, /\/tenants/);
  });

  test('Créer, rechercher, éditer et supprimer un locataire', async ({ page }) => {
    const firstName = `E2E_${Date.now()}`;
    const lastName = `Locataire`;
    const email = `e2e.${Date.now()}@example.com`;
    const fullName = `${firstName} ${lastName}`;

    // Créer
    await page.locator('[data-testid="new-tenant-button"]').first().click();
    const createModal = withinModal(page, /Locataire|Tenant/i);
    await createModal.waitFor({ state: 'visible', timeout: 10_000 });

    await createModal.locator('input[data-testid="tenant-firstName"]').fill(firstName);
    await createModal.locator('input[data-testid="tenant-lastName"]').fill(lastName);
    await createModal.locator('input[data-testid="tenant-email"]').fill(email);
    await createModal.locator('input[data-testid="tenant-phone"]').fill('0612345678');
    await createModal.locator('input[data-testid="tenant-birthDate"]').fill('1990-01-01');
    await createModal.locator('select[data-testid="tenant-status"]').selectOption('active');
    await createModal
      .locator('[data-testid="modal-footer"]')
      .getByRole('button', { name: /Cr[ée]er|Enregistrer/i })
      .click();

    const card = page.locator('.tenant-card', { hasText: fullName }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    // Recherche
    const searchBox = page.getByPlaceholder('Rechercher un locataire...');
    await searchBox.fill(email.split('@')[0]!);
    await expect(page.locator('.tenant-card')).toHaveCount(1);
    await searchBox.fill('');

    // Filtre Actifs
    await page.locator('.filter-button', { hasText: 'Actifs' }).click();
    await expect(page.locator('.tenant-card', { hasText: fullName })).toBeVisible();
    await page.locator('.filter-button', { hasText: 'Tous' }).click();

    // Éditer
    await card.locator('[data-testid="edit-tenant-button"]').click();
    const editModal = withinModal(page, /Locataire|Tenant/i);
    await editModal.waitFor({ state: 'visible', timeout: 10_000 });
    const updatedFirst = `${firstName}-mod`;
    await editModal.locator('input[data-testid="tenant-firstName"]').fill(updatedFirst);
    await editModal
      .locator('[data-testid="modal-footer"]')
      .getByRole('button', { name: /Enregistrer|Cr[ée]er/i })
      .click();

    await expect(
      page.locator('.tenant-card', { hasText: `${updatedFirst} ${lastName}` })
    ).toBeVisible({ timeout: 10_000 });

    // Supprimer
    const updatedCard = page
      .locator('.tenant-card', { hasText: `${updatedFirst} ${lastName}` })
      .first();
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    await updatedCard.locator('[data-testid="delete-tenant-button"]').click();

    const confirmBtn = page.getByRole('button', { name: /Supprimer/i }).first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }

    await expect(
      page.locator('.tenant-card', { hasText: `${updatedFirst} ${lastName}` })
    ).toHaveCount(0);
  });
});

test.describe('Locataires - Refus de candidature en mode sombre', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
  });

  test('Les champs de la modale de refus restent lisibles en mode sombre', async ({ page }) => {
    const { fullName } = await createTenant(page);

    await page.locator('.tenant-card', { hasText: fullName }).first().getByText(fullName).click();
    await page.waitForURL(/\/tenants\/\d+/, { timeout: 10_000 });

    await page.getByRole('button', { name: 'Refuser', exact: true }).click();
    const modal = withinModal(page, /Refuser la candidature/i);
    await modal.waitFor({ state: 'visible', timeout: 10_000 });

    await page.emulateMedia({ colorScheme: 'dark' });

    // --bg-primary (neutral-900) doit être accompagné de --text-primary (neutral-50),
    // sinon le texte garde le noir par défaut du navigateur et devient illisible.
    const textareas = modal.locator('textarea');
    await expect(textareas).toHaveCount(2);
    for (const textarea of await textareas.all()) {
      await expect(textarea).toHaveCSS('background-color', 'rgb(23, 23, 23)');
      await expect(textarea).toHaveCSS('color', 'rgb(250, 250, 250)');
    }

    await modal.getByRole('button', { name: 'Annuler' }).click();
    await expect(modal).toBeHidden();
  });
});

test.describe('Locataires - modale de refus sur mobile', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile', 'Vérifie la mise en page mobile');
    await resetApp(page);
  });

  test('Les boutons du pied de modale restent visibles et au-dessus de la page', async ({
    page,
  }) => {
    // Ouvrir la fiche d'un candidat puis la modale de refus
    const { fullName } = await createTenant(page);
    await page.locator('.tenant-card', { hasText: fullName }).first().getByText(fullName).click();
    await page.waitForURL(/\/tenants\/\d+/, { timeout: 10_000 });
    const refuseButton = page.getByRole('button', { name: 'Refuser', exact: true });
    await refuseButton.click();
    const modal = withinModal(page, /Refuser la candidature/);
    await expect(modal).toBeVisible();

    // Amener les actions rapides (sticky) sous la modale ouverte
    await page.locator('.quick-actions').evaluate(el => el.scrollIntoView({ block: 'center' }));

    // Les boutons du pied de modale sont entièrement dans le viewport et non recouverts
    const footerButtons = modal.locator('[data-testid="modal-footer"] button');
    await expect(footerButtons).toHaveCount(2);
    for (const button of await footerButtons.all()) {
      await expect(button).toBeInViewport({ ratio: 1 });
      expect(await isTopmost(button)).toBe(true);
    }

    // Les actions rapides visibles passent sous la modale
    const quickActionsCoveredByModal = await page
      .locator('.quick-actions .action-button')
      .evaluateAll(cards =>
        cards
          .map(card => card.getBoundingClientRect())
          .filter(r => r.top + r.height / 2 > 0 && r.top + r.height / 2 < window.innerHeight)
          .map(r => {
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return !!hit?.closest('[data-testid="modal-overlay"]');
          })
      );
    expect(quickActionsCoveredByModal.length).toBeGreaterThan(0);
    expect(quickActionsCoveredByModal).not.toContain(false);

    // Annuler ferme la modale sans refuser la candidature
    await modal.getByRole('button', { name: 'Annuler' }).click();
    await expect(modal).toBeHidden();
    await expect(refuseButton).toBeVisible();
  });
});
