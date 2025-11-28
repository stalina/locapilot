import { test, expect } from '@playwright/test';

test.describe('Visual Comparison - Final Check', () => {
  test('all main views have consistent structure', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    const views = [
      { name: 'Propriétés', url: '/properties', selector: '.properties-view' },
      { name: 'Locataires', url: '/tenants', selector: '.tenants-view' },
      { name: 'Baux', url: '/leases', selector: '.leases-view' },
    ];

    const results = [];

    for (const view of views) {
      await page.click(`a[href="${view.url}"]`);
      await page.waitForSelector(`.view-container${view.selector}`);

      const metrics = await page.evaluate(() => {
        const container = document.querySelector('.view-container');
        const statsGrid = document.querySelector('.stats-grid');
        const filters = document.querySelector('.filters');
        const contentGrid = container?.querySelector('div[class*="-grid"]:not(.stats-grid)');

        return {
          containerWidth: (container as HTMLElement)?.clientWidth,
          containerMaxWidth: getComputedStyle(container!).maxWidth,
          containerPadding: getComputedStyle(container!).padding,
          statsGridColumns: statsGrid ? getComputedStyle(statsGrid).gridTemplateColumns : 'N/A',
          filtersMargin: filters ? getComputedStyle(filters).marginBottom : 'N/A',
          contentGridColumns: contentGrid
            ? getComputedStyle(contentGrid).gridTemplateColumns
            : 'N/A',
          contentGridGap: contentGrid ? getComputedStyle(contentGrid).gap : 'N/A',
        };
      });

      results.push({ name: view.name, ...metrics });
      console.log(`\n${view.name}:`);
      console.log(`  Container: ${metrics.containerWidth}px (max: ${metrics.containerMaxWidth})`);
      console.log(`  Padding: ${metrics.containerPadding}`);
      console.log(`  Stats Grid: ${metrics.statsGridColumns}`);
      console.log(`  Content Grid: ${metrics.contentGridColumns}`);
      console.log(`  Gap: ${metrics.contentGridGap}`);
    }

    // Verify all views have same metrics
    const reference = results[0];
    console.log('\n\n═══════════════════════════════════════════');
    console.log('✅ VÉRIFICATION DE COHÉRENCE');
    console.log('═══════════════════════════════════════════\n');

    for (let i = 1; i < results.length; i++) {
      const current = results[i];
      console.log(`\n${current.name} vs ${reference.name}:`);

      expect(current.containerWidth, `${current.name} container width`).toBe(
        reference.containerWidth
      );
      expect(current.containerMaxWidth, `${current.name} max-width`).toBe(
        reference.containerMaxWidth
      );
      expect(current.containerPadding, `${current.name} padding`).toBe(reference.containerPadding);
      expect(current.statsGridColumns, `${current.name} stats grid`).toBe(
        reference.statsGridColumns
      );
      expect(current.contentGridColumns, `${current.name} content grid`).toBe(
        reference.contentGridColumns
      );
      expect(current.contentGridGap, `${current.name} gap`).toBe(reference.contentGridGap);

      console.log(`  ✅ Toutes les métriques sont identiques`);
    }

    console.log('\n\n🎉 SUCCÈS : Toutes les vues sont cohérentes !');
  });
});
