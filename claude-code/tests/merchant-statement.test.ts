import { describe, expect, it } from 'vitest';
import { parse, parseText, type MerchantStatement } from '../src/index.js';
import { fixturePath, readFixture, readJsonFixture } from './helpers.js';

const expected = readJsonFixture<MerchantStatement>('merchant-statement-expected.json');

describe('merchant-statement end-to-end', () => {
  it('matches the expected JSON field for field', async () => {
    const envelope = await parse<MerchantStatement>(fixturePath('merchant-statement.txt'));
    const { meta, summary, lineItems } = envelope.payload;

    expect(meta.provider).toBe(expected.meta.provider);
    expect(meta.statementPeriodStart).toBe(expected.meta.statementPeriodStart);
    expect(meta.statementPeriodEnd).toBe(expected.meta.statementPeriodEnd);
    expect(meta.merchantId).toBe(expected.meta.merchantId);
    expect(meta.merchantName).toBe(expected.meta.merchantName);
    expect(meta.currency).toBe('EUR');
    // generatedAt is dynamic; assert only that it is a valid ISO datetime.
    expect(new Date(meta.generatedAt).toISOString()).toBe(meta.generatedAt);

    expect(summary).toEqual(expected.summary);
    expect(lineItems).toEqual(expected.lineItems);
    expect(lineItems).toHaveLength(6);
  });

  it('wraps the payload in the normalized envelope', async () => {
    const envelope = await parse(fixturePath('merchant-statement.txt'));
    expect(envelope.meta.type).toBe('merchant-statement');
    expect(envelope.meta.source).toBe('merchant-statement.txt');
    expect(envelope.meta.confidence).toBe('high');
    expect(envelope.meta.parserVersion).toBe('merchant-statement@0.1.0');
    expect(new Date(envelope.meta.parsedAt).toISOString()).toBe(envelope.meta.parsedAt);
    expect(envelope.warnings).toBeUndefined();
  });

  it("reconciles the statement's own SUMMARY against the line items", async () => {
    const { payload } = await parse<MerchantStatement>(fixturePath('merchant-statement.txt'));
    const volume = payload.lineItems.reduce((a, l) => a + l.volume, 0);
    const fees = payload.lineItems.reduce((a, l) => a + l.totalFee, 0);
    expect(volume).toBeCloseTo(payload.summary.totalVolume, 2);
    expect(fees).toBeCloseTo(payload.summary.totalFees, 2);
    expect(volume - fees).toBeCloseTo(payload.summary.netSettlement, 2);
  });

  it('maps card types and transaction types onto the enums', () => {
    const { payload } = parseText<MerchantStatement>(readFixture('merchant-statement.txt'));
    expect(payload.lineItems.map((l) => l.cardType)).toEqual([
      'visa', 'mastercard', 'amex', 'visa-debit', 'mastercard', 'visa',
    ]);
    expect(payload.lineItems.map((l) => l.transactionType)).toEqual([
      'sale', 'sale', 'sale', 'sale', 'refund', 'sale',
    ]);
  });

  it('warns and downgrades confidence when stated totals do not reconcile', () => {
    const tampered = readFixture('merchant-statement.txt').replace(
      'Total Volume:           6525.00',
      'Total Volume:           9999.00',
    );
    const envelope = parseText<MerchantStatement>(tampered);
    expect(envelope.meta.confidence).toBe('medium');
    expect(envelope.warnings?.[0]).toContain('summary.totalVolume');
  });

  it('falls back to computed totals when the SUMMARY block is missing', () => {
    const noSummary = readFixture('merchant-statement.txt').split('SUMMARY')[0]!;
    const { payload } = parseText<MerchantStatement>(noSummary);
    expect(payload.summary).toEqual(expected.summary);
  });

  it('throws a useful error when there are no transaction rows', () => {
    expect(() =>
      parseText('ELAVON MERCHANT SERVICES\nMerchant Statement\nno rows here'),
    ).toThrow(/No transaction rows found/);
  });
});
