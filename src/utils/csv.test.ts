import { describe, expect, it } from 'vitest';
import { csvEscape } from './csv';

describe('csvEscape', () => {
  it('quotes plain text and empty values', () => {
    expect(csvEscape('Bogura')).toBe('"Bogura"');
    expect(csvEscape('')).toBe('""');
    expect(csvEscape(null)).toBe('""');
    expect(csvEscape(undefined)).toBe('""');
    expect(csvEscape(42)).toBe('"42"');
  });

  it('doubles embedded quotes and flattens newlines', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('a\r\nb\nc')).toBe('"a b c"');
  });

  it.each(['=1+1', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd'])(
    'neutralises a formula-leading cell %j',
    (value) => {
      const out = csvEscape(value);
      expect(out.startsWith(`"'`)).toBe(true);
    }
  );

  it('prefixes before quoting so the quote survives inside the cell', () => {
    expect(csvEscape('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
  });

  it('leaves a formula character that is not first alone', () => {
    expect(csvEscape('a=b')).toBe('"a=b"');
    expect(csvEscape('Rx-2026')).toBe('"Rx-2026"');
  });
});
