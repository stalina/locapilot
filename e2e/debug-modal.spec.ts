import { test } from '@playwright/test';

test('debug modal opening', async ({ page }) => {
  // Capturer les logs de console
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type()}]:`, msg.text());
  });
  
  page.on('pageerror', err => {
    console.error('[PAGE ERROR]:', err.message);
  });
  
  await page.goto('/properties');
  await page.waitForLoadState('networkidle');
  
  console.log('\n=== Clicking new property button ===');
  const button = page.getByTestId('new-property-button');
  
  // Vérifier que le bouton existe
  const buttonVisible = await button.isVisible();
  console.log('Button visible:', buttonVisible);
  
  await button.click();
  
  console.log('=== Waiting 2 seconds ===');
  await page.waitForTimeout(2000);
  
  // Vérifier si la modal est visible
  const modal = page.getByTestId('modal');
  const modalVisible = await modal.isVisible().catch(() => false);
  console.log('Modal visible:', modalVisible);
  
  // Prendre une capture
  await page.screenshot({ path: 'debug-modal.png', fullPage: true });
  console.log('Screenshot saved to debug-modal.png');
});
