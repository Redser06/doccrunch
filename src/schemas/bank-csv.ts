import { z } from 'zod';

export const BankCsvSchema = z.object({
  account: z.string().optional(),
  currency: z.string().default('EUR'),
  rows: z.array(
    z.object({
      date: z.string(),
      description: z.string(),
      amount: z.number(),
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

export type BankStatement = z.infer<typeof BankCsvSchema>;