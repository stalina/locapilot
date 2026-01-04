import { Locator, Page } from '@playwright/test';

export async function safeClick(
  page: Page,
  locator: Locator,
  options: { timeout?: number; retries?: number } = {}
) {
  const timeout = options.timeout ?? 5000;
  const retries = options.retries ?? 3;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await locator.scrollIntoViewIfNeeded().catch(() => {});
      await locator.waitFor({ state: 'visible', timeout });

      // If element seems outside viewport, use evaluate click
      const isOutside = await locator
        .evaluate(el => {
          const r = (el as HTMLElement).getBoundingClientRect();
          return (
            r.bottom < 0 || r.top > (window.innerHeight || document.documentElement.clientHeight)
          );
        })
        .catch(() => false);

      if (isOutside) {
        await locator.evaluate(el => (el as HTMLElement).click());
        return;
      }

      await locator.click({ timeout });
      return;
    } catch (err) {
      lastError = err;
      if (attempt === retries) throw err;
      await page.waitForTimeout(100 * attempt);
    }
  }

  throw lastError;
}

export async function safeFill(
  page: Page,
  locator: Locator,
  value: string,
  options: { timeout?: number } = {}
) {
  const timeout = options.timeout ?? 5000;
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.waitFor({ state: 'visible', timeout });
  // If element is a select, use selectOption
  const tag = await locator
    .evaluate(el => (el as HTMLElement).tagName.toLowerCase())
    .catch(() => null);
  if (tag === 'select') {
    await locator.selectOption({ label: value }).catch(async () => {
      await locator.selectOption(value);
    });
    return;
  }

  try {
    await locator.fill(value, { timeout });
    return;
  } catch {
    // fallback: set value and dispatch events
    await locator.evaluate((el, v) => {
      try {
        (el as HTMLInputElement).value = v as any;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch {
        // ignore
      }
    }, value);
  }
}
