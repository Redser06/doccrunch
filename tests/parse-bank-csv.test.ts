import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseText, BankCsvSchema } from '../src/index.js';

const FIX = join(__dirname, 'fixtures');

describe('bank-csv parser', () => {
  it('matches expected JSON exactly', async () => {
    const content = await readFile(join(FIX, 'bank.csv'), 'utf-8');
    const expected = JSON.parse(await readFile(join(FIX, 'bank-expected.json'), 'utf-8'));
    const result = await parseText(content, { source: 'bank.csv' });
    expect(result.meta.type).toBe('bank-csv');
    expect(BankCsvSchema.parse(result.payload)).toEqual(expected);
  });

  it('summary totals are internally consistent', async () => {
    const content = await readFile(join(FIX, 'bank.csv'), 'utf-8');
    const result = await parseText(content, { source: 'bank.csv' });
    const p = result.payload as any;
    expect(Math.round((p.summary.totalIn - p.summary.totalOut) * 100) / 100).toBe(p.summary.net);
  });
});
