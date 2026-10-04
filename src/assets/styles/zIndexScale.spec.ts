import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import appLayoutSource from '@/core/layouts/AppLayout.vue?raw';
import modalSource from '@/shared/components/Modal.vue?raw';
import rentPaymentModalSource from '@/features/rents/components/RentPaymentModal.vue?raw';
import rentFormModalSource from '@/features/rents/components/RentFormModal.vue?raw';

/**
 * jsdom does not compute stacking, so the layering contract between page content,
 * app chrome and modals is checked on the stylesheet sources: every audited layer
 * must use the `--z-*` scale from variables.css, in the right order.
 */

// Vitest stubs `.css` imports (even `?raw`), so stylesheets are read from disk.
const readStylesheet = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const variablesCss = readStylesheet('./variables.css');
const viewsCss = readStylesheet('./views.css');

function parseScale(css: string): Record<string, number> {
  const scale: Record<string, number> = {};
  for (const [, name, value] of css.matchAll(/--z-([\w-]+):\s*(\d+)\s*;/g)) {
    if (name && value) scale[name] = Number(value);
  }
  return scale;
}

const scale = parseScale(variablesCss);

/** Raw `z-index` value of the last rule for `selector` (exact match) that declares one. */
function zIndexDeclaration(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ruleRe = new RegExp(`(?:^|[\\s},])${escaped}\\s*\\{([^}]*)\\}`, 'g');
  const values = [...source.matchAll(ruleRe)]
    .map(([, body]) => body?.match(/z-index:\s*([^;]+);/)?.[1]?.trim())
    .filter((value): value is string => value !== undefined);
  const value = values.at(-1);
  if (value === undefined) throw new Error(`No z-index declared for ${selector}`);
  return value;
}

/** Resolves `var(--z-x[, fallback])` and `calc(var(--z-x) ± n)` against the scale. */
function resolveZIndex(value: string): number {
  const substituted = value.replace(/var\(--z-([\w-]+)(?:,\s*\d+)?\)/g, (_, name: string) => {
    const token = scale[name];
    if (token === undefined) throw new Error(`Unknown z-index token --z-${name}`);
    return String(token);
  });
  const calc = substituted.match(/^calc\((\d+)\s*([+-])\s*(\d+)\)$/);
  if (calc) {
    const [, base, operator, offset] = calc;
    return operator === '+' ? Number(base) + Number(offset) : Number(base) - Number(offset);
  }
  if (/^\d+$/.test(substituted)) return Number(substituted);
  throw new Error(`Unsupported z-index value: ${value}`);
}

const layers = {
  stickyQuickActions: { source: viewsCss, selector: '.quick-actions' },
  fixedMobileActionBar: { source: viewsCss, selector: '.quick-actions.fixed-mobile' },
  mobileHeader: { source: appLayoutSource, selector: '.mobile-header' },
  sidebarOverlay: { source: appLayoutSource, selector: '.sidebar-overlay' },
  sidebar: { source: appLayoutSource, selector: '.sidebar' },
  modalOverlay: { source: modalSource, selector: '.modal-overlay' },
  rentPaymentModalOverlay: { source: rentPaymentModalSource, selector: '.modal-overlay' },
  rentFormModalOverlay: { source: rentFormModalSource, selector: '.modal-overlay' },
} as const;

type Layer = keyof typeof layers;

function zIndexOf(layer: Layer): number {
  const { source, selector } = layers[layer];
  return resolveZIndex(zIndexDeclaration(source, selector));
}

describe('z-index scale', () => {
  it('defines an ascending scale from sticky content to tooltips', () => {
    const order = ['sticky', 'fixed', 'modal-backdrop', 'modal', 'popover', 'tooltip'];
    const values = order.map(name => scale[name]);

    expect(values.every(value => typeof value === 'number')).toBe(true);
    expect(values).toEqual([...values].sort((a, b) => Number(a) - Number(b)));
    expect(new Set(values).size).toBe(order.length);
  });

  it.each(Object.keys(layers) as Layer[])('%s uses a --z-* scale token', layer => {
    const { source, selector } = layers[layer];

    expect(zIndexDeclaration(source, selector)).toMatch(/var\(--z-[\w-]+/);
  });

  it('keeps sticky page content beneath the mobile header, sidebar and its overlay', () => {
    expect(zIndexOf('stickyQuickActions')).toBeLessThan(zIndexOf('sidebarOverlay'));
    expect(zIndexOf('sidebarOverlay')).toBeLessThan(zIndexOf('mobileHeader'));
    expect(zIndexOf('sidebarOverlay')).toBeLessThan(zIndexOf('sidebar'));
  });

  it('keeps modals above page content and the app chrome', () => {
    const modal = zIndexOf('modalOverlay');

    expect(modal).toBe(scale['modal']);
    for (const layer of [
      'stickyQuickActions',
      'fixedMobileActionBar',
      'mobileHeader',
      'sidebarOverlay',
      'sidebar',
    ] as const) {
      expect(zIndexOf(layer), layer).toBeLessThan(modal);
    }
  });

  it('puts the rent modals on the same layer as the shared Modal', () => {
    expect(zIndexOf('rentPaymentModalOverlay')).toBe(zIndexOf('modalOverlay'));
    expect(zIndexOf('rentFormModalOverlay')).toBe(zIndexOf('modalOverlay'));
  });
});
