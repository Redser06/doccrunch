import { z } from 'zod';

declare const DOCUMENT_TYPES: readonly ["merchant-statement", "bank-csv", "esb-meter"];
type DocumentType = (typeof DOCUMENT_TYPES)[number];
type DetectFn = (content: string) => boolean;
type ParseFn = (content: string, source?: string) => Promise<unknown>;
interface ParserShape {
    detect: DetectFn;
    parse: ParseFn;
    schema: z.ZodType;
}
interface EnvelopeMeta {
    type: DocumentType;
    source: string;
    parsedAt: string;
    confidence: 'high' | 'medium' | 'low';
    parserVersion: string;
}
interface EnvelopeResult {
    meta: EnvelopeMeta;
    payload: unknown;
}
interface EnvelopeError {
    meta: EnvelopeMeta;
    payload: Record<string, never>;
    error: string;
}

declare function detectType(content: string): DocumentType;

declare function registerParser(type: DocumentType, parser: ParserShape): void;
declare function getParser(type: DocumentType): ParserShape | undefined;
declare function getRegisteredTypes(): DocumentType[];
declare function clearRegistry(): void;

declare function wrapEnvelope(type: DocumentType, source: string, payload: unknown, parserVersion: string, confidence?: 'high' | 'medium' | 'low'): EnvelopeResult;
declare function wrapError(type: DocumentType, source: string, parserVersion: string, error: string): {
    meta: EnvelopeMeta;
    payload: Record<string, never>;
    error: string;
};

export { DOCUMENT_TYPES, type DetectFn, type DocumentType, type EnvelopeError, type EnvelopeMeta, type EnvelopeResult, type ParseFn, type ParserShape, clearRegistry, detectType, getParser, getRegisteredTypes, registerParser, wrapEnvelope, wrapError };
