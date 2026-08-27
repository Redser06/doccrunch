import { z } from 'zod';

export const bankStatementSchema = z.object({
  account: z.string().optional(),
  currency: z.string(),
  rows: z.array(
    z.object({
      date: z.string(), // ISO date
      description: z.string(),
      amount: z.number(), // + credit / - debit
      balance: z.number().optional(),
      category: z.string().optional(),
    }),
  ),
  summary: z.object({
    totalIn: z.number(),
    totalOut: z.number(),
    net: z.number(),
  }),
});

export type BankStatement = z.infer<typeof bankStatementSchema>;
export type BankRow = BankStatement['rows'][number];
