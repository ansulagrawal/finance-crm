import type { Response } from 'express';

/**
 * Characters that make Excel/LibreOffice/Sheets treat a cell as a formula
 * rather than text. `\t` and `\r` are in here because those two also start
 * formula interpretation in some versions once the leading whitespace is
 * trimmed.
 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * RFC 4180 field escaping — quote a field if it contains a comma, quote, or
 * newline, doubling any embedded quotes — plus CSV-injection neutralisation.
 *
 * The second part matters because these exports carry attacker-influenceable
 * free text: lead names, collection remarks, and customer feedback (which
 * arrives through an unauthenticated endpoint). A cell beginning `=`, `+`,
 * `-` or `@` is evaluated as a formula when a staff member opens the file,
 * which is a code-execution path on their machine (`=HYPERLINK`,
 * `=WEBSERVICE` for silent exfiltration, or a DDE payload) — RFC 4180
 * quoting does nothing about it, since the spreadsheet strips the quotes
 * before parsing the value.
 *
 * Prefixing with a single quote is the standard neutralisation: the cell
 * displays as text and the leading `'` is not shown by any major
 * spreadsheet. The value is then also force-quoted, so the `'` cannot be
 * confused for a field delimiter by a non-spreadsheet consumer.
 */
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  const needsFormulaGuard = FORMULA_TRIGGERS.some((trigger) =>
    str.startsWith(trigger),
  );
  const guarded = needsFormulaGuard ? `'${str}` : str;
  if (needsFormulaGuard || /[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

/** Serializes an array of plain objects to CSV text, header row first.
 * `columns` controls both the column order and which keys are included —
 * if omitted, uses the keys of the first row. */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns?: string[],
): string {
  if (rows.length === 0) {
    return columns ? `${columns.join(',')}\n` : '';
  }
  const cols = columns ?? Object.keys(rows[0]);
  const header = cols.map(escapeCsvField).join(',');
  const body = rows
    .map((row) => cols.map((col) => escapeCsvField(row[col])).join(','))
    .join('\r\n');
  return `${header}\r\n${body}\r\n`;
}

/** Sends `rows` as a CSV file download — the standard response shape for
 * every export endpoint in this service, mirroring legacy's `dataExport()`
 * (`Content-Type: application/csv` + `fputcsv` streaming), replacing the
 * streaming with a single buffered write (export result sets here are
 * bounded, not unbounded streams). */
export function sendCsv<T extends Record<string, unknown>>(
  res: Response,
  filename: string,
  rows: T[],
  columns?: string[],
): void {
  const csv = toCsv(rows, columns);
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
  res.send(csv);
}
