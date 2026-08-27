import type { z } from 'zod';

export const DOCUMENT_TYPES = [
  'merchant-statement',
  'bank-csv',
  'esb-meter',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type DetectFn = (content: string) => boolean;

export type ParseFn = (content: string, source?: string) => Promise<unknown>;

export interface ParserShape {
  detect: DetectFn;
  parse: ParseFn;
  schema: z.ZodType;
}

export interface EnvelopeMeta {
  type: DocumentType;
  source: string;
  parsedAt: string;
  confidence: 'high' | 'medium' | 'low';
  parserVersion: string;
}

export interface EnvelopeResult {
  meta: EnvelopeMeta;
  payload: unknown;
}

export interface EnvelopeError {
  meta: EnvelopeMeta;
  payload: Record<string, never>;
  error: string;
}