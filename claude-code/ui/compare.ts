/**
 * Field-by-field comparison between a parsed payload and the bake-off spec's
 * expected JSON. Drives the verification UI's diff table.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');

export interface Discrepancy {
  fixture: string;
  path: string;
  specValue: number;
  arithmeticValue: number;
  evidence: string;
}

export const DISCREPANCY_DOC: { note: string; discrepancies: Discrepancy[] } = JSON.parse(
  readFileSync(join(FIXTURES, 'known-discrepancies.json'), 'utf8'),
);

export type FieldStatus = 'match' | 'mismatch' | 'missing' | 'extra' | 'dynamic' | 'known-spec-error';

export interface FieldResult {
  path: string;
  expected: unknown;
  actual: unknown;
  status: FieldStatus;
  note?: string;
}

const DYNAMIC = '<dynamic>';

/** Flatten an object/array tree to `a.b[0].c` -> leaf value. */
function flatten(value: unknown, prefix = '', out = new Map<string, unknown>()): Map<string, unknown> {
  if (Array.isArray(value)) {
    if (value.length === 0) out.set(prefix, []);
    value.forEach((item, i) => flatten(item, `${prefix}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) out.set(prefix, {});
    for (const [key, child] of entries) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.set(prefix, value);
  }
  return out;
}

export function compareToExpected(
  actualPayload: unknown,
  expectedPayload: unknown,
  fixtureName: string,
): { fields: FieldResult[]; counts: Record<FieldStatus, number>; pass: boolean } {
  const expected = flatten(expectedPayload);
  const actual = flatten(actualPayload);
  const known = new Map(
    DISCREPANCY_DOC.discrepancies
      .filter((d) => d.fixture === fixtureName)
      .map((d) => [d.path, d] as const),
  );

  const paths = [...new Set([...expected.keys(), ...actual.keys()])];
  const fields: FieldResult[] = paths.map((path) => {
    const hasExpected = expected.has(path);
    const hasActual = actual.has(path);
    const e = expected.get(path);
    const a = actual.get(path);

    if (e === DYNAMIC) {
      return { path, expected: e, actual: a, status: 'dynamic', note: 'dynamic value — not compared' };
    }
    if (!hasExpected) return { path, expected: undefined, actual: a, status: 'extra' };
    if (!hasActual) return { path, expected: e, actual: undefined, status: 'missing' };
    if (Object.is(e, a) || JSON.stringify(e) === JSON.stringify(a)) {
      return { path, expected: e, actual: a, status: 'match' };
    }

    const discrepancy = known.get(path);
    if (discrepancy && a === discrepancy.arithmeticValue) {
      return {
        path,
        expected: e,
        actual: a,
        status: 'known-spec-error',
        note: discrepancy.evidence,
      };
    }
    return { path, expected: e, actual: a, status: 'mismatch' };
  });

  const counts = fields.reduce(
    (acc, f) => ({ ...acc, [f.status]: (acc[f.status] ?? 0) + 1 }),
    {} as Record<FieldStatus, number>,
  );

  const pass = !fields.some((f) => f.status === 'mismatch' || f.status === 'missing' || f.status === 'extra');
  return { fields, counts, pass };
}
