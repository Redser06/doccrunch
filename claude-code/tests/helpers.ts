import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function fixturePath(name: string): string {
  return join(FIXTURES_DIR, name);
}

export function readFixture(name: string): string {
  return readFileSync(fixturePath(name), 'utf8');
}

export function readJsonFixture<T = any>(name: string): T {
  return JSON.parse(readFixture(name)) as T;
}

export interface Discrepancy {
  fixture: string;
  path: string;
  specValue: number;
  arithmeticValue: number;
  evidence: string;
}

export const KNOWN_DISCREPANCIES: Discrepancy[] =
  readJsonFixture<{ discrepancies: Discrepancy[] }>('known-discrepancies.json').discrepancies;

function setPath(target: any, path: string, value: unknown): void {
  const keys = path.split('.');
  let node = target;
  for (const key of keys.slice(0, -1)) node = node[key];
  node[keys[keys.length - 1]!] = value;
}

/**
 * The spec's expected JSON with its four known arithmetic errors corrected.
 * This is what a deterministic parser reading the supplied fixture rows must produce.
 */
export function correctedExpectation<T = any>(fixtureName: string): T {
  const expected = readJsonFixture<any>(fixtureName);
  for (const d of KNOWN_DISCREPANCIES) {
    if (d.fixture === fixtureName) setPath(expected, d.path, d.arithmeticValue);
  }
  return expected as T;
}
