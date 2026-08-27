import { registerParser } from '../core/registry.js';
import type { ParserInput } from '../core/types.js';
import {
  merchantStatementSchema,
  type MerchantLineItem,
  type MerchantStatement,
} from '../schemas/merchant-statement.js';
import { firstMatch, parseNumber, round2, sum, toIsoDate } from './util.js';

export const MERCHANT_STATEMENT_VERSION = '0.1.0';
export const MERCHANT_STATEMENT_TYPE = 'merchant-statement';

const DETECT_CHECKS = [
  'text contains "ELAVON MERCHANT SERVICES"',
  'text contains "Merchant Statement"',
];

export function detectMerchantStatement(input: ParserInput): boolean {
  const text = input.text;
  return /ELAVON MERCHANT SERVICES/i.test(text) || /Merchant Statement/i.test(text);
}

const PROVIDERS: Array<[RegExp, MerchantStatement['meta']['provider']]> = [
  [/elavon/i, 'elavon'],
  [/worldpay/i, 'worldpay'],
  [/aib merchant services/i, 'aib-merchant-services'],
  [/global payments/i, 'global-payments'],
];

function detectProvider(text: string): MerchantStatement['meta']['provider'] {
  for (const [re, provider] of PROVIDERS) if (re.test(text)) return provider;
  return 'unknown';
}

function normalizeCardType(raw: string): MerchantLineItem['cardType'] {
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (/^visa (debit|dr)$/.test(s) || s === 'visa-debit') return 'visa-debit';
  if (/^(mastercard|mc) (debit|dr)$/.test(s) || s === 'mastercard-debit') return 'mastercard-debit';
  if (/^visa/.test(s)) return 'visa';
  if (/^(mastercard|mc)/.test(s)) return 'mastercard';
  if (/^(amex|american express)/.test(s)) return 'amex';
  return 'unknown';
}

function normalizeTransactionType(raw: string): MerchantLineItem['transactionType'] {
  const s = raw.trim().toLowerCase();
  if (/^(sale|purchase|payment)$/.test(s)) return 'sale';
  if (/^(refund|credit)$/.test(s)) return 'refund';
  if (/^charge ?back$/.test(s)) return 'chargeback';
  if (/^reversal$/.test(s)) return 'reversal';
  return 'other';
}

const NUMERIC_COLUMNS = 8; // volume count rate interchange scheme acquirer totalFee net
const ROW_START = /^(\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{4})\s+(.*)$/;

/**
 * A statement row is: date, card type (1-2 words), transaction type, then eight
 * numbers. Anchoring on the date and the trailing numbers survives the variable
 * column padding that PDF text extraction produces.
 */
function parseLineItem(line: string): MerchantLineItem | undefined {
  const start = ROW_START.exec(line.trim());
  if (!start) return undefined;

  const tokens = start[2]!.trim().split(/\s+/);
  if (tokens.length < NUMERIC_COLUMNS + 2) return undefined;

  const numeric = tokens.slice(-NUMERIC_COLUMNS);
  if (!numeric.every((t) => /^-?[\d.,]+$/.test(t))) return undefined;

  const labels = tokens.slice(0, -NUMERIC_COLUMNS);
  const transactionType = normalizeTransactionType(labels[labels.length - 1]!);
  const cardType = normalizeCardType(labels.slice(0, -1).join(' '));

  const [volume, count, rate, interchangeFee, schemeFee, acquirerFee, totalFee, netAmount] =
    numeric.map((t, i) => parseNumber(t, `column ${i + 1}`)) as [
      number, number, number, number, number, number, number, number,
    ];

  return {
    date: toIsoDate(start[1]!),
    cardType,
    transactionType,
    volume,
    count,
    rate,
    interchangeFee,
    schemeFee,
    acquirerFee,
    totalFee,
    netAmount,
  };
}

function labelledNumber(text: string, label: string): number | undefined {
  const re = new RegExp(`^\\s*${label}\\s*:?\\s*(-?[\\d.,()€]+)\\s*$`, 'im');
  const m = re.exec(text);
  return m ? parseNumber(m[1]!, label) : undefined;
}

