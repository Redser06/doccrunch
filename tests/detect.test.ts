import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { detectType } from '../src/index.js';

const FIX = join(__dirname, 'fixtures');

describe('detectType', () => {
  it('detects merchant statement', async () => {
    expect(detectType(await readFile(join(FIX, 'merchant-statement.txt'), 'utf-8'))).toBe('merchant-statement');
  });
  it('detects bank csv', async () => {
    expect(detectType(await readFile(join(FIX, 'bank.csv'), 'utf-8'))).toBe('bank-csv');
  });
  it('detects esb meter', async () => {
    expect(detectType(await readFile(join(FIX, 'esb.csv'), 'utf-8'))).toBe('esb-meter');
  });
  it('throws on unknown content', () => {
    expect(() => detectType('just some random prose')).toThrow(/Could not detect/);
  });
});
