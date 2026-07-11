import { describe, it, expect, vi, afterEach } from 'vitest';
import { htmlToPlainText } from './htmlToPlainText';

describe('htmlToPlainText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an empty string for empty input', () => {
    expect(htmlToPlainText('')).toBe('');
    expect(htmlToPlainText(undefined as unknown as string)).toBe('');
  });

  it('converts basic HTML to plain text preserving line breaks', () => {
    const html = '<p>Ligne 1</p><p>Ligne 2</p>';
    expect(htmlToPlainText(html)).toBe('Ligne 1\nLigne 2');
  });

  it('materializes <br> as newlines', () => {
    expect(htmlToPlainText('Bonjour<br>tout<br>le monde')).toBe('Bonjour\ntout\nle monde');
  });

  it('collapses 3+ consecutive blank lines into a single blank line', () => {
    const html = '<p>A</p><br><br><br><p>B</p>';
    expect(htmlToPlainText(html)).toBe('A\n\nB');
  });

  it('decodes HTML entities into their characters', () => {
    expect(htmlToPlainText('Loyer&nbsp;: 800&euro;')).toContain('800');
    expect(htmlToPlainText('a &amp; b')).toBe('a & b');
  });

  // --- Security (issue #80, I1): payloads must never execute ---

  it('does NOT execute an <img onerror> payload and copies only text', () => {
    const errorSpy = vi.fn();
    // If the payload executed, this handler would have to fire; we also assert
    // that the returned text carries no live markup.
    window.addEventListener('error', errorSpy);

    const result = htmlToPlainText('avant<img src=x onerror="window.__pwned=true">apres');

    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('<img');
    expect(result).toContain('avant');
    expect(result).toContain('apres');

    window.removeEventListener('error', errorSpy);
  });

  it('strips <script> content entirely and executes nothing', () => {
    const result = htmlToPlainText('<p>Texte</p><script>window.__xss=true</script>');

    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined();
    expect(result).not.toContain('window.__xss');
    expect(result).not.toContain('<script');
    expect(result).toContain('Texte');
  });

  it('removes style/iframe/object non-content elements from the output', () => {
    const result = htmlToPlainText(
      '<style>.x{color:red}</style><p>Visible</p><iframe src="evil"></iframe>'
    );
    expect(result).not.toContain('color:red');
    expect(result).not.toContain('evil');
    expect(result.trim()).toBe('Visible');
  });
});
