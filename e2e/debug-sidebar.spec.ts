import { test } from '@playwright/test';

test('debug sidebar width', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  // Clear cache and reload
  await page.goto('/', { waitUntil: 'networkidle' });

  // Properties
  await page.click('a[href="/properties"]');
  await page.waitForSelector('.view-container.properties-view');

  const propertiesSidebar = await page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar');
    const appLayout = document.querySelector('.app-layout');
    const mainWrapper = document.querySelector('.main-wrapper');
    const appMain = document.querySelector('.app-main');

    return {
      sidebar: {
        clientWidth: (sidebar as HTMLElement)?.clientWidth,
        computedWidth: getComputedStyle(sidebar!).width,
      },
      appLayout: {
        clientWidth: (appLayout as HTMLElement)?.clientWidth,
        display: getComputedStyle(appLayout!).display,
      },
      mainWrapper: {
        clientWidth: (mainWrapper as HTMLElement)?.clientWidth,
        flex: getComputedStyle(mainWrapper!).flex,
      },
      appMain: {
        clientWidth: (appMain as HTMLElement)?.clientWidth,
      },
    };
  });

  console.log('\n🏠 PROPERTIES:');
  console.log(
    `  Sidebar: ${propertiesSidebar.sidebar.clientWidth}px (${propertiesSidebar.sidebar.computedWidth})`
  );
  console.log(
    `  App Layout: ${propertiesSidebar.appLayout.clientWidth}px (${propertiesSidebar.appLayout.display})`
  );
  console.log(
    `  Main Wrapper: ${propertiesSidebar.mainWrapper.clientWidth}px (flex: ${propertiesSidebar.mainWrapper.flex})`
  );
  console.log(`  App Main: ${propertiesSidebar.appMain.clientWidth}px`);

  // Tenants
  await page.click('a[href="/tenants"]');
  await page.waitForSelector('.view-container.tenants-view');

  const tenantsSidebar = await page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar');
    const appLayout = document.querySelector('.app-layout');
    const mainWrapper = document.querySelector('.main-wrapper');
    const appMain = document.querySelector('.app-main');

    return {
      sidebar: {
        clientWidth: (sidebar as HTMLElement)?.clientWidth,
        computedWidth: getComputedStyle(sidebar!).width,
      },
      appLayout: {
        clientWidth: (appLayout as HTMLElement)?.clientWidth,
        display: getComputedStyle(appLayout!).display,
      },
      mainWrapper: {
        clientWidth: (mainWrapper as HTMLElement)?.clientWidth,
        flex: getComputedStyle(mainWrapper!).flex,
      },
      appMain: {
        clientWidth: (appMain as HTMLElement)?.clientWidth,
      },
    };
  });

  console.log('\n👥 TENANTS:');
  console.log(
    `  Sidebar: ${tenantsSidebar.sidebar.clientWidth}px (${tenantsSidebar.sidebar.computedWidth})`
  );
  console.log(
    `  App Layout: ${tenantsSidebar.appLayout.clientWidth}px (${tenantsSidebar.appLayout.display})`
  );
  console.log(
    `  Main Wrapper: ${tenantsSidebar.mainWrapper.clientWidth}px (flex: ${tenantsSidebar.mainWrapper.flex})`
  );
  console.log(`  App Main: ${tenantsSidebar.appMain.clientWidth}px`);

  console.log('\n⚖️  COMPARISON:');
  console.log(
    `  Sidebar diff: ${tenantsSidebar.sidebar.clientWidth! - propertiesSidebar.sidebar.clientWidth!}px`
  );
  console.log(
    `  Layout diff: ${tenantsSidebar.appLayout.clientWidth! - propertiesSidebar.appLayout.clientWidth!}px`
  );
  console.log(
    `  Main diff: ${tenantsSidebar.appMain.clientWidth! - propertiesSidebar.appMain.clientWidth!}px`
  );
});
