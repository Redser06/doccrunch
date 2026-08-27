import { z } from 'zod';

export const MerchantStatementSchema = z.object({
  meta: z.object({
    provider: z.enum([
      'elavon',
      'worldpay',
      'aib-merchant-services',
      'global-payments',
      'unknown',
    ]),
    statementPeriodStart: z.string(),
    statementPeriodEnd: z.string(),
    merchantId: z.string(),
    merchantName: z.string(),
    currency: z.literal('EUR').default('EUR'),
    generatedAt: z.string(),
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
      cardType: z.enum([
        'visa',
        'mastercard',
        'amex',
        'visa-debit',
        'mastercard-debit',
        'unknown',
      ]),
      transactionType: z.enum(['sale', 'refund', 'chargeback', 'reversal', 'other']),
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

export type MerchantStatement = z.infer<typeof MerchantStatementSchema>;