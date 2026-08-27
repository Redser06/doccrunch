import { ParserPlugin, ParseContext } from '../core/types.js';
import {
  MerchantStatement,
  MerchantStatementSchema,
  MerchantStatementLineItem,
} from '../schemas/merchant-statement.js';

function parseDateToIso(dateStr: string): string {
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle formats like "01 July 2025", "1 Jul 2025"
  const monthMap: Record<string, string> = {
    january: '01', jan: '01',
    february: '02', feb: '02',
    march: '03', mar: '03',
    april: '04', apr: '04',
    may: '05',
    june: '06', jun: '06',
    july: '07', jul: '07',
    august: '08', aug: '08',
    september: '09', sep: '09', sept: '09',
    october: '10', oct: '10',
    november: '11', nov: '11',
    december: '12', dec: '12',
  };

  const match = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const monthName = match[2].toLowerCase();
    const month = monthMap[monthName] || '01';
    const year = match[3];
    return `${year}-${month}-${day}`;
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return trimmed;
}

function normalizeCardType(
  raw: string
): 'visa' | 'mastercard' | 'amex' | 'visa-debit' | 'mastercard-debit' | 'unknown' {
  const s = raw.trim().toLowerCase();
  if (s === 'visa debit') return 'visa-debit';
  if (s === 'mastercard debit') return 'mastercard-debit';
  if (s === 'visa') return 'visa';
  if (s === 'mastercard' || s === 'mc') return 'mastercard';
  if (s === 'amex' || s === 'american express') return 'amex';
  return 'unknown';
}

function normalizeTransactionType(
  raw: string
): 'sale' | 'refund' | 'chargeback' | 'reversal' | 'other' {
  const s = raw.trim().toLowerCase();
  if (s === 'sale') return 'sale';
  if (s === 'refund') return 'refund';
  if (s === 'chargeback') return 'chargeback';
  if (s === 'reversal') return 'reversal';
  return 'other';
}

function parseNumber(raw: string | number | undefined): number {
  if (typeof raw === 'number') return raw;
  if (!raw) return 0;
  const cleaned = String(raw).replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Number(n.toFixed(2));
}

