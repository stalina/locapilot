import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Resolves the colours a component paints in the light and dark themes from its
// SFC <style> block and the design tokens in variables.css. Read from disk
// because Vitest does not process CSS, so jsdom never applies these styles.

export type Theme = 'light' | 'dark';

interface CssRule {
  selectors: string[];
  declarations: Record<string, string>;
  media: string | null;
}

const DARK_MEDIA = '(prefers-color-scheme: dark)';
const NAMED_COLORS: Record<string, string> = { white: '#ffffff', black: '#000000' };

function readSource(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function parseDeclarations(body: string): Record<string, string> {
  return Object.fromEntries(
    body
      .split(';')
      .map(declaration => declaration.trim())
      .filter(Boolean)
      .map(declaration => {
        const colon = declaration.indexOf(':');
        return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
      })
  );
}

// Flattens `@media` blocks into their rules (tagged with the media query) and
// skips other at-rules such as `@keyframes`.
function parseRules(css: string, media: string | null = null): CssRule[] {
  const rules: CssRule[] = [];
  let cursor = 0;
  while (cursor < css.length) {
    const open = css.indexOf('{', cursor);
    if (open === -1) break;
    let close = open + 1;
    for (let depth = 1; depth > 0 && close < css.length; close++) {
      if (css[close] === '{') depth++;
      else if (css[close] === '}') depth--;
    }
    const prelude = css.slice(cursor, open).trim();
    const body = css.slice(open + 1, close - 1);
    if (prelude.startsWith('@media')) {
      rules.push(...parseRules(body, prelude.slice('@media'.length).trim()));
    } else if (!prelude.startsWith('@')) {
      rules.push({
        selectors: prelude.split(',').map(selector => selector.trim()),
        declarations: parseDeclarations(body),
        media,
      });
    }
    cursor = close;
  }
  return rules;
}

function parseStylesheet(css: string): CssRule[] {
  return parseRules(css.replace(/\/\*[\s\S]*?\*\//g, ''));
}

function appliesIn(rule: CssRule, theme: Theme): boolean {
  return rule.media === null || (theme === 'dark' && rule.media === DARK_MEDIA);
}

function loadTokens(theme: Theme): Record<string, string> {
  return Object.assign(
    {},
    ...parseStylesheet(readSource('src/assets/styles/variables.css'))
      .filter(rule => rule.selectors.includes(':root') && appliesIn(rule, theme))
      .map(rule => rule.declarations)
  );
}

function resolveValue(value: string, tokens: Record<string, string>): string {
  const reference = value.match(/^var\(\s*(?<token>--[\w-]+)\s*(?:,\s*(?<fallback>.+))?\)$/);
  const token = reference?.groups?.token;
  if (token === undefined) return NAMED_COLORS[value] ?? value;
  const next = tokens[token] ?? reference?.groups?.fallback;
  if (next === undefined) throw new Error(`${token} is not declared in variables.css`);
  return resolveValue(next.trim(), tokens);
}

/** Raw content of a single-file component's `<style>` block. */
export function readComponentStyles(path: string): string {
  return readSource(path).match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? '';
}

/**
 * Returns a resolver for the value a component declares for `property` once
 * `selectors` cascade in order (list the base class before its `:hover` rule),
 * with design tokens resolved for the given theme. Only theme media queries are
 * honoured, so the result matches a desktop viewport.
 */
export function themeColors(path: string) {
  const rules = parseStylesheet(readComponentStyles(path));
  const tokens = { light: loadTokens('light'), dark: loadTokens('dark') };

  return function resolve(property: string, selectors: string[], theme: Theme): string {
    const declared = selectors
      .flatMap(selector =>
        rules.filter(rule => rule.selectors.includes(selector) && appliesIn(rule, theme))
      )
      .map(rule => rule.declarations[property])
      .filter((value): value is string => value !== undefined)
      .pop();
    if (declared === undefined) {
      throw new Error(`${path} declares no ${property} for ${selectors.join(' + ')}`);
    }
    return resolveValue(declared, tokens[theme]);
  };
}

function relativeLuminance(hex: string): number {
  const digits = hex.replace('#', '');
  const full = digits.length === 3 ? [...digits].map(digit => digit + digit).join('') : digits;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`${hex} is not a hex colour`);
  const linear = (offset: number) => {
    const channel = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(0) + 0.7152 * linear(2) + 0.0722 * linear(4);
}

/** WCAG 2 contrast ratio between two hex colours (1 to 21). */
export function contrastRatio(foreground: string, background: string): number {
  const luminances = [relativeLuminance(foreground), relativeLuminance(background)];
  return (Math.max(...luminances) + 0.05) / (Math.min(...luminances) + 0.05);
}
