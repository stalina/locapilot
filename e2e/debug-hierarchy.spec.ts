import { test } from '@playwright/test';

test('debug DOM hierarchy', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5175');

  // Properties
  await page.click('a[href="/properties"]');
  await page.waitForSelector('.view-container.properties-view');
  
  const propertiesHierarchy = await page.evaluate(() => {
    const container = document.querySelector('.view-container.properties-view');
    const hierarchy = [];
    let el: Element | null = container;
    
    while (el && el !== document.body) {
      const styles = getComputedStyle(el);
      hierarchy.push({
        tag: el.tagName,
        class: el.className,
        clientWidth: (el as HTMLElement).clientWidth,
        maxWidth: styles.maxWidth,
        width: styles.width,
        display: styles.display,
        flex: styles.flex,
        gridTemplateColumns: styles.gridTemplateColumns,
      });
      el = el.parentElement;
    }
    
    return hierarchy;
  });
  
  console.log('\n🏠 PROPERTIES HIERARCHY:');
  propertiesHierarchy.forEach((item, i) => {
    console.log(`  ${i}. ${item.tag}.${item.class}`);
    console.log(`     clientWidth: ${item.clientWidth}px, maxWidth: ${item.maxWidth}, width: ${item.width}`);
    console.log(`     display: ${item.display}, flex: ${item.flex}, grid: ${item.gridTemplateColumns}`);
  });

  // Tenants
  await page.click('a[href="/tenants"]');
  await page.waitForSelector('.view-container.tenants-view');
  
  const tenantsHierarchy = await page.evaluate(() => {
    const container = document.querySelector('.view-container.tenants-view');
    const hierarchy = [];
    let el: Element | null = container;
    
    while (el && el !== document.body) {
      const styles = getComputedStyle(el);
      hierarchy.push({
        tag: el.tagName,
        class: el.className,
        clientWidth: (el as HTMLElement).clientWidth,
        maxWidth: styles.maxWidth,
        width: styles.width,
        display: styles.display,
        flex: styles.flex,
        gridTemplateColumns: styles.gridTemplateColumns,
      });
      el = el.parentElement;
    }
    
    return hierarchy;
  });
  
  console.log('\n\n👥 TENANTS HIERARCHY:');
  tenantsHierarchy.forEach((item, i) => {
    console.log(`  ${i}. ${item.tag}.${item.class}`);
    console.log(`     clientWidth: ${item.clientWidth}px, maxWidth: ${item.maxWidth}, width: ${item.width}`);
    console.log(`     display: ${item.display}, flex: ${item.flex}, grid: ${item.gridTemplateColumns}`);
  });
});
