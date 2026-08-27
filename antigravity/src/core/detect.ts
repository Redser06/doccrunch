import { getAllParsers } from './registry.js';
import { ConfidenceLevel, ParserPlugin } from './types.js';

export interface DetectResult {
  type: string;
  confidence: ConfidenceLevel;
}

function ensureDefaultDetectors(): void {
  const parsers = getAllParsers();
  if (parsers.size === 0) {
    if (!parsers.has('merchant-statement')) {
      parsers.set('merchant-statement', {
        name: 'merchant-statement',
        version: 'merchant-statement@0.1.0',
        detect: (content: string) =>
          content.includes('ELAVON MERCHANT SERVICES') ||
          content.includes('Merchant Statement'),
        parse: () => {
          throw new Error('Parser not initialized');
        },
        schema: null as any,
      });
    }
    if (!parsers.has('bank-csv')) {
      parsers.set('bank-csv', {
        name: 'bank-csv',
        version: 'bank-csv@0.1.0',
        detect: (content: string) => {
          const firstLine = content.split(/\r?\n/)[0] || '';
          const normalized = firstLine.toLowerCase().replace(/\s+/g, '');
          return (
            normalized.includes('date') &&
            normalized.includes('description') &&
            normalized.includes('amount')
          );
        },
        parse: () => {
          throw new Error('Parser not initialized');
        },
        schema: null as any,
      });
    }
    if (!parsers.has('esb-meter')) {
      parsers.set('esb-meter', {
        name: 'esb-meter',
        version: 'esb-meter@0.1.0',
        detect: (content: string) => {
          const firstLine = content.split(/\r?\n/)[0] || '';
          const normalized = firstLine.toLowerCase();
          return (
            normalized.includes('mprn') ||
            (normalized.includes('kwh') && normalized.includes('timestamp'))
          );
        },
        parse: () => {
          throw new Error('Parser not initialized');
        },
        schema: null as any,
      });
    }
  }
}

export function detectType(content: string, filename?: string): string {
  const result = detectTypeWithConfidence(content, filename);
  return result.type;
}

export function detectTypeWithConfidence(
  content: string,
  filename?: string
): DetectResult {
  if (typeof content !== 'string') {
    throw new Error('detectType requires string content');
  }

  ensureDefaultDetectors();

  const parsers = getAllParsers();
  const checksTried: string[] = [];

  for (const [type, plugin] of parsers.entries()) {
    checksTried.push(
      type === 'merchant-statement'
        ? `merchant-statement (looking for "ELAVON MERCHANT SERVICES" or "Merchant Statement")`
        : type === 'bank-csv'
          ? `bank-csv (looking for CSV header with "Date,Description,Amount")`
          : type === 'esb-meter'
            ? `esb-meter (looking for CSV header with "MPRN" or "kWh" + "Timestamp")`
            : `${type} (plugin detector)`
    );

    try {
      const res = plugin.detect(content, filename);
      if (typeof res === 'boolean' && res) {
        return { type, confidence: 'high' };
      } else if (typeof res === 'object' && res !== null && res.match) {
        return { type, confidence: res.confidence || 'high' };
      }
    } catch {
      // continue to next check
    }
  }

  const sample = content.trim().slice(0, 150).replace(/\r?\n/g, ' \\n ');
  const errorMsg = [
    `Could not classify document type.`,
    `Checks evaluated:`,
    ...checksTried.map((c) => `  - ${c}`),
    `Input preview: "${sample}"`,
  ].join('\n');

  throw new Error(errorMsg);
}
