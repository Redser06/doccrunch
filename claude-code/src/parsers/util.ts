/** Shared, deterministic helpers for the built-in parsers. No LLM, no network. */

/** Round to 2dp, symmetric around zero, immune to float drift (0.1+0.2 etc.). */
export function round2(n: number): number {
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(n) + Number.EPSILON) * 100)) / 100;
}

export function sum(values: number[]): number {
  return round2(values.reduce((acc, v) => acc + v, 0));
}

/**
 * Parse a money/number token: strips currency symbols, thousands separators and
 * trailing minus, and reads accounting parentheses as negative.
 */
export function parseNumber(raw: string, field = 'value'): number {
  let s = raw.trim();
  if (!s) throw new Error(`Expected a number for ${field}, got an empty value`);
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/-$/.test(s)) {
    negative = true;
    s = s.slice(0, -1);
  }
  s = s.replace(/[€$£,\s]/g, '');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  }
  const n = Number(s);
  if (!Number.isFinite(n)) {
    throw new Error(`Expected a number for ${field}, got "${raw}"`);
  }
  return negative ? -n : n;
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Normalize a date to an ISO calendar date (YYYY-MM-DD).
 * Handles `2025-07-01`, `01 July 2025`, `1 Jul 2025`, `01/07/2025` (day-first,
 * the Irish/UK convention these documents use).
 */
export function toIsoDate(raw: string, field = 'date'): string {
  const s = raw.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const worded = /^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})$/.exec(s);
  if (worded) {
    const month = MONTHS[worded[2]!.slice(0, 3).toLowerCase()];
    if (month) return `${worded[3]}-${month}-${worded[1]!.padStart(2, '0')}`;
  }

  const slashed = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(s);
  if (slashed) {
    return `${slashed[3]}-${slashed[2]!.padStart(2, '0')}-${slashed[1]!.padStart(2, '0')}`;
  }

  throw new Error(`Could not parse ${field} "${raw}" (expected YYYY-MM-DD, DD/MM/YYYY or "01 July 2025")`);
}

/**
 * Normalize a timestamp to second-precision UTC ISO (`2025-07-15T00:00:00Z`).
 * Deliberately not `Date#toISOString()`, which emits noisy `.000` milliseconds.
 */
export function toIsoDateTime(raw: string, field = 'timestamp'): string {
  const s = raw.trim();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Could not parse ${field} "${raw}" (expected an ISO datetime)`);
  }
  return `${d.toISOString().slice(0, 19)}Z`;
}

/** First non-empty capture of the first matching pattern. */
export function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m?.[1]?.trim()) return m[1]!.trim();
  }
  return undefined;
}

/** Case/space-insensitive lookup into a CSV row keyed by header name. */
export function pick(
  row: Record<string, string | undefined>,
  ...names: string[]
): string | undefined {
  const normalize = (s: string) => s.replace(/[\s_-]/g, '').toLowerCase();
  const index = new Map<string, string>();
  for (const key of Object.keys(row)) index.set(normalize(key), key);
  for (const name of names) {
    const key = index.get(normalize(name));
    if (key !== undefined) {
      const value = row[key];
      if (value !== undefined && value !== '') return value;
    }
  }
  return undefined;
}

/** The first non-empty line of a document — usually the CSV header. */
export function headerLine(text: string): string {
  for (const line of text.split(/\r?\n/)) {
    if (line.trim()) return line.trim();
  }
  return '';
}
