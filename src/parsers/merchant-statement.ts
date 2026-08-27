import { registerParser } from '../core/registry.js';
import type { DocumentType } from '../core/types.js';
import { MerchantStatementSchema, type MerchantStatement } from '../schemas/merchant-statement.js';

function detect(content: string): boolean {
  const upper = content.toUpperCase();
  return (
    upper.includes('ELAVON') ||
    upper.includes('MERCHANT STATEMENT') ||
    upper.includes('MERCHANT SERVICES') ||
    upper.includes('ACQUIRER') ||
    (upper.includes('INTERCHANGE') &&
      upper.includes('SETTLEMENT') &&
      (upper.includes('VISA') || upper.includes('MASTERCARD')))
  );
}

// NOTE: parseLine was the Builder's first draft of the data-row regex — inline matching used instead below.

function parseMerchantStatement(content: string, _source?: string): Promise<unknown> {
  const lines = content.split('\n').filter((l) => l.trim().length > 0);

  // Extract header metadata
  let provider: MerchantStatement['meta']['provider'] = 'unknown';
  let statementPeriodStart = '';
  let statementPeriodEnd = '';
  let merchantId = '';
  let merchantName = '';
  let generatedAt = '';

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('elavon')) provider = 'elavon';
    if (lower.includes('worldpay')) provider = 'worldpay';
    if (lower.includes('aib merchant')) provider = 'aib-merchant-services';
    if (lower.includes('global payments')) provider = 'global-payments';

    const periodMatch = line.match(
      /statement period[:\s]+(\d{4}-\d{2}-\d{2})\s+(?:to|–|-)\s+(\d{4}-\d{2}-\d{2})/i,
    );
    if (periodMatch) {
      statementPeriodStart = periodMatch[1];
      statementPeriodEnd = periodMatch[2];
    }

    const merchantIdMatch = line.match(/merchant\s*(?:id|number)[:\s]+([A-Z0-9-]+)/i);
    if (merchantIdMatch) merchantId = merchantIdMatch[1];

    const merchantNameMatch = line.match(/merchant\s*name[:\s]+(.+)/i);
    if (merchantNameMatch) merchantName = merchantNameMatch[1].trim();

    const generatedMatch = line.match(/generated(?:\s*at|[:\s])[:\s]+(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2})/i);
    if (generatedMatch) generatedAt = generatedMatch[1];
  }

  // Parse line items
  const lineItems: MerchantStatement['lineItems'] = [];

  for (const line of lines) {
    // Try to match a data line: date cardType txnType volume count rate interchange scheme acquirer totalFee netAmount
    const match = line.match(
      /^(\d{4}-\d{2}-\d{2})\s+([\w-]+)\s+(\w+)\s+(-?[\d,.]+)\s+(\d+)\s+([\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)$/,
    );
    if (match) {
      const [
        , date, cardTypeRaw, txnTypeRaw, volumeRaw, countRaw, rateRaw, icRaw, sfRaw, afRaw, tfRaw, netRaw,
      ] = match;

      const cardType = normalizeCardType(cardTypeRaw);
      const transactionType = normalizeTxnType(txnTypeRaw);
      const volume = parseFloat(volumeRaw.replace(/,/g, ''));
      const count = parseInt(countRaw, 10);
      const rate = parseFloat(rateRaw);
      const interchangeFee = parseFloat(icRaw);
      const schemeFee = parseFloat(sfRaw);
      const acquirerFee = parseFloat(afRaw);
      const totalFee = parseFloat(tfRaw);
      const netAmount = parseFloat(netRaw);

      lineItems.push({
        date,
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
      });
    }
  }

  // Compute summary
  const totalVolume = round2(lineItems.reduce((s, li) => s + li.volume, 0));
  const totalCount = lineItems.reduce((s, li) => s + li.count, 0);
  const totalInterchange = round2(lineItems.reduce((s, li) => s + li.interchangeFee, 0));
  const totalSchemeFees = round2(lineItems.reduce((s, li) => s + li.schemeFee, 0));
  const totalAcquirerFees = round2(lineItems.reduce((s, li) => s + li.acquirerFee, 0));
  const totalFees = round2(lineItems.reduce((s, li) => s + li.totalFee, 0));
  const netSettlement = round2(lineItems.reduce((s, li) => s + li.netAmount, 0));

  const result: MerchantStatement = {
    meta: {
      provider,
      statementPeriodStart,
      statementPeriodEnd,
      merchantId,
      merchantName,
      currency: 'EUR',
      generatedAt,
    },
    summary: {
      totalVolume,
      totalCount,
      totalInterchange,
      totalSchemeFees,
      totalAcquirerFees,
      totalFees,
      netSettlement,
    },
    lineItems,
  };

  return Promise.resolve(MerchantStatementSchema.parse(result));
}

function normalizeCardType(raw: string): MerchantStatement['lineItems'][number]['cardType'] {
  const lower = raw.toLowerCase().replace(/\s+/g, '-');
  if (lower === 'visa') return 'visa';
  if (lower === 'mastercard' || lower === 'mc') return 'mastercard';
  if (lower === 'amex' || lower === 'american-express') return 'amex';
  if (lower === 'visa-debit') return 'visa-debit';
  if (lower === 'mastercard-debit' || lower === 'mc-debit') return 'mastercard-debit';
  return 'unknown';
}

function normalizeTxnType(raw: string): MerchantStatement['lineItems'][number]['transactionType'] {
  const lower = raw.toLowerCase();
  if (lower === 'sale') return 'sale';
  if (lower === 'refund') return 'refund';
  if (lower === 'chargeback' || lower === 'cbk') return 'chargeback';
  if (lower === 'reversal') return 'reversal';
  return 'other';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function register(): void {
  registerParser('merchant-statement' as DocumentType, {
    detect,
    parse: parseMerchantStatement,
    schema: MerchantStatementSchema,
  });
}

// Self-register on import (dogfood the API)
register();