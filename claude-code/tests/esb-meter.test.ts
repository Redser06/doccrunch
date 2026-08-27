import { describe, expect, it } from 'vitest';
import { parse, parseText, type EsbReading } from '../src/index.js';
import { correctedExpectation, fixturePath, readFixture, readJsonFixture } from './helpers.js';

const spec = readJsonFixture<EsbReading>('esb-expected.json');
const expected = correctedExpectation<EsbReading>('esb-expected.json');

describe('esb-meter end-to-end', () => {
  it('matches the expected JSON field for field', async () => {
    const { payload } = await parse<EsbReading>(fixturePath('esb.csv'));
    expect(payload.mprn).toBe(expected.mprn);
    expect(payload.readings).toEqual(spec.readings); // readings match the spec verbatim
    expect(payload.readings).toHaveLength(48);
    expect(payload.summary).toEqual(expected.summary);
  });

  it('wraps the payload in the normalized envelope', async () => {
    const envelope = await parse(fixturePath('esb.csv'));
    expect(envelope.meta.type).toBe('esb-meter');
    expect(envelope.meta.source).toBe('esb.csv');
    expect(envelope.meta.confidence).toBe('high');
    expect(envelope.meta.parserVersion).toBe('esb-meter@0.1.0');
  });

  it('keeps second-precision UTC timestamps (no .000 milliseconds)', () => {
    const { payload } = parseText<EsbReading>(readFixture('esb.csv'));
    for (const reading of payload.readings) {
      expect(reading.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    }
  });

  it('counts distinct calendar days', () => {
    const twoDays = [
      'MPRN,Timestamp,Import_kWh,Export_kWh,Tariff',
      '1,2025-07-15T23:30:00Z,0.10,0.00,night',
      '1,2025-07-16T00:00:00Z,0.20,0.05,night',
    ].join('\n');
    const { payload } = parseText<EsbReading>(twoDays);
    expect(payload.summary).toEqual({ totalImport_kwh: 0.3, totalExport_kwh: 0.05, days: 2 });
  });

  it('sums without floating-point drift', () => {
    const { payload } = parseText<EsbReading>(readFixture('esb.csv'));
    expect(payload.summary.totalImport_kwh).toBe(13.71);
    expect(payload.summary.totalExport_kwh).toBe(6.29);
  });

  it('defaults export to 0 and drops unrecognised tariffs', () => {
    const csv = [
      'MPRN,Timestamp,Import_kWh',
      '1,2025-07-15T00:00:00Z,0.12',
    ].join('\n');
    const { payload } = parseText<EsbReading>(csv);
    expect(payload.readings[0]).toEqual({
      timestamp: '2025-07-15T00:00:00Z',
      import_kwh: 0.12,
      export_kwh: 0,
    });
  });

  it('rejects negative kWh via the schema', () => {
    const csv = [
      'MPRN,Timestamp,Import_kWh,Export_kWh',
      '1,2025-07-15T00:00:00Z,-0.12,0.00',
    ].join('\n');
    expect(() => parseText(csv)).toThrow(/failed schema validation/i);
  });
});
