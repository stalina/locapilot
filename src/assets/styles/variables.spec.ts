import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// Raw source of every stylesheet and SFC, so CSS custom property usages can be
// checked against their declarations without rendering anything. Read from disk
// because Vitest does not process CSS, so `?raw` imports of .css come back empty.
const srcDir = join(process.cwd(), 'src');
const sources: Record<string, string> = Object.fromEntries(
  readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
    .filter(file => /\.(vue|css)$/.test(file))
    .map(file => [
      relative(process.cwd(), join(srcDir, file)),
      readFileSync(join(srcDir, file), 'utf8'),
    ])
);

const declaredTokens = new Set(
  Object.values(sources).flatMap(source =>
    Array.from(source.matchAll(/(--[\w-]+)\s*:/g), match => match[1])
  )
);

function findUndefinedTokens(): string[] {
  return Object.entries(sources).flatMap(([file, source]) =>
    Array.from(source.matchAll(/var\(\s*(--[\w-]+)/g), match => match[1])
      .filter(token => !declaredTokens.has(token))
      .map(token => `${file}: ${token}`)
  );
}

describe('design tokens', () => {
  it('only references CSS custom properties that are declared somewhere in src', () => {
    expect(findUndefinedTokens()).toEqual([]);
  });

  it('no longer uses the --spacing-* / --color-* aliases that were never declared', () => {
    const offenders = Object.entries(sources)
      .filter(([, source]) =>
        /var\(\s*--(spacing-\d|color-(text|surface|background|border|primary))/.test(source)
      )
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });
});
