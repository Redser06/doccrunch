import type { DocumentType, EnvelopeResult, EnvelopeMeta } from './types.js';

export function wrapEnvelope(
  type: DocumentType,
  source: string,
  payload: unknown,
  parserVersion: string,
  confidence: 'high' | 'medium' | 'low' = 'high',
): EnvelopeResult {
  const meta: EnvelopeMeta = {
    type,
    source,
    parsedAt: new Date().toISOString(),
    confidence,
    parserVersion,
  };
  return { meta, payload };
}

export function wrapError(
  type: DocumentType,
  source: string,
  parserVersion: string,
  error: string,
): { meta: EnvelopeMeta; payload: Record<string, never>; error: string } {
  return {
    meta: {
      type,
      source,
      parsedAt: new Date().toISOString(),
      confidence: 'low',
      parserVersion,
    },
    payload: {},
    error,
  };
}