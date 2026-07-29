import { parseCorsOrigins } from './cors-origins';

describe('parseCorsOrigins', () => {
  it('splits a comma-separated list and trims each entry', () => {
    expect(
      parseCorsOrigins(
        'https://crm.financecrm.com, https://example.cloudfront.net',
      ),
    ).toEqual([
      'https://crm.financecrm.com',
      'https://example.cloudfront.net',
    ]);
  });

  it('returns a single origin as a one-element array', () => {
    expect(parseCorsOrigins('https://only.example.com')).toEqual([
      'https://only.example.com',
    ]);
  });

  it('drops empty segments from a trailing or doubled comma', () => {
    expect(
      parseCorsOrigins('https://a.example.com,,https://b.example.com,'),
    ).toEqual(['https://a.example.com', 'https://b.example.com']);
  });

  // The important one: `credentials: true` forbids '*', so an unset variable
  // must narrow to the dev origin rather than widen to "anything".
  it.each([undefined, '', '   ', ',,'])(
    'falls back to the dev origin for %p instead of a wildcard',
    (value) => {
      expect(parseCorsOrigins(value)).toEqual(['http://localhost:5173']);
    },
  );

  it('honours an explicit fallback', () => {
    expect(parseCorsOrigins(undefined, 'https://fallback.example.com')).toEqual(
      ['https://fallback.example.com'],
    );
  });
});
