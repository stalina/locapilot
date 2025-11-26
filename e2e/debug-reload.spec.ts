import { test } from '@playwright/test';

test('compare same route reload', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  // Load Tenants first
  await page.goto('http://localhost:5175/tenants', { waitUntil: 'networkidle' });
  await page.waitForSelector('.view-container.tenants-view');
  
  const tenants1 = await page.evaluate(() => {
    const container = document.querySelector('.view-container');
    const appLayout = document.querySelector('.app-layout');
    return {
      container: (container as HTMLElement)?.clientWidth,
      layout: (appLayout as HTMLElement)?.clientWidth,
      bodyWidth: document.body.clientWidth,
      htmlWidth: document.documentElement.clientWidth,
    };
  });
  
  console.log('\n👥 TENANTS (first load):');
  console.log(`  Container: ${tenants1.container}px`);
  console.log(`  Layout: ${tenants1.layout}px`);
  console.log(`  Body: ${tenants1.bodyWidth}px`);
  console.log(`  HTML: ${tenants1.htmlWidth}px`);
  
  // Reload tenants
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.view-container.tenants-view');
  
  const tenants2 = await page.evaluate(() => {
    const container = document.querySelector('.view-container');
    const appLayout = document.querySelector('.app-layout');
    return {
      container: (container as HTMLElement)?.clientWidth,
      layout: (appLayout as HTMLElement)?.clientWidth,
      bodyWidth: document.body.clientWidth,
      htmlWidth: document.documentElement.clientWidth,
    };
  });
  
  console.log('\n👥 TENANTS (reload):');
  console.log(`  Container: ${tenants2.container}px`);
  console.log(`  Layout: ${tenants2.layout}px`);
  console.log(`  Body: ${tenants2.bodyWidth}px`);
  console.log(`  HTML: ${tenants2.htmlWidth}px`);
  
  // Load Properties
  await page.goto('http://localhost:5175/properties', { waitUntil: 'networkidle' });
  await page.waitForSelector('.view-container.properties-view');
  
  const properties = await page.evaluate(() => {
    const container = document.querySelector('.view-container');
    const appLayout = document.querySelector('.app-layout');
    return {
      container: (container as HTMLElement)?.clientWidth,
      layout: (appLayout as HTMLElement)?.clientWidth,
      bodyWidth: document.body.clientWidth,
      htmlWidth: document.documentElement.clientWidth,
    };
  });
  
  console.log('\n🏠 PROPERTIES:');
  console.log(`  Container: ${properties.container}px`);
  console.log(`  Layout: ${properties.layout}px`);
  console.log(`  Body: ${properties.bodyWidth}px`);
  console.log(`  HTML: ${properties.htmlWidth}px`);
});
