/* eslint-env vitest */
/* global describe,it,expect */
import { formatAnnoncePlaceholders, defaultAnnonceTemplate } from './annonceTemplate';

describe('annonceTemplate utils', () => {
  it('replaces placeholders with formatted values', () => {
    const tpl = 'Loyer: {LOYER} €, Charges: {CHARGES} €, Garantie: {GARANTIE} €';
    const result = formatAnnoncePlaceholders(tpl, { LOYER: 1200, CHARGES: 50.5, GARANTIE: 1200 });
    expect(result).toContain('1 200,00');
    expect(result).toContain('50,50');
    expect(result).toContain('1 200,00');
  });

  it('default template contains placeholders', () => {
    const tpl = defaultAnnonceTemplate();
    expect(tpl).toContain('{LOYER}');
    expect(tpl).toContain('{CHARGES}');
    expect(tpl).toContain('{GARANTIE}');
  });
});
