/**
 * The one HTML-escaping helper for every generated document in this repo —
 * the PDF templates in `@finance-crm/common`'s `templates/pdf/` and the email
 * templates in `automation-worker`, which previously each carried their own
 * copy (the email ones) or none at all (the PDF ones).
 *
 * The PDF path is why quotes matter here and not just `& < >`. Those
 * templates are rendered by headless Chrome (`PuppeteerPdfRenderer`), so an
 * unescaped value is not merely cosmetic markup breakage — it is script
 * execution on the server, inside the VPC, against a document (a sanction
 * letter / loan agreement) whose content is legally meaningful. Values land
 * in attribute position as well as text position (`<img alt="${...}">`), so
 * `"` and `'` have to go too or an injected value can close the attribute
 * and open an event handler.
 *
 * Escapes `&` first — doing it later would double-escape the entities the
 * earlier replacements just introduced.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
