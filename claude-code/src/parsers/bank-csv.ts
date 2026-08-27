import { parse as parseCsv } from 'csv-parse/sync';
import { registerParser } from '../core/registry.js';
import type { ParserInput } from '../core/types.js';
import { bankStatementSchema, type BankRow, type BankStatement } from '../schemas/bank-csv.js';
import { headerLine, parseNumber, pick, round2, sum, toIsoDate } from './util.js';

export const BANK_CSV_VERSION = '0.1.0';
export const BANK_CSV_TYPE = 'bank-csv';

const DETECT_CHECKS = ['CSV header includes Date, Description and Amount columns'];

const CURRENCY_SYMBOLS: Record<string, string> = { '€': 'EUR', '$': 'USD', '£': 'GBP' };
const DEFAULT_CURRENCY = 'EUR';

export function detectBankCsv(input: ParserInput): boolean {
  const header = headerLine(input.text).toLowerCase();
  if (!header.includes(',')) return false;
  const columns = header.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  return ['date', 'description', 'amount'].every((needed) =>
    columns.some((c) => c === needed || c.startsWith(needed)),
  );
}

type Row = Record<string, string | undefined>;

function readCsv(text: string): Row[] {
  const rows = parseCsv(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as Row[];
  if (rows.length === 0) throw new Error('Bank CSV contained a header but no data rows.');
  return rows;
}

function detectCurrency(rows: Row[], text: string): string {
  const stated = rows.map((r) => pick(r, 'currency', 'ccy')).find(Boolean);
  if (stated) return stated.toUpperCase();
  const rawAmount = rows.map((r) => pick(r, 'amount', 'value')).find(Boolean) ?? '';
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (rawAmount.includes(symbol) || text.includes(symbol)) return code;
  }
  return DEFAULT_CURRENCY;
}

export function parseBankCsv(input: ParserInput): BankStatement {
  const raw = readCsv(input.text);

  const rows: BankRow[] = raw.map((r, i) => {
    const date = pick(r, 'date', 'transaction date', 'posted date', 'value date');
    const description = pick(r, 'description', 'details', 'narrative', 'reference');
    const amount = pick(r, 'amount', 'value');
    const balance = pick(r, 'balance', 'running balance');
    const category = pick(r, 'category', 'type');

    if (!date) throw new Error(`Row ${i + 1}: missing Date`);
    if (amount === undefined) throw new Error(`Row ${i + 1}: missing Amount`);

    return {
      date: toIsoDate(date, `row ${i + 1} date`),
      description: description ?? '',
      amount: round2(parseNumber(amount, `row ${i + 1} amount`)),
      ...(balance !== undefined
        ? { balance: round2(parseNumber(balance, `row ${i + 1} balance`)) }
        : {}),
      ...(category !== undefined ? { category } : {}),
    };
  });

  const account = raw.map((r) => pick(r, 'account', 'account number', 'iban')).find(Boolean);

  // totalOut is the magnitude of debits, so net = totalIn - totalOut.
  const totalIn = sum(rows.filter((r) => r.amount > 0).map((r) => r.amount));
  const totalOut = round2(Math.abs(sum(rows.filter((r) => r.amount < 0).map((r) => r.amount))));

  return {
    ...(account ? { account } : {}),
    currency: detectCurrency(raw, input.text),
    rows,
    summary: { totalIn, totalOut, net: round2(totalIn - totalOut) },
  };
}

/** Warn when the statement's own balance column disagrees with the row amounts. */
export function balanceWarnings(payload: BankStatement): string[] {
  const withBalance = payload.rows.filter((r) => r.balance !== undefined);
  if (withBalance.length < 2) return [];

  const first = withBalance[0]!;
  const last = withBalance[withBalance.length - 1]!;
  const movement = round2(
    payload.rows
      .slice(payload.rows.indexOf(first) + 1)
      .reduce((acc, r) => acc + r.amount, 0),
  );
  const expected = round2(first.balance! + movement);
  if (Math.abs(expected - last.balance!) > 0.01) {
    return [
      `balance column does not reconcile: ${first.balance} + movements ${movement} = ${expected}, but the last row reports ${last.balance}`,
    ];
  }
  return [];
}

registerParser<BankStatement>(BANK_CSV_TYPE, {
  detect: detectBankCsv,
  parse: parseBankCsv,
  schema: bankStatementSchema,
  version: BANK_CSV_VERSION,
  checks: DETECT_CHECKS,
  confidence: (payload) => (balanceWarnings(payload).length ? 'medium' : 'high'),
  warnings: (payload) => balanceWarnings(payload),
});
