import { z } from 'zod';

export const esbReadingSchema = z.object({
  mprn: z.string().optional(),
  readings: z.array(
    z.object({
      timestamp: z.string(), // ISO datetime
      import_kwh: z.number().nonnegative(),
      export_kwh: z.number().nonnegative(),
      tariff: z.enum(['day', 'night', 'peak']).optional(),
    }),
  ),
  summary: z.object({
    totalImport_kwh: z.number(),
    totalExport_kwh: z.number(),
    days: z.number().int(),
  }),
});

export type EsbReading = z.infer<typeof esbReadingSchema>;
export type EsbInterval = EsbReading['readings'][number];
