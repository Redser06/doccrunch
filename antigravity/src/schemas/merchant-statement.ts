import { z } from 'zod';

export const MerchantStatementMetaSchema = z.object({
  provider: z.enum(['elavon', 'worldpay', 'aib-merchant-services', 'global-payments', 'unknown']),
  statementPeriodStart: z.string(), // ISO date
  statementPeriodEnd: z.string(),   // ISO date
  merchantId: z.string(),
  merchantName: z.string(),
  currency: z.literal('EUR'),
  generatedAt: z.string(),          // ISO datetime
});

export const MerchantStatementSummarySchema = z.object({
  totalVolume: z.number(),
  totalCount: z.number().int(),
  totalInterchange: z.number(),
  totalSchemeFees: z.number(),
  totalAcquirerFees: z.number(),
  totalFees: z.number(),
  netSettlement: z.number(),
});

export const MerchantStatementLineItemSchema = z.object({
  date: z.string(),
  cardType: z.enum(['visa', 'mastercard', 'amex', 'visa-debit', 'mastercard-debit', 'unknown']),
  transactionType: z.enum(['sale', 'refund', 'chargeback', 'reversal', 'other']),
  volume: z.number(),
  count: z.number().int(),
  rate: z.number(),
  interchangeFee: z.number(),
  schemeFee: z.number(),
  acquirerFee: z.number(),
  totalFee: z.number(),
  netAmount: z.number(),
});

export const MerchantStatementSchema = z.object({
  meta: MerchantStatementMetaSchema,
  summary: MerchantStatementSummarySchema,
  lineItems: z.array(MerchantStatementLineItemSchema),
});

export type MerchantStatement = z.infer<typeof MerchantStatementSchema>;
export type MerchantStatementMeta = z.infer<typeof MerchantStatementMetaSchema>;
export type MerchantStatementSummary = z.infer<typeof MerchantStatementSummarySchema>;
export type MerchantStatementLineItem = z.infer<typeof MerchantStatementLineItemSchema>;
