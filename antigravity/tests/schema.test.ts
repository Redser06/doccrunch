import { describe, it, expect } from 'vitest';
import {
  MerchantStatementSchema,
  BankStatementSchema,
  ESBReadingSchema,
  EnvelopeMetaSchema,
} from '../src/schemas/index.js';

describe('Schema Validation', () => {
  it('validates EnvelopeMetaSchema', () => {
    const validMeta = {
      type: 'bank-csv',
      source: 'test.csv',
      parsedAt: new Date().toISOString(),
      confidence: 'high' as const,
      parserVersion: 'bank-csv@0.1.0',
    };
    expect(() => EnvelopeMetaSchema.parse(validMeta)).not.toThrow();

    const invalidMeta = {
      ...validMeta,
      confidence: 'super-high',
    };
    expect(() => EnvelopeMetaSchema.parse(invalidMeta)).toThrow();
  });

  it('validates ESBReadingSchema non-negative constraints and tariffs', () => {
    const validESB = {
      readings: [
        {
          timestamp: '2025-07-15T00:00:00Z',
          import_kwh: 0.5,
          export_kwh: 0.1,
          tariff: 'night' as const,
        },
      ],
      summary: {
        totalImport_kwh: 0.5,
        totalExport_kwh: 0.1,
        days: 1,
      },
    };
    expect(() => ESBReadingSchema.parse(validESB)).not.toThrow();

    const negativeKwh = {
      ...validESB,
      readings: [
        {
          timestamp: '2025-07-15T00:00:00Z',
          import_kwh: -0.5,
          export_kwh: 0.1,
        },
      ],
    };
    expect(() => ESBReadingSchema.parse(negativeKwh)).toThrow();
  });

  it('validates BankStatementSchema structure', () => {
    const validBank = {
      currency: 'EUR',
      rows: [
        {
          date: '2025-07-01',
          description: 'Payment',
          amount: 50.0,
        },
      ],
      summary: {
        totalIn: 50.0,
        totalOut: 0,
        net: 50.0,
      },
    };
    expect(() => BankStatementSchema.parse(validBank)).not.toThrow();

    const invalidBank = {
      currency: 'EUR',
      rows: [
        {
          date: '2025-07-01',
          // missing description
          amount: 50.0,
        },
      ],
      summary: { totalIn: 50, totalOut: 0, net: 50 },
    };
    expect(() => BankStatementSchema.parse(invalidBank)).toThrow();
  });

  it('validates MerchantStatementSchema provider enum & currency literal', () => {
    const validMerchant = {
      meta: {
        provider: 'elavon' as const,
        statementPeriodStart: '2025-07-01',
        statementPeriodEnd: '2025-07-31',
        merchantId: '123',
        merchantName: 'Test',
        currency: 'EUR' as const,
        generatedAt: new Date().toISOString(),
      },
      summary: {
        totalVolume: 100,
        totalCount: 1,
        totalInterchange: 0.5,
        totalSchemeFees: 0.2,
        totalAcquirerFees: 0.3,
        totalFees: 1.0,
        netSettlement: 99.0,
      },
      lineItems: [
        {
          date: '2025-07-03',
          cardType: 'visa' as const,
          transactionType: 'sale' as const,
          volume: 100,
          count: 1,
          rate: 0.2,
          interchangeFee: 0.5,
          schemeFee: 0.2,
          acquirerFee: 0.3,
          totalFee: 1.0,
          netAmount: 99.0,
        },
      ],
    };
    expect(() => MerchantStatementSchema.parse(validMerchant)).not.toThrow();

    const invalidCurrency = {
      ...validMerchant,
      meta: {
        ...validMerchant.meta,
        currency: 'USD',
      },
    };
    expect(() => MerchantStatementSchema.parse(invalidCurrency)).toThrow();
  });
});
