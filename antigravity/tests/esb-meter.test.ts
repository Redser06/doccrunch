import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, parseText } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, 'fixtures');

describe('ESB Smart Meter CSV Parser', () => {
  it('parses ESB fixture and matches expected JSON exactly', async () => {
    const fixturePath = path.join(fixturesDir, 'esb.csv');
    const expectedRaw = await fs.readFile(
      path.join(fixturesDir, 'esb-expected.json'),
      'utf-8'
    );
    const expected = JSON.parse(expectedRaw);

    const envelope = await parse(fixturePath);

    expect(envelope.meta.type).toBe('esb-meter');
    expect(envelope.meta.confidence).toBe('high');
    expect(envelope.meta.parserVersion).toBe('esb-meter@0.1.0');
    expect(envelope.meta.source).toBe(fixturePath);

    const payload = envelope.payload;

    expect(payload.mprn).toBe(expected.mprn);
    expect(payload.summary).toEqual(expected.summary);
    expect(payload.readings).toHaveLength(expected.readings.length);
    expect(payload.readings).toEqual(expected.readings);
  });

  it('parses in-memory ESB CSV text', async () => {
    const csvContent = 'MPRN,Timestamp,Import_kWh,Export_kWh,Tariff\n999,2025-07-15T00:00:00Z,1.5,0.2,day';
    const envelope = await parseText(csvContent);

    expect(envelope.meta.type).toBe('esb-meter');
    expect(envelope.payload.mprn).toBe('999');
    expect(envelope.payload.summary.totalImport_kwh).toBe(1.5);
    expect(envelope.payload.summary.totalExport_kwh).toBe(0.2);
    expect(envelope.payload.summary.days).toBe(1);
  });
});
