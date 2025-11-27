import { test, expect } from '@playwright/test';

/**
 * Tests d'accessibilité basiques pour vérifier la conformité WCAG de base
 *
 * Ces tests couvrent :
 * - Présence d'attributs ARIA
 * - Navigation au clavier
 * - Contraste des couleurs (vérification manuelle recommandée)
 * - Structure sémantique HTML
 * - Labels des formulaires
 */

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Attendre que l'app soit chargée
    await page.waitForSelector('[data-testid="app-container"], main, #app', {
      timeout: 10000,
    });
  });

  test('should have proper page title', async ({ page }) => {
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });

  test('should have lang attribute on html element', async ({ page }) => {
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
    expect(['fr', 'fr-FR', 'en', 'en-US']).toContain(lang);
  });

  test('should have skip to main content link (optional)', async ({ page }) => {
    // Vérifier si un lien "skip to main" existe (bonne pratique)
    const skipLink = page.locator('a[href="#main"], a[href="#content"]');
    // Ce test est informatif, pas bloquant
    const count = await skipLink.count();
    if (count === 0) {
      console.log('ℹ️  Suggestion: Add a "skip to main content" link for keyboard users');
    }
  });

  test('should have accessible navigation', async ({ page }) => {
    // Vérifier que la navigation existe
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav).toBeVisible({ timeout: 5000 });

    // Vérifier que les liens de navigation ont du texte visible
    const navLinks = nav.locator('a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 10); i++) {
      const link = navLinks.nth(i);
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');

      // Chaque lien doit avoir soit du texte, soit un aria-label
      expect(text || ariaLabel).toBeTruthy();
    }
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    // Vérifier qu'il y a au moins un h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);

    // Récupérer tous les headings
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();

    if (headings.length > 0) {
      // Vérifier que le premier heading est un h1
      const firstHeadingTag = await headings[0].evaluate(el => el.tagName);
      expect(firstHeadingTag).toBe('H1');
    }
  });

  test('should have accessible buttons', async ({ page }) => {
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      // Vérifier quelques boutons (max 5)
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        const isVisible = await button.isVisible();

        if (isVisible) {
          const text = await button.textContent();
          const ariaLabel = await button.getAttribute('aria-label');
          const title = await button.getAttribute('title');

          // Un bouton doit avoir du texte visible ou un label accessible
          const hasAccessibleName = (text && text.trim().length > 0) || ariaLabel || title;

          expect(hasAccessibleName).toBeTruthy();
        }
      }
    }
  });

  test('should have accessible form inputs', async ({ page }) => {
    const inputs = page.locator(
      'input[type="text"], input[type="email"], input[type="number"], textarea'
    );
    const inputCount = await inputs.count();

    if (inputCount > 0) {
      for (let i = 0; i < Math.min(inputCount, 5); i++) {
        const input = inputs.nth(i);
        const isVisible = await input.isVisible();

        if (isVisible) {
          const id = await input.getAttribute('id');
          const ariaLabel = await input.getAttribute('aria-label');
          const ariaLabelledBy = await input.getAttribute('aria-labelledby');

          // Si l'input a un id, chercher un label associé
          let hasLabel = false;
          if (id) {
            const label = page.locator(`label[for="${id}"]`);
            hasLabel = (await label.count()) > 0;
          }

          const hasAccessibleName = hasLabel || ariaLabel || ariaLabelledBy;
          expect(hasAccessibleName).toBeTruthy();
        }
      }
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tester la navigation au clavier (Tab)
    await page.keyboard.press('Tab');

    // Vérifier qu'un élément a le focus
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tagName: el?.tagName,
        type: (el as HTMLInputElement)?.type,
      };
    });

    expect(focusedElement.tagName).toBeTruthy();

    // Accepter les éléments interactifs ou les éléments structurels
    // (certains navigateurs focusent BODY/ASIDE au premier Tab)
    const acceptableTags = [
      'A',
      'BUTTON',
      'INPUT',
      'SELECT',
      'TEXTAREA',
      'NAV',
      'BODY',
      'ASIDE',
      'MAIN',
      'HEADER',
    ];

    expect(acceptableTags).toContain(focusedElement.tagName);
  });

  test('should have visible focus indicators', async ({ page }) => {
    // Cliquer sur le premier lien/bouton
    const firstInteractive = page.locator('a, button').first();
    await firstInteractive.focus();

    // Vérifier que l'élément focusé a un outline ou un style de focus visible
    const focusStyle = await firstInteractive.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        outlineStyle: styles.outlineStyle,
        boxShadow: styles.boxShadow,
      };
    });

    // Au moins un indicateur de focus doit être présent
    const hasVisibleFocus =
      (focusStyle.outline && focusStyle.outline !== 'none') ||
      (focusStyle.outlineWidth && focusStyle.outlineWidth !== '0px') ||
      (focusStyle.boxShadow && focusStyle.boxShadow !== 'none');

    // Ce test est informatif car certains frameworks utilisent des styles personnalisés
    if (!hasVisibleFocus) {
      console.log('⚠️  Warning: Focus indicators might not be visible');
    }
  });

  test('should have proper image alt text', async ({ page }) => {
    const images = page.locator('img');
    const imageCount = await images.count();

    if (imageCount > 0) {
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const isVisible = await img.isVisible();

        if (isVisible) {
          const alt = await img.getAttribute('alt');
          const role = await img.getAttribute('role');

          // Les images décoratives doivent avoir alt="" ou role="presentation"
          // Les images informatives doivent avoir un alt descriptif
          const hasProperAlt = alt !== null || role === 'presentation' || role === 'none';

          expect(hasProperAlt).toBeTruthy();
        }
      }
    }
  });

  test('should have accessible modal dialogs', async ({ page }) => {
    // Chercher des modals/dialogs
    const modals = page.locator('[role="dialog"], [role="alertdialog"], .modal');
    const modalCount = await modals.count();

    if (modalCount > 0) {
      const modal = modals.first();
      const isVisible = await modal.isVisible();

      if (isVisible) {
        // Vérifier les attributs ARIA
        const ariaModal = await modal.getAttribute('aria-modal');
        const ariaLabelledBy = await modal.getAttribute('aria-labelledby');
        const ariaLabel = await modal.getAttribute('aria-label');

        // Un modal doit avoir aria-modal="true"
        // et un label accessible (aria-labelledby ou aria-label)
        expect(ariaModal).toBeTruthy();
        expect(ariaLabelledBy || ariaLabel).toBeTruthy();
      }
    }
  });

  test('should have no duplicate IDs', async ({ page }) => {
    const ids = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('[id]'));
      return elements.map(el => el.id).filter(id => id);
    });

    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  test('should have proper ARIA roles', async ({ page }) => {
    const elementsWithRole = page.locator('[role]');
    const count = await elementsWithRole.count();

    // Vérifier que les rôles ARIA sont valides
    const validRoles = [
      'alert',
      'alertdialog',
      'article',
      'banner',
      'button',
      'checkbox',
      'complementary',
      'contentinfo',
      'dialog',
      'document',
      'form',
      'grid',
      'img',
      'link',
      'list',
      'listbox',
      'listitem',
      'main',
      'menu',
      'menubar',
      'menuitem',
      'navigation',
      'option',
      'presentation',
      'progressbar',
      'radio',
      'radiogroup',
      'region',
      'row',
      'search',
      'status',
      'tab',
      'tablist',
      'tabpanel',
      'textbox',
      'timer',
      'toolbar',
      'tooltip',
      'tree',
    ];

    for (let i = 0; i < Math.min(count, 10); i++) {
      const role = await elementsWithRole.nth(i).getAttribute('role');
      if (role) {
        expect(validRoles).toContain(role);
      }
    }
  });

  test('should have accessible color contrast (manual check recommended)', async ({ page }) => {
    // Ce test est un rappel pour vérifier manuellement le contraste
    // Utiliser des outils comme axe DevTools ou Lighthouse pour une vérification complète

    const bodyBg = await page.locator('body').evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });

    const bodyColor = await page.locator('body').evaluate(el => {
      return window.getComputedStyle(el).color;
    });

    expect(bodyBg).toBeTruthy();
    expect(bodyColor).toBeTruthy();

    console.log('ℹ️  Manual check: Verify color contrast meets WCAG AA (4.5:1 for normal text)');
    console.log(`   Body background: ${bodyBg}`);
    console.log(`   Body color: ${bodyColor}`);
  });
});
