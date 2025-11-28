import { test } from '@playwright/test';

test('debug container widths', async ({ page }) => {
  // Set consistent viewport
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.goto('/');

  // Properties
  await page.click('a[href="/properties"]');
  await page.waitForSelector('.view-container.properties-view');

  const propertiesDebug = await page.evaluate(() => {
    const container = document.querySelector('.view-container.properties-view');
    const styles = getComputedStyle(container!);
    const parent = container?.parentElement;
    const parentStyles = parent ? getComputedStyle(parent) : null;

    return {
      view: 'Properties',
      containerClass: container?.className,
      clientWidth: container?.clientWidth,
      offsetWidth: container?.offsetWidth,
      scrollWidth: container?.scrollWidth,
      maxWidth: styles.maxWidth,
      width: styles.width,
      margin: styles.margin,
      padding: styles.padding,
      boxSizing: styles.boxSizing,
      parentWidth: parent?.clientWidth,
      parentMaxWidth: parentStyles?.maxWidth,
      parentPadding: parentStyles?.padding,
    };
  });

  console.log('\n🏠 PROPERTIES VIEW:');
  console.log(JSON.stringify(propertiesDebug, null, 2));

  // Tenants
  await page.click('a[href="/tenants"]');
  await page.waitForSelector('.view-container.tenants-view');

  const tenantsDebug = await page.evaluate(() => {
    const container = document.querySelector('.view-container.tenants-view');
    const styles = getComputedStyle(container!);
    const parent = container?.parentElement;
    const parentStyles = parent ? getComputedStyle(parent) : null;

    return {
      view: 'Tenants',
      containerClass: container?.className,
      clientWidth: container?.clientWidth,
      offsetWidth: container?.offsetWidth,
      scrollWidth: container?.scrollWidth,
      maxWidth: styles.maxWidth,
      width: styles.width,
      margin: styles.margin,
      padding: styles.padding,
      boxSizing: styles.boxSizing,
      parentWidth: parent?.clientWidth,
      parentMaxWidth: parentStyles?.maxWidth,
      parentPadding: parentStyles?.padding,
    };
  });

  console.log('\n👥 TENANTS VIEW:');
  console.log(JSON.stringify(tenantsDebug, null, 2));

  // Comparison
  console.log('\n⚖️  COMPARISON:');
  console.log(`Properties container: ${propertiesDebug.clientWidth}px`);
  console.log(`Tenants container: ${tenantsDebug.clientWidth}px`);
  console.log(`Difference: ${propertiesDebug.clientWidth! - tenantsDebug.clientWidth!}px`);
});
