import { Locator, Page } from '@playwright/test';

export async function safeClick(page: Page, locator: Locator, options: { timeout?: number } = {}) {
  const timeout = options.timeout ?? 5000;
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.waitFor({ state: 'visible', timeout }).catch(() => {});
  try {
    await locator.click({ timeout }).catch(() => {});
  } catch {
    // fallback to evaluate click
    await locator.evaluate(el => (el as HTMLElement).click());
  }
}
