import { parse as csvParse } from 'csv-parse';
import { registerParser } from '../core/registry.js';
import type { DocumentType } from '../core/types.js';
import { BankCsvSchema, type BankStatement } from '../schemas/bank-csv.js';

function detect(content: string): boolean {
  const headerLine = content.split('\n').find((l) => l.trim().length > 0);
  if (!headerLine) return false;
  const headers = headerLine
    .toLowerCase()
    .split(/[,\t]/)
    .map((h) => h.trim());
  const hasDate = headers.some((h) => h === 'date' || h === 'transaction date');
  const hasDescription = headers.some(
    (h) => h === 'description' || h === 'details' || h === 'narrative',
  );
  const hasAmount =
    headers.some((h) => h === 'amount' || h === 'value') ||
    (headers.some((h) => h === 'debit') && headers.some((h) => h === 'credit'));
  return hasDate && hasDescription && hasAmount;
}

function parseBankCsv(content: string, _source?: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    csvParse(
      content,
      { columns: true, trim: true, skip_empty_lines: true },
      (err, records: Record<string, string>[]) => {
        if (err) {
          reject(err);
          return;
        }

        const rows: BankStatement['rows'] = records.map((r) => {
          // Normalize header keys
          const get = (keys: string[]): string | undefined => {
            for (const k of keys) {
              const found = Object.keys(r).find(
                (rk) => rk.toLowerCase().trim() === k,
              );
              if (found) return r[found];
            }
            return undefined;
          };

          const date = get(['date', 'transaction date']) ?? '';
          const description = get(['description', 'details', 'narrative']) ?? '';
          const balance = get(['balance', 'running balance']);
          const category = get(['category']);

          // Handle amount: either "amount" column or debit/credit columns
          const amountStr = get(['amount', 'value']);
          let amount: number;
          if (amountStr !== undefined) {
            amount = parseFloat(amountStr.replace(/[€,\s]/g, ''));
          } else {
            const debit = get(['debit']);
            const credit = get(['credit']);
            if (debit && parseFloat(debit.replace(/[€,\s]/g, '')) !== 0) {
              amount = -parseFloat(debit.replace(/[€,\s]/g, ''));
            } else if (credit) {
              amount = parseFloat(credit.replace(/[€,\s]/g, ''));
            } else {
              amount = 0;
            }
          }

          return {
            date,
            description,
            amount,
            balance: balance !== undefined ? parseFloat(balance.replace(/[€,\s]/g, '')) : undefined,
            category: category ?? undefined,
          };
        });

        const totalIn = round2(
          rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0),
        );
        const totalOut = round2(
          Math.abs(
            rows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0),
          ),
        );
        const net = round2(rows.reduce((s, r) => s + r.amount, 0));

        const result: BankStatement = {
          account: undefined,
          currency: 'EUR',
          rows,
          summary: { totalIn, totalOut, net },
        };

        resolve(BankCsvSchema.parse(result));
      },
    );
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function register(): void {
  registerParser('bank-csv' as DocumentType, {
    detect,
    parse: parseBankCsv,
    schema: BankCsvSchema,
  });
}

// Self-register on import (dogfood the API)
register();