export const merchantStatementParser: ParserPlugin<MerchantStatement> = {
  name: 'merchant-statement',
  version: 'merchant-statement@0.1.0',
  detect(content: string): boolean {
    return (
      content.includes('ELAVON MERCHANT SERVICES') ||
      content.includes('Merchant Statement')
    );
  },
  parse(content: string, _context: ParseContext): MerchantStatement {
    let provider: 'elavon' | 'worldpay' | 'aib-merchant-services' | 'global-payments' | 'unknown' =
      'unknown';
    const upperContent = content.toUpperCase();
    if (upperContent.includes('ELAVON')) {
      provider = 'elavon';
    } else if (upperContent.includes('WORLDPAY')) {
      provider = 'worldpay';
    } else if (upperContent.includes('AIB MERCHANT')) {
      provider = 'aib-merchant-services';
    } else if (upperContent.includes('GLOBAL PAYMENTS')) {
      provider = 'global-payments';
    }

    let merchantId = '';
    let merchantName = '';
    let statementPeriodStart = '';
    let statementPeriodEnd = '';

    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      const mIdMatch = trimmed.match(/Merchant ID:\s*(.+)$/i);
      if (mIdMatch) {
        merchantId = mIdMatch[1].trim();
      }

      const mNameMatch = trimmed.match(/Merchant Name:\s*(.+)$/i);
      if (mNameMatch) {
        merchantName = mNameMatch[1].trim();
      }

      const mPeriodMatch = trimmed.match(
        /Statement Period:\s*([0-9A-Za-z\s-]+?)\s*-\s*([0-9A-Za-z\s-]+)$/i
      );
      if (mPeriodMatch) {
        statementPeriodStart = parseDateToIso(mPeriodMatch[1]);
        statementPeriodEnd = parseDateToIso(mPeriodMatch[2]);
      }
    }

    // Parse Line Items & Summary
    const lineItems: MerchantStatementLineItem[] = [];
    let inTable = false;
    let inSummary = false;

    let summaryVolume: number | null = null;
    let summaryCount: number | null = null;
    let summaryInterchange: number | null = null;
    let summaryScheme: number | null = null;
    let summaryAcquirer: number | null = null;
    let summaryFees: number | null = null;
    let summaryNet: number | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (/^TRANSACTION DETAILS/i.test(line)) {
        inTable = true;
        inSummary = false;
        continue;
      }

      if (/^SUMMARY/i.test(line)) {
        inTable = false;
        inSummary = true;
        continue;
      }

      if (inSummary) {
        const volMatch = line.match(/Total Volume:\s*([-\d.,]+)/i);
        if (volMatch) summaryVolume = parseNumber(volMatch[1]);

        const countMatch = line.match(/Total Count:\s*(\d+)/i);
        if (countMatch) summaryCount = parseInt(countMatch[1], 10);

        const interMatch = line.match(/Total Interchange:\s*([-\d.,]+)/i);
        if (interMatch) summaryInterchange = parseNumber(interMatch[1]);

        const schemeMatch = line.match(/Total Scheme Fees:\s*([-\d.,]+)/i);
        if (schemeMatch) summaryScheme = parseNumber(schemeMatch[1]);

        const acqMatch = line.match(/Total Acquirer Fees:\s*([-\d.,]+)/i);
        if (acqMatch) summaryAcquirer = parseNumber(acqMatch[1]);

        const feesMatch = line.match(/Total Fees:\s*([-\d.,]+)/i);
        if (feesMatch) summaryFees = parseNumber(feesMatch[1]);

        const netMatch = line.match(/Net Settlement:\s*([-\d.,]+)/i);
        if (netMatch) summaryNet = parseNumber(netMatch[1]);

        continue;
      }

      if (inTable) {
        if (/^Date\s+Card Type/i.test(line)) {
          // Table header line
          continue;
        }

        // Table row format:
        // Date (YYYY-MM-DD)  CardType (e.g. Visa, Visa Debit)  Type (Sale, Refund)  Volume  Count  Rate  Interchange  SchemeFee  AcquirerFee  TotalFee  NetAmount
        // Match regex: starts with date \d{4}-\d{2}-\d{2}
        const dateMatch = line.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
        if (dateMatch) {
          const date = dateMatch[1];
          const rest = dateMatch[2].trim();

          // Tokens from rest
          // The last 8 items are numbers: Volume, Count, Rate, Interchange, Scheme Fee, Acquirer Fee, Total Fee, Net Amount
          // Everything before that is Card Type and Type
          const parts = rest.split(/\s+/);
          if (parts.length >= 9) {
            const netAmount = parseNumber(parts[parts.length - 1]);
            const totalFee = parseNumber(parts[parts.length - 2]);
            const acquirerFee = parseNumber(parts[parts.length - 3]);
            const schemeFee = parseNumber(parts[parts.length - 4]);
            const interchangeFee = parseNumber(parts[parts.length - 5]);
            const rate = parseNumber(parts[parts.length - 6]);
            const count = parseInt(parts[parts.length - 7], 10);
            const volume = parseNumber(parts[parts.length - 8]);

            // The remaining tokens are Card Type + Transaction Type
            const frontParts = parts.slice(0, parts.length - 8);
            const transactionTypeRaw = frontParts[frontParts.length - 1];
            const cardTypeRaw = frontParts.slice(0, frontParts.length - 1).join(' ');

            const lineItem: MerchantStatementLineItem = {
              date,
              cardType: normalizeCardType(cardTypeRaw),
              transactionType: normalizeTransactionType(transactionTypeRaw),
              volume,
              count,
              rate,
              interchangeFee,
              schemeFee,
              acquirerFee,
              totalFee,
              netAmount,
            };

            lineItems.push(lineItem);
          }
        }
      }
    }

    // Build summary
    const totalVolume =
      summaryVolume !== null
        ? summaryVolume
        : Number(lineItems.reduce((acc, item) => acc + item.volume, 0).toFixed(2));
    const totalCount =
      summaryCount !== null
        ? summaryCount
        : lineItems.reduce((acc, item) => acc + item.count, 0);
    const totalInterchange =
      summaryInterchange !== null
        ? summaryInterchange
        : Number(lineItems.reduce((acc, item) => acc + item.interchangeFee, 0).toFixed(2));
    const totalSchemeFees =
      summaryScheme !== null
        ? summaryScheme
        : Number(lineItems.reduce((acc, item) => acc + item.schemeFee, 0).toFixed(2));
    const totalAcquirerFees =
      summaryAcquirer !== null
        ? summaryAcquirer
        : Number(lineItems.reduce((acc, item) => acc + item.acquirerFee, 0).toFixed(2));
    const totalFees =
      summaryFees !== null
        ? summaryFees
        : Number(lineItems.reduce((acc, item) => acc + item.totalFee, 0).toFixed(2));
    const netSettlement =
      summaryNet !== null
        ? summaryNet
        : Number(lineItems.reduce((acc, item) => acc + item.netAmount, 0).toFixed(2));

    const result: MerchantStatement = {
      meta: {
        provider,
        statementPeriodStart,
        statementPeriodEnd,
        merchantId,
        merchantName,
        currency: 'EUR',
        generatedAt: new Date().toISOString(),
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

    return MerchantStatementSchema.parse(result);
  },
  schema: MerchantStatementSchema,
};
