import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseText, ESBMeterSchema } from '../src/index.js';

const FIX = join(__dirname, 'fixtures');

describe('esb-meter parser', () => {
  it('parses the day of readings with correct summary', async () => {
    const content = await readFile(join(FIX, 'esb.csv'), 'utf-8');
    const result = await parseText(content, { source: 'esb.csv' });
    expect(result.meta.type).toBe('esb-meter');
    const p = ESBMeterSchema.parse(result.payload);
    expect(p.mprn).toBe('10001234567');
    expect(p.readings).toHaveLength(48);
    expect(p.summary.days).toBe(1);
    // totals derived from the fixture
    const sumIn = p.readings.reduce((s, r) => s + r.import_kwh, 0);
    expect(p.summary.totalImport_kwh).toBeCloseTo(sumIn, 2);
    expect(p.summary.totalImport_kwh).toBeCloseTo(13.71, 2);
    expect(p.summary.totalExport_kwh).toBeCloseTo(6.29, 2);
  });

  it('every reading is a valid ISO timestamp', async () => {
    const content = await readFile(join(FIX, 'esb.csv'), 'utf-8');
    const result = await parseText(content, { source: 'esb.csv' });
    const p = ESBMeterSchema.parse(result.payload);
    for (const r of p.readings) expect(new Date(r.timestamp).toString()).not.toBe('Invalid Date');
  });
});
