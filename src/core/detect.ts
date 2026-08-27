import type { DocumentType } from './types.js';
import { getParser, getRegisteredTypes } from './registry.js';

const checks: { type: DocumentType; test: (content: string) => boolean }[] = [
  {
    type: 'merchant-statement',
    test: (content: string) => {
      const upper = content.toUpperCase();
      return (
        upper.includes('ELAVON') ||
        upper.includes('MERCHANT STATEMENT') ||
        upper.includes('MERCHANT SERVICES') ||
        upper.includes('ACQUIRER') ||
        // Elavon-style: has card scheme + interchange + settlement language
        (upper.includes('INTERCHANGE') &&
          upper.includes('SETTLEMENT') &&
          (upper.includes('VISA') || upper.includes('MASTERCARD')))
      );
    },
  },
  {
    type: 'bank-csv',
    test: (content: string) => {
      // CSV with bank-style columns: date, description, amount (and optionally balance)
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
    },
  },
  {
    type: 'esb-meter',
    test: (content: string) => {
      const headerLine = content.split('\n').find((l) => l.trim().length > 0);
      if (!headerLine) return false;
      const headers = headerLine
        .toLowerCase()
        .split(/[,\t]/)
        .map((h) => h.trim());
      const hasTimestamp =
        headers.some((h) => h === 'timestamp' || h === 'reading_time' || h === 'date_time');
      const hasImport =
        headers.some((h) => h === 'import_kwh' || h === 'import' || h === 'kwh_import');
      const hasMprn = headers.some((h) => h === 'mprn');
      return hasTimestamp && (hasImport || hasMprn);
    },
  },
];

export function detectType(content: string): DocumentType {
  // First try registered parsers' own detect functions
  for (const type of getRegisteredTypes()) {
    const parser = getParser(type);
    if (parser?.detect(content)) {
      return type;
    }
  }

  // Fallback to built-in checks
  const tried: string[] = [];
  for (const check of checks) {
    tried.push(check.type);
    if (check.test(content)) {
      return check.type;
    }
  }

  throw new Error(
    `Could not detect document type. Checks tried: ${tried.join(', ')}. ` +
      'Provide a --type flag or register a custom parser.',
  );
}