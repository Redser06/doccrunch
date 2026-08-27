/**
 * The bake-off spec's expected JSON contains four summary values that do not
 * reconcile with the fixture rows the same spec supplies. DocCrunch computes the
 * arithmetically correct figures. These tests pin both sides of that gap so it
 * stays visible and cannot silently change.
 */
import { describe, expect, it } from 'vitest';
import { parseText, type BankStatement, type EsbReading } from '../src/index.js';
import { KNOWN_DISCREPANCIES, readFixture, readJsonFixture } from './helpers.js';

describe('known spec discrepancies', () => {
  it('bank: debits in the fixture sum to 1274.61, not the spec\'s 1334.61', () => {
    const debits = readFixture('bank.csv')
      .trim()
      .split('\n')
      .slice(1)
      .map((line) => Number(line.split(',')[2]))
      .filter((n) => n < 0);
    expect(Number(debits.reduce((a, b) => a + b, 0).toFixed(2))).toBe(-1274.61);
    expect(readJsonFixture<BankStatement>('bank-expected.json').summary.totalOut).toBe(1334.61);
    expect(parseText<BankStatement>(readFixture('bank.csv')).payload.summary.totalOut).toBe(1274.61);
  });

  it("bank: net matches the fixture's own closing balance (2790.50)", () => {
    const { payload } = parseText<BankStatement>(readFixture('bank.csv'));
    expect(payload.summary.net).toBe(2790.5);
    expect(payload.rows.at(-1)!.balance).toBe(2790.5);
    expect(readJsonFixture<BankStatement>('bank-expected.json').summary.net).toBe(2730.5);
  });

  it('esb: the 48 rows sum to 13.71 import / 6.29 export, not 13.05 / 4.72', () => {
    const rows = readFixture('esb.csv').trim().split('\n').slice(1);
    const col = (i: number) =>
      Number(rows.reduce((a, line) => a + Number(line.split(',')[i]), 0).toFixed(2));
    expect(col(2)).toBe(13.71);
    expect(col(3)).toBe(6.29);

    const { payload } = parseText<EsbReading>(readFixture('esb.csv'));
    expect(payload.summary.totalImport_kwh).toBe(13.71);
    expect(payload.summary.totalExport_kwh).toBe(6.29);
  });

  it('every recorded discrepancy still describes reality', () => {
    expect(KNOWN_DISCREPANCIES).toHaveLength(4);
    for (const d of KNOWN_DISCREPANCIES) {
      const specJson = readJsonFixture<any>(d.fixture);
      const actual = d.path.split('.').reduce((node, key) => node[key], specJson);
      expect(actual, `${d.fixture}#${d.path}`).toBe(d.specValue);
      expect(d.specValue).not.toBe(d.arithmeticValue);
    }
  });

  it('the merchant fixture, by contrast, reconciles perfectly', () => {
    const expected = readJsonFixture<any>('merchant-statement-expected.json');
    const volume = expected.lineItems.reduce((a: number, l: any) => a + l.volume, 0);
    const fees = expected.lineItems.reduce((a: number, l: any) => a + l.totalFee, 0);
    expect(Number(volume.toFixed(2))).toBe(expected.summary.totalVolume);
    expect(Number(fees.toFixed(2))).toBe(expected.summary.totalFees);
    expect(Number((volume - fees).toFixed(2))).toBe(expected.summary.netSettlement);
  });
});
