import { z } from 'zod';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface EnvelopeMeta {
  type: string;
  source: string;
  parsedAt: string;
  confidence: ConfidenceLevel;
  parserVersion: string;
}

export interface Envelope<T = unknown> {
  meta: EnvelopeMeta;
  payload: T;
  error?: string;
}

export interface ParseContext {
  source: string;
  filename?: string;
  opts?: ParseOptions;
}

export type DetectFn = (content: string, filename?: string) => boolean | { match: boolean; confidence?: ConfidenceLevel };

export interface ParserPlugin<T = unknown> {
  name?: string;
  version?: string;
  detect: DetectFn;
  parse: (content: string, context: ParseContext) => Promise<T> | T;
  schema: z.ZodType<T>;
}

export interface ParseOptions {
  type?: string;
  source?: string;
  confidence?: ConfidenceLevel;
  filename?: string;
  strict?: boolean;
}

export interface BatchItemResult {
  file: string;
  envelope: Envelope<unknown>;
}
