import { z } from 'zod';

export const Envelope = z.object({
  meta: z.object({
    type: z.string().describe('document class — built-ins: merchant-statement, bank-csv, esb-meter; extensible via registerParser'),
    source: z.string().describe('filename or provenance'),
    parsedAt: z.string().describe('ISO datetime'),
    confidence: z.enum(['high', 'medium', 'low']).default('high'),
    parserVersion: z.string(),
  }),
  payload: z.unknown().describe('class-specific parsed data'),
});

export type Envelope = z.infer<typeof Envelope>;