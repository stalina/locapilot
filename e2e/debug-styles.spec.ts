import { test } from '@playwright/test';

test('inspect computed styles', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  // Tenants
  await page.goto('http://localhost:5175/tenants', { waitUntil: 'networkidle' });
  await page.waitForSelector('.view-container.tenants-view');
  
  const tenantsStyles = await page.evaluate(() => {
    const app = document.querySelector('#app');
    const layout = document.querySelector('.app-layout');
    const wrapper = document.querySelector('.main-wrapper');
    const main = document.querySelector('.app-main');
    const container = document.querySelector('.view-container');
    
    const getFullStyles = (el: Element | null) => {
      if (!el) return null;
      const styles = getComputedStyle(el);
      return {
        width: styles.width,
        minWidth: styles.minWidth,
        maxWidth: styles.maxWidth,
        margin: styles.margin,
        padding: styles.padding,
        boxSizing: styles.boxSizing,
        display: styles.display,
        flex: styles.flex,
        flexGrow: styles.flexGrow,
        flexShrink: styles.flexShrink,
        flexBasis: styles.flexBasis,
      };
    };
    
    return {
      app: getFullStyles(app),
      layout: getFullStyles(layout),
      wrapper: getFullStyles(wrapper),
      main: getFullStyles(main),
      container: getFullStyles(container),
    };
  });
  
  console.log('\n👥 TENANTS COMPUTED STYLES:');
  console.log('  #app:', JSON.stringify(tenantsStyles.app, null, 4));
  console.log('  .app-layout:', JSON.stringify(tenantsStyles.layout, null, 4));
  console.log('  .main-wrapper:', JSON.stringify(tenantsStyles.wrapper, null, 4));
  console.log('  .app-main:', JSON.stringify(tenantsStyles.main, null, 4));
  console.log('  .view-container:', JSON.stringify(tenantsStyles.container, null, 4));
  
  // Properties
  await page.goto('http://localhost:5175/properties', { waitUntil: 'networkidle' });
  await page.waitForSelector('.view-container.properties-view');
  
  const propertiesStyles = await page.evaluate(() => {
    const app = document.querySelector('#app');
    const layout = document.querySelector('.app-layout');
    const wrapper = document.querySelector('.main-wrapper');
    const main = document.querySelector('.app-main');
    const container = document.querySelector('.view-container');
    
    const getFullStyles = (el: Element | null) => {
      if (!el) return null;
      const styles = getComputedStyle(el);
      return {
        width: styles.width,
        minWidth: styles.minWidth,
        maxWidth: styles.maxWidth,
        margin: styles.margin,
        padding: styles.padding,
        boxSizing: styles.boxSizing,
        display: styles.display,
        flex: styles.flex,
        flexGrow: styles.flexGrow,
        flexShrink: styles.flexShrink,
        flexBasis: styles.flexBasis,
      };
    };
    
    return {
      app: getFullStyles(app),
      layout: getFullStyles(layout),
      wrapper: getFullStyles(wrapper),
      main: getFullStyles(main),
      container: getFullStyles(container),
    };
  });
  
  console.log('\n\n🏠 PROPERTIES COMPUTED STYLES:');
  console.log('  #app:', JSON.stringify(propertiesStyles.app, null, 4));
  console.log('  .app-layout:', JSON.stringify(propertiesStyles.layout, null, 4));
  console.log('  .main-wrapper:', JSON.stringify(propertiesStyles.wrapper, null, 4));
  console.log('  .app-main:', JSON.stringify(propertiesStyles.main, null, 4));
  console.log('  .view-container:', JSON.stringify(propertiesStyles.container, null, 4));
});