/** Totals computed from the line items — the fallback when the doc omits a SUMMARY. */
export function computeSummary(lineItems: MerchantLineItem[]): MerchantStatement['summary'] {
  const totalVolume = sum(lineItems.map((l) => l.volume));
  const totalFees = sum(lineItems.map((l) => l.totalFee));
  return {
    totalVolume,
    totalCount: lineItems.reduce((a, l) => a + l.count, 0),
    totalInterchange: sum(lineItems.map((l) => l.interchangeFee)),
    totalSchemeFees: sum(lineItems.map((l) => l.schemeFee)),
    totalAcquirerFees: sum(lineItems.map((l) => l.acquirerFee)),
    totalFees,
    netSettlement: round2(totalVolume - totalFees),
  };
}

export function parseMerchantStatement(input: ParserInput): MerchantStatement {
  const text = input.text;
  const lines = text.split(/\r?\n/);

  const lineItems: MerchantLineItem[] = [];
  for (const line of lines) {
    const item = parseLineItem(line);
    if (item) lineItems.push(item);
  }
  if (lineItems.length === 0) {
    throw new Error(
      'No transaction rows found. Expected rows like "2025-07-03  Visa  Sale  1250.00  12  0.20  ..." under TRANSACTION DETAILS.',
    );
  }

  const period =
    /Statement Period\s*:?\s*(.+?)\s*(?:-|–|to)\s*(.+?)\s*$/im.exec(text) ??
    /Period\s*:?\s*(.+?)\s*(?:-|–|to)\s*(.+?)\s*$/im.exec(text);
  if (!period) {
    throw new Error('Could not find a "Statement Period: <start> - <end>" line.');
  }

  const merchantId = firstMatch(text, [/Merchant\s*(?:ID|Number|No\.?)\s*:?\s*(\S+)/i]);
  const merchantName = firstMatch(text, [/Merchant\s*Name\s*:?\s*(.+?)\s*$/im]);
  if (!merchantId) throw new Error('Could not find a "Merchant ID:" line.');
  if (!merchantName) throw new Error('Could not find a "Merchant Name:" line.');

  const computed = computeSummary(lineItems);
  const stated = {
    totalVolume: labelledNumber(text, 'Total Volume'),
    totalCount: labelledNumber(text, 'Total Count'),
    totalInterchange: labelledNumber(text, 'Total Interchange'),
    totalSchemeFees: labelledNumber(text, 'Total Scheme Fees'),
    totalAcquirerFees: labelledNumber(text, 'Total Acquirer Fees'),
    totalFees: labelledNumber(text, 'Total Fees'),
    netSettlement: labelledNumber(text, 'Net Settlement'),
  };

  // The document's own SUMMARY wins where present; line items fill any gaps.
  const summary: MerchantStatement['summary'] = {
    totalVolume: stated.totalVolume ?? computed.totalVolume,
    totalCount: stated.totalCount ?? computed.totalCount,
    totalInterchange: stated.totalInterchange ?? computed.totalInterchange,
    totalSchemeFees: stated.totalSchemeFees ?? computed.totalSchemeFees,
    totalAcquirerFees: stated.totalAcquirerFees ?? computed.totalAcquirerFees,
    totalFees: stated.totalFees ?? computed.totalFees,
    netSettlement: stated.netSettlement ?? computed.netSettlement,
  };

  return {
    meta: {
      provider: detectProvider(text),
      statementPeriodStart: toIsoDate(period[1]!, 'statement period start'),
      statementPeriodEnd: toIsoDate(period[2]!, 'statement period end'),
      merchantId,
      merchantName,
      currency: 'EUR',
      generatedAt: new Date().toISOString(),
    },
    summary,
    lineItems,
  };
}

/** Flag any stated total that disagrees with the line items by more than a cent. */
export function summaryWarnings(payload: MerchantStatement): string[] {
  const computed = computeSummary(payload.lineItems);
  const warnings: string[] = [];
  for (const key of Object.keys(computed) as Array<keyof typeof computed>) {
    const stated = payload.summary[key];
    if (Math.abs(stated - computed[key]) > 0.01) {
      warnings.push(
        `summary.${key}: statement says ${stated}, line items compute ${computed[key]}`,
      );
    }
  }
  return warnings;
}

registerParser<MerchantStatement>(MERCHANT_STATEMENT_TYPE, {
  detect: detectMerchantStatement,
  parse: parseMerchantStatement,
  schema: merchantStatementSchema,
  version: MERCHANT_STATEMENT_VERSION,
  checks: DETECT_CHECKS,
  // Stated totals that don't reconcile downgrade confidence rather than failing.
  confidence: (payload) => (summaryWarnings(payload).length ? 'medium' : 'high'),
  warnings: (payload) => summaryWarnings(payload),
});
