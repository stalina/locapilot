import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { readComponentRules } from '@/test/themeColors';

// `white` is exactly --bg-primary in light mode, so a hard-coded white surface
// only differs in dark mode, where it ends up behind near-white --text-* text.
// The PDF thumbnail is the one exception: it shows a paper page.
const DIRECTORY = 'src/shared/components';
const STYLESHEETS = ['src/assets/styles/views.css'];
const ALLOWED = ['src/shared/components/DocumentCard.vue .pdf-thumbnail'];
const HARD_CODED_WHITE = /^(white|#fff|#ffffff)$/i;

describe('Shared component and view surfaces', () => {
  it('never hard-code a white background', () => {
    const paths = readdirSync(join(process.cwd(), DIRECTORY))
      .filter(file => file.endsWith('.vue'))
      .map(file => `${DIRECTORY}/${file}`)
      .concat(STYLESHEETS);

    const offenders = paths.flatMap(path =>
      readComponentRules(path)
        .filter(rule =>
          ['background', 'background-color'].some(property =>
            HARD_CODED_WHITE.test(rule.declarations[property] ?? '')
          )
        )
        .flatMap(rule => rule.selectors.map(selector => `${path} ${selector}`))
    );

    expect(offenders).toEqual(ALLOWED);
  });
});
