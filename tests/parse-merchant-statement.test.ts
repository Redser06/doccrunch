import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseText, MerchantStatementSchema } from '../src/index.js';

const FIX = join(__dirname, 'fixtures');

describe('merchant-statement parser', () => {
  it('matches expected JSON (excluding dynamic timestamp)', async () => {
    const content = await readFile(join(FIX, 'merchant-statement.txt'), 'utf-8');
    const expected = JSON.parse(await readFile(join(FIX, 'merchant-statement-expected.json'), 'utf-8'));
    const result = await parseText(content, { source: 'merchant-statement.txt' });
    expect(result.meta.type).toBe('merchant-statement');
    const p = MerchantStatementSchema.parse(result.payload) as any;
    // strip dynamic field before comparison
    delete p.meta.generatedAt;
    const exp: any = { ...expected };
    delete exp.meta.generatedAt;
    expect(p).toEqual(exp);
  });

  it('netSettlement equals totalVolume minus totalFees', async () => {
    const content = await readFile(join(FIX, 'merchant-statement.txt'), 'utf-8');
    const result = await parseText(content, { source: 'x' });
    const p = MerchantStatementSchema.parse(result.payload) as any;
    expect(Math.round((p.summary.totalVolume - p.summary.totalFees) * 100) / 100)
      .toBe(Math.round(p.summary.netSettlement * 100) / 100);
  });
});
