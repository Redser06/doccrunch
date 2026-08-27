import { envelopeSchema } from '../schemas/envelope.js';
import { getParser, parserVersion } from './registry.js';
import {
  SchemaValidationError,
  type Confidence,
  type DocType,
  type Envelope,
  type ParserInput,
} from './types.js';

/**
 * Run a registered parser and wrap its payload in the normalized envelope.
 * Validates the payload against the parser's schema, then the whole envelope.
 */
export function runParser<TPayload = unknown>(
  type: DocType,
  input: ParserInput,
): Envelope<TPayload> {
  const parser = getParser(type);
  if (!parser) {
    throw new Error(
      `No parser registered for type "${type}". Register one with registerParser("${type}", { detect, parse, schema }).`,
    );
  }

  const payload = parser.parse(input);
  const result = parser.schema.safeParse(payload);
  if (!result.success) {
    throw new SchemaValidationError(type, result.error.issues, result.error.message);
  }
  const validated = result.data as TPayload;

  const confidence: Confidence = parser.confidence?.(validated, input) ?? 'high';
  const warnings = parser.warnings?.(validated, input) ?? [];

  const envelope: Envelope<TPayload> = {
    meta: {
      type,
      source: input.source ?? '<inline>',
      parsedAt: new Date().toISOString(),
      confidence,
      parserVersion: parserVersion(type),
    },
    payload: validated,
    ...(warnings.length ? { warnings } : {}),
  };

  return envelopeSchema.parse(envelope) as Envelope<TPayload>;
}

/** Build the low-confidence envelope `parseBatch` uses for files that failed. */
export function errorEnvelope(source: string, error: unknown, type: DocType = 'unknown'): Envelope<Record<string, never>> {
  return {
    meta: {
      type,
      source,
      parsedAt: new Date().toISOString(),
      confidence: 'low',
      parserVersion: 'core@0.1.0',
    },
    payload: {},
    error: error instanceof Error ? error.message : String(error),
  };
}
