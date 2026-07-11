/**
 * Convert an HTML string to plain text without ever executing it (issue #80, I1).
 *
 * The HTML is parsed with `DOMParser.parseFromString`, which produces an INERT
 * document: `<script>` elements never run and event handlers (e.g.
 * `<img src=x onerror=...>`) never fire — unlike assigning to the `innerHTML`
 * of an element created on the live document, where such payloads execute even
 * on a detached node.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';

  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Non-rendered content must not leak into the plain text output.
  doc.body
    .querySelectorAll('script, style, noscript, template, iframe, object, embed')
    .forEach(el => el.remove());

  // `innerText` is unavailable on an inert document and `textContent` ignores
  // layout, so materialize line breaks from <br> and block-level elements.
  doc.body.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  doc.body
    .querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, tr, blockquote, pre')
    .forEach(el => el.append('\n'));

  let decoded = doc.body.textContent || '';

  // Normalize line endings and collapse multiple blank lines.
  decoded = decoded
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.trimEnd())
    .join('\n');
  decoded = decoded.replace(/\n{3,}/g, '\n\n').trim();
  return decoded;
}
