import { z } from 'zod';

export const ESBMeterSchema = z.object({
  mprn: z.string().optional(),
  readings: z.array(
    z.object({
      timestamp: z.string(),
      import_kwh: z.number().nonnegative(),
      export_kwh: z.number().nonnegative().default(0),
      tariff: z.enum(['day', 'night', 'peak']).optional(),
    }),
  ),
  summary: z.object({
    totalImport_kwh: z.number(),
    totalExport_kwh: z.number(),
    days: z.number().int(),
  }),
});

export type ESBReading = z.infer<typeof ESBMeterSchema>;