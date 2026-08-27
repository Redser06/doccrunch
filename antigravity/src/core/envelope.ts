import { ConfidenceLevel, Envelope, EnvelopeMeta } from './types.js';

export interface CreateEnvelopeOptions {
  type: string;
  source: string;
  payload: any;
  confidence?: ConfidenceLevel;
  parserVersion?: string;
  parsedAt?: string;
  error?: string;
}

export function createEnvelope<T = any>(options: CreateEnvelopeOptions): Envelope<T> {
  const meta: EnvelopeMeta = {
    type: options.type,
    source: options.source,
    parsedAt: options.parsedAt || new Date().toISOString(),
    confidence: options.confidence || 'high',
    parserVersion: options.parserVersion || `${options.type}@0.1.0`,
  };

  const envelope: Envelope<T> = {
    meta,
    payload: options.payload,
  };

  if (options.error) {
    envelope.error = options.error;
  }

  return envelope;
}
