import { z } from 'zod';

export const cardTypeSchema = z.enum([
  'visa',
  'mastercard',
  'amex',
  'visa-debit',
  'mastercard-debit',
  'unknown',
]);

export const transactionTypeSchema = z.enum([
  'sale',
  'refund',
  'chargeback',
  'reversal',
  'other',
]);

export const merchantStatementSchema = z.object({
  meta: z.object({
    provider: z.enum([
      'elavon',
      'worldpay',
      'aib-merchant-services',
      'global-payments',
      'unknown',
    ]),
    statementPeriodStart: z.string(), // ISO date
    statementPeriodEnd: z.string(),
    merchantId: z.string(),
    merchantName: z.string(),
    currency: z.literal('EUR'),
    generatedAt: z.string(), // ISO datetime
  }),
  summary: z.object({
    totalVolume: z.number(),
    totalCount: z.number().int(),
    totalInterchange: z.number(),
    totalSchemeFees: z.number(),
    totalAcquirerFees: z.number(),
    totalFees: z.number(),
    netSettlement: z.number(),
  }),
  lineItems: z.array(
    z.object({
      date: z.string(),
      cardType: cardTypeSchema,
      transactionType: transactionTypeSchema,
      volume: z.number(),
      count: z.number().int(),
      rate: z.number(),
      interchangeFee: z.number(),
      schemeFee: z.number(),
      acquirerFee: z.number(),
      totalFee: z.number(),
      netAmount: z.number(),
    }),
  ),
});

export type MerchantStatement = z.infer<typeof merchantStatementSchema>;
export type MerchantLineItem = MerchantStatement['lineItems'][number];
