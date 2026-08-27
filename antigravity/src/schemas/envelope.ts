import { z } from 'zod';

export const EnvelopeMetaSchema = z.object({
  type: z.string(),
  source: z.string(),
  parsedAt: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  parserVersion: z.string(),
});

export function createEnvelopeSchema<T extends z.ZodTypeAny>(payloadSchema: T) {
  return z.object({
    meta: EnvelopeMetaSchema,
    payload: payloadSchema,
    error: z.string().optional(),
  });
}
