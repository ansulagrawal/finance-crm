import { escapeHtml } from './escape-html';

describe('escapeHtml', () => {
  it('neutralises a script-injection payload in text position', () => {
    const payload = '<img src=x onerror="fetch(\'http://evil/\')">';

    const escaped = escapeHtml(payload);

    expect(escaped).not.toContain('<img');
    expect(escaped).not.toContain('"');
    expect(escaped).toContain('&lt;img');
  });

  it('escapes both quote styles, so a value cannot break out of an attribute', () => {
    // `<img src="${...}" alt="${...}">` in the sanction-letter template is
    // why this matters: without quote escaping, a value can close the
    // attribute and open an event handler.
    expect(escapeHtml('" onerror="alert(1)')).toBe(
      '&quot; onerror=&quot;alert(1)',
    );
    expect(escapeHtml("' onerror='alert(1)")).toBe(
      '&#39; onerror=&#39;alert(1)',
    );
  });

  it('escapes & first so entities are not double-escaped', () => {
    expect(escapeHtml('a & b < c')).toBe('a &amp; b &lt; c');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('renders null and undefined as an empty string rather than "null"', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('stringifies non-strings', () => {
    expect(escapeHtml(42)).toBe('42');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeHtml('Ramesh Kumar')).toBe('Ramesh Kumar');
  });
});
