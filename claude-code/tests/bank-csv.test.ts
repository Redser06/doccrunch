import { describe, expect, it } from 'vitest';
import { parse, parseText, type BankStatement } from '../src/index.js';
import { correctedExpectation, fixturePath, readFixture, readJsonFixture } from './helpers.js';

const spec = readJsonFixture<BankStatement>('bank-expected.json');
const expected = correctedExpectation<BankStatement>('bank-expected.json');

describe('bank-csv end-to-end', () => {
  it('matches the expected JSON field for field', async () => {
    const { payload } = await parse<BankStatement>(fixturePath('bank.csv'));
    expect(payload.currency).toBe(expected.currency);
    expect(payload.rows).toEqual(spec.rows); // rows match the spec verbatim
    expect(payload.summary).toEqual(expected.summary);
    expect(payload.account).toBeUndefined();
  });

  it('wraps the payload in the normalized envelope', async () => {
    const envelope = await parse(fixturePath('bank.csv'));
    expect(envelope.meta.type).toBe('bank-csv');
    expect(envelope.meta.source).toBe('bank.csv');
    expect(envelope.meta.confidence).toBe('high');
    expect(envelope.meta.parserVersion).toBe('bank-csv@0.1.0');
  });

  it('signs amounts as + credit / - debit and reconciles the summary', () => {
    const { payload } = parseText<BankStatement>(readFixture('bank.csv'));
    const credits = payload.rows.filter((r) => r.amount > 0);
    const debits = payload.rows.filter((r) => r.amount < 0);
    expect(credits).toHaveLength(3);
    expect(debits).toHaveLength(7);
    expect(payload.summary.totalIn - payload.summary.totalOut).toBeCloseTo(payload.summary.net, 2);
  });

  it("agrees with the fixture's own closing balance", () => {
    const { payload } = parseText<BankStatement>(readFixture('bank.csv'));
    expect(payload.summary.net).toBe(payload.rows[payload.rows.length - 1]!.balance);
  });

  it('handles alternative headers, day-first dates and formatted amounts', () => {
    const csv = [
      'Date,Description,Amount,Balance,Category,Currency',
      '01/07/2025,"Salary, ACME",€1234.56,1234.56,income,EUR',
      '02/07/2025,Rent,(1000.00),234.56,housing,EUR',
    ].join('\n');
    const { payload } = parseText<BankStatement>(csv, { type: 'bank-csv' });
    expect(payload.rows[0]).toEqual({
      date: '2025-07-01',
      description: 'Salary, ACME',
      amount: 1234.56,
      balance: 1234.56,
      category: 'income',
    });
    expect(payload.rows[1]!.amount).toBe(-1000);
    expect(payload.summary).toEqual({ totalIn: 1234.56, totalOut: 1000, net: 234.56 });
  });

  it('warns when the balance column does not reconcile', () => {
    const tampered = readFixture('bank.csv').replace('2790.50', '9999.99');
    const envelope = parseText<BankStatement>(tampered);
    expect(envelope.meta.confidence).toBe('medium');
    expect(envelope.warnings?.[0]).toContain('balance column does not reconcile');
  });

  it('rejects a CSV with no data rows', () => {
    expect(() => parseText('Date,Description,Amount\n')).toThrow(/no data rows/i);
  });
});
