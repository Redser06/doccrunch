// DocCrunch SDK - Document ingestion engine
// Any doc → normalized JSON

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { detectType } from './core/detect.js';
import { getParser } from './core/registry.js';
import { wrapEnvelope } from './core/envelope.js';
import type { DocumentType, EnvelopeResult } from './core/types.js';
import { Envelope } from './schemas/envelope.js';

// Import parsers to trigger self-registration (dogfood the API)
import './parsers/merchant-statement.js';
import './parsers/bank-csv.js';
import './parsers/esb-meter.js';

// Re-export public API
export { detectType } from './core/detect.js';
export {
  registerParser,
  getParser,
  getRegisteredTypes,
  clearRegistry,
} from './core/registry.js';
export { wrapEnvelope, wrapError } from './core/envelope.js';
export { Envelope } from './schemas/envelope.js';
export {
  MerchantStatementSchema,
  type MerchantStatement,
} from './schemas/merchant-statement.js';
export { BankCsvSchema, type BankStatement } from './schemas/bank-csv.js';
export { ESBMeterSchema, type ESBReading } from './schemas/esb-meter.js';
export type {
  DocumentType,
  ParserShape,
  EnvelopeResult,
  EnvelopeMeta,
  EnvelopeError,
  DetectFn,
  ParseFn,
} from './core/types.js';
export { DOCUMENT_TYPES } from './core/types.js';

export interface ParseOptions {
  type?: DocumentType;
}

export interface BatchResult {
  meta: {
    type: DocumentType;
    source: string;
    parsedAt: string;
    confidence: 'high' | 'medium' | 'low';
    parserVersion: string;
  };
  payload: unknown;
  error?: string;
}

/**
 * Parse a file from disk: detect type, route to parser, wrap in envelope, validate.
 */
export async function parse(filePath: string, opts?: ParseOptions): Promise<EnvelopeResult> {
  const buffer = await readFile(filePath, 'utf-8');
  return parseText(buffer, { ...opts, source: filePath });
}

/**
 * Parse raw text content: detect type, route to parser, wrap in envelope, validate.
 */
export async function parseText(
  text: string,
  opts?: ParseOptions & { source?: string },
): Promise<EnvelopeResult> {
  const source = opts?.source ?? '<text input>';
  const type = opts?.type ?? detectType(text);
  const parser = getParser(type);

  if (!parser) {
    throw new Error(`No parser registered for type: ${type}`);
  }

  const payload = await parser.parse(text, source);
  const parserVersion = `${type}@0.1.0`;

  const result = wrapEnvelope(type, source, payload, parserVersion);

  // Validate envelope
  Envelope.parse(result);

  return result;
}

/**
 * Parse every supported file in a directory.
 * Files that fail become low-confidence envelopes with error fields.
 */
export async function parseBatch(dir: string): Promise<BatchResult[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results: BatchResult[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const filePath = join(dir, entry.name);

    // Skip expected.json files and hidden files
    if (entry.name.endsWith('-expected.json') || entry.name.startsWith('.')) continue;

    try {
      const buffer = await readFile(filePath, 'utf-8');
      const type = detectType(buffer);
      const parser = getParser(type);

      if (!parser) {
        throw new Error(`No parser registered for type: ${type}`);
      }

      const payload = await parser.parse(buffer, entry.name);
      const parserVersion = `${type}@0.1.0`;

      // Validate with Zod schema
      parser.schema.parse(payload);

      const envelope = wrapEnvelope(type, entry.name, payload, parserVersion);
      results.push({
        meta: envelope.meta,
        payload: envelope.payload,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        meta: {
          type: 'merchant-statement', // default type for error entries
          source: entry.name,
          parsedAt: new Date().toISOString(),
          confidence: 'low',
          parserVersion: 'unknown@0.0.0',
        },
        payload: {},
        error: message,
      });
    }
  }

  return results;
}