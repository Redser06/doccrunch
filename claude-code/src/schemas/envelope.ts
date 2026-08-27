import { z } from 'zod';

export const confidenceSchema = z.enum(['high', 'medium', 'low']);

/**
 * `meta.type` is a string rather than an enum: `registerParser` lets downstream
 * projects add document classes the core has never heard of, and batch failures
 * are stamped `unknown`.
 */
export const envelopeMetaSchema = z.object({
  type: z.string().min(1),
  source: z.string(),
  parsedAt: z.string().datetime(),
  confidence: confidenceSchema,
  parserVersion: z.string().min(1),
});

export const envelopeSchema = z.object({
  meta: envelopeMetaSchema,
  payload: z.unknown(),
  warnings: z.array(z.string()).optional(),
  error: z.string().optional(),
});

export type EnvelopeMeta = z.infer<typeof envelopeMetaSchema>;
