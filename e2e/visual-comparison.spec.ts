import { test, expect } from '@playwright/test';

test.describe('Visual Comparison - View Structure Consistency', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('compare all views structure with Properties view reference', async ({ page }) => {
    // Référence : Propriétés
    await page.click('a[href="/properties"]');
    await page.waitForSelector('.view-container.properties-view');

    const propertiesMetrics = await page.evaluate(() => {
      const container = document.querySelector('.view-container');
      const header = document.querySelector('.view-header');
      const statsGrid = document.querySelector('.stats-grid');
      const filters = document.querySelector('.filters');
      const contentGrid = document.querySelector('.properties-grid');

      return {
        containerWidth: container?.clientWidth,
        containerMaxWidth: getComputedStyle(container!).maxWidth,
        containerPadding: getComputedStyle(container!).padding,
        headerLayout: getComputedStyle(header!).display,
        statsGridColumns: getComputedStyle(statsGrid!).gridTemplateColumns,
        filtersMargin: getComputedStyle(filters!).marginBottom,
        contentGridColumns: getComputedStyle(contentGrid!).gridTemplateColumns,
        contentGridGap: getComputedStyle(contentGrid!).gap,
      };
    });

    console.log('\n📊 RÉFÉRENCE - Propriétés:');
    console.log(JSON.stringify(propertiesMetrics, null, 2));

    // Test 1: Locataires
    await page.click('a[href="/tenants"]');
    await page.waitForSelector('.view-container.tenants-view');

    const tenantsMetrics = await page.evaluate(() => {
      const container = document.querySelector('.view-container');
      const header = document.querySelector('.view-header');
      const statsGrid = document.querySelector('.stats-grid');
      const filters = document.querySelector('.filters');
      const contentGrid = document.querySelector('.tenants-grid');

      return {
        containerWidth: container?.clientWidth,
        containerMaxWidth: getComputedStyle(container!).maxWidth,
        containerPadding: getComputedStyle(container!).padding,
        headerLayout: getComputedStyle(header!).display,
        statsGridColumns: getComputedStyle(statsGrid!).gridTemplateColumns,
        filtersMargin: getComputedStyle(filters!).marginBottom,
        contentGridColumns: getComputedStyle(contentGrid!).gridTemplateColumns,
        contentGridGap: getComputedStyle(contentGrid!).gap,
      };
    });

    console.log('\n👥 Locataires:');
    console.log(JSON.stringify(tenantsMetrics, null, 2));
    expect(tenantsMetrics.containerMaxWidth).toBe(propertiesMetrics.containerMaxWidth);
    expect(tenantsMetrics.containerPadding).toBe(propertiesMetrics.containerPadding);
    expect(tenantsMetrics.statsGridColumns).toBe(propertiesMetrics.statsGridColumns);
    expect(tenantsMetrics.contentGridColumns).toBe(propertiesMetrics.contentGridColumns);

    // Test 2: Baux
    await page.click('a[href="/leases"]');
    await page.waitForSelector('.view-container.leases-view');

    const leasesMetrics = await page.evaluate(() => {
      const container = document.querySelector('.view-container');
      const header = document.querySelector('.view-header');
      const statsGrid = document.querySelector('.stats-grid');
      const filters = document.querySelector('.filters');
      const contentGrid = document.querySelector('.leases-grid');

      return {
        containerWidth: container?.clientWidth,
        containerMaxWidth: getComputedStyle(container!).maxWidth,
        containerPadding: getComputedStyle(container!).padding,
        headerLayout: getComputedStyle(header!).display,
        statsGridColumns: getComputedStyle(statsGrid!).gridTemplateColumns,
        filtersMargin: getComputedStyle(filters!).marginBottom,
        contentGridColumns: getComputedStyle(contentGrid!).gridTemplateColumns,
        contentGridGap: getComputedStyle(contentGrid!).gap,
      };
    });

    console.log('\n📄 Baux:');
    console.log(JSON.stringify(leasesMetrics, null, 2));
    expect(leasesMetrics.containerMaxWidth).toBe(propertiesMetrics.containerMaxWidth);
    expect(leasesMetrics.containerPadding).toBe(propertiesMetrics.containerPadding);
    expect(leasesMetrics.statsGridColumns).toBe(propertiesMetrics.statsGridColumns);
    expect(leasesMetrics.contentGridColumns).toBe(propertiesMetrics.contentGridColumns);

    // Test 3: Documents
    await page.click('a[href="/documents"]');
    await page.waitForSelector('.view-container.documents-view');

    const documentsMetrics = await page.evaluate(() => {
      const container = document.querySelector('.view-container');
      const header = document.querySelector('.view-header');
      const statsGrid = document.querySelector('.stats-grid');
      const filters = document.querySelector('.filters');
      const contentGrid = document.querySelector('.documents-grid');

      return {
        containerWidth: container?.clientWidth,
        containerMaxWidth: getComputedStyle(container!).maxWidth,
        containerPadding: getComputedStyle(container!).padding,
        headerLayout: getComputedStyle(header!).display,
        statsGridColumns: statsGrid ? getComputedStyle(statsGrid).gridTemplateColumns : 'N/A',
        filtersMargin: filters ? getComputedStyle(filters).marginBottom : 'N/A',
        contentGridColumns: getComputedStyle(contentGrid!).gridTemplateColumns,
        contentGridGap: getComputedStyle(contentGrid!).gap,
      };
    });

    console.log('\n📁 Documents:');
    console.log(JSON.stringify(documentsMetrics, null, 2));
    expect(documentsMetrics.containerMaxWidth).toBe(propertiesMetrics.containerMaxWidth);
    expect(documentsMetrics.containerPadding).toBe(propertiesMetrics.containerPadding);
    expect(documentsMetrics.contentGridColumns).toBe(propertiesMetrics.contentGridColumns);

    // Test 4: Loyers
    await page.click('a[href="/rents"]');
    await page.waitForSelector('.view-container.rents-view');

    const rentsMetrics = await page.evaluate(() => {
      const container = document.querySelector('.view-container');
      const header = document.querySelector('.view-header');
      const statsGrid = document.querySelector('.stats-grid');
      const filters = document.querySelector('.filters');
      const contentGrid = document.querySelector('.rents-grid');

      return {
        containerWidth: container?.clientWidth,
        containerMaxWidth: getComputedStyle(container!).maxWidth,
        containerPadding: getComputedStyle(container!).padding,
        headerLayout: getComputedStyle(header!).display,
        statsGridColumns: statsGrid ? getComputedStyle(statsGrid).gridTemplateColumns : 'N/A',
        filtersMargin: filters ? getComputedStyle(filters).marginBottom : 'N/A',
        contentGridColumns: contentGrid ? getComputedStyle(contentGrid).gridTemplateColumns : 'N/A',
        contentGridGap: contentGrid ? getComputedStyle(contentGrid).gap : 'N/A',
      };
    });

    console.log('\n💰 Loyers:');
    console.log(JSON.stringify(rentsMetrics, null, 2));
    expect(rentsMetrics.containerMaxWidth).toBe(propertiesMetrics.containerMaxWidth);
    expect(rentsMetrics.containerPadding).toBe(propertiesMetrics.containerPadding);

    // Résumé des différences
    console.log('\n\n═══════════════════════════════════════════');
    console.log('📋 RÉSUMÉ DES COMPARAISONS');
    console.log('═══════════════════════════════════════════\n');

    const views = [
      { name: 'Propriétés (Référence)', metrics: propertiesMetrics },
      { name: 'Locataires', metrics: tenantsMetrics },
      { name: 'Baux', metrics: leasesMetrics },
      { name: 'Documents', metrics: documentsMetrics },
      { name: 'Loyers', metrics: rentsMetrics },
    ];

    views.forEach(view => {
      console.log(`\n${view.name}:`);
      console.log(`  Max Width: ${view.metrics.containerMaxWidth}`);
      console.log(`  Padding: ${view.metrics.containerPadding}`);
      console.log(`  Stats Grid: ${view.metrics.statsGridColumns}`);
      console.log(`  Content Grid: ${view.metrics.contentGridColumns}`);
      console.log(`  Grid Gap: ${view.metrics.contentGridGap}`);
    });
  });

  test('capture screenshots for visual comparison', async ({ page }) => {
    const views = [
      { url: '/properties', name: 'properties', selector: '.properties-view' },
      { url: '/tenants', name: 'tenants', selector: '.tenants-view' },
      { url: '/leases', name: 'leases', selector: '.leases-view' },
      { url: '/documents', name: 'documents', selector: '.documents-view' },
      { url: '/rents', name: 'rents', selector: '.rents-view' },
    ];

    for (const view of views) {
      await page.goto(view.url);
      await page.waitForSelector(`.view-container${view.selector}`);
      await page.screenshot({
        path: `test-results/screenshots/${view.name}-view.png`,
        fullPage: true,
      });
    }
  });
});
