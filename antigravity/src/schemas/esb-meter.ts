import { z } from 'zod';

export const ESBReadingItemSchema = z.object({
  timestamp: z.string(),            // ISO datetime
  import_kwh: z.number().nonnegative(),
  export_kwh: z.number().nonnegative(),
  tariff: z.enum(['day', 'night', 'peak']).optional(),
});

export const ESBSummarySchema = z.object({
  totalImport_kwh: z.number(),
  totalExport_kwh: z.number(),
  days: z.number().int(),
});

export const ESBReadingSchema = z.object({
  mprn: z.string().optional(),
  readings: z.array(ESBReadingItemSchema),
  summary: ESBSummarySchema,
});

export type ESBReading = z.infer<typeof ESBReadingSchema>;
export type ESBReadingItem = z.infer<typeof ESBReadingItemSchema>;
export type ESBSummary = z.infer<typeof ESBSummarySchema>;
