import { DocumentType, EnvelopeResult } from './core.js';
export { DOCUMENT_TYPES, DetectFn, EnvelopeError, EnvelopeMeta, ParseFn, ParserShape, clearRegistry, detectType, getParser, getRegisteredTypes, registerParser, wrapEnvelope, wrapError } from './core.js';
export { BankCsvSchema, BankStatement, ESBMeterSchema, ESBReading, Envelope, MerchantStatement, MerchantStatementSchema } from './schemas.js';
import 'zod';

interface ParseOptions {
    type?: DocumentType;
}
interface BatchResult {
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
declare function parse(filePath: string, opts?: ParseOptions): Promise<EnvelopeResult>;
/**
 * Parse raw text content: detect type, route to parser, wrap in envelope, validate.
 */
declare function parseText(text: string, opts?: ParseOptions & {
    source?: string;
}): Promise<EnvelopeResult>;
/**
 * Parse every supported file in a directory.
 * Files that fail become low-confidence envelopes with error fields.
 */
declare function parseBatch(dir: string): Promise<BatchResult[]>;

export { type BatchResult, DocumentType, EnvelopeResult, type ParseOptions, parse, parseBatch, parseText };
