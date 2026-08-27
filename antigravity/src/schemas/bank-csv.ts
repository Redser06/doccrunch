import { z } from 'zod';

export const BankRowSchema = z.object({
  date: z.string(),          // ISO date
  description: z.string(),
  amount: z.number(),        // + credit / - debit
  balance: z.number().optional(),
  category: z.string().optional(),
});

export const BankSummarySchema = z.object({
  totalIn: z.number(),
  totalOut: z.number(),
  net: z.number(),
});

export const BankStatementSchema = z.object({
  account: z.string().optional(),
  currency: z.string(),
  rows: z.array(BankRowSchema),
  summary: BankSummarySchema,
});

export type BankStatement = z.infer<typeof BankStatementSchema>;
export type BankRow = z.infer<typeof BankRowSchema>;
export type BankSummary = z.infer<typeof BankSummarySchema>;
