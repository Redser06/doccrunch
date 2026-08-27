import { parse as csvParse } from 'csv-parse';
import { registerParser } from '../core/registry.js';
import type { DocumentType } from '../core/types.js';
import { ESBMeterSchema, type ESBReading } from '../schemas/esb-meter.js';

function detect(content: string): boolean {
  const headerLine = content.split('\n').find((l) => l.trim().length > 0);
  if (!headerLine) return false;
  const headers = headerLine
    .toLowerCase()
    .split(/[,\t]/)
    .map((h) => h.trim());
  const hasTimestamp =
    headers.some((h) => h === 'timestamp' || h === 'reading_time' || h === 'date_time');
  const hasImport =
    headers.some((h) => h === 'import_kwh' || h === 'import' || h === 'kwh_import');
  const hasMprn = headers.some((h) => h === 'mprn');
  return hasTimestamp && (hasImport || hasMprn);
}

function parseEsbMeter(content: string, _source?: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    csvParse(
      content,
      { columns: true, trim: true, skip_empty_lines: true },
      (err, records: Record<string, string>[]) => {
        if (err) {
          reject(err);
          return;
        }

        // Extract MPRN from first row if present
        let mprn: string | undefined;
        const firstRow = records[0];
        if (firstRow) {
          const mprnKey = Object.keys(firstRow).find(
            (k) => k.toLowerCase().trim() === 'mprn',
          );
          if (mprnKey) mprn = firstRow[mprnKey];
        }

        const readings: ESBReading['readings'] = records.map((r) => {
          const get = (keys: string[]): string | undefined => {
            for (const k of keys) {
              const found = Object.keys(r).find(
                (rk) => rk.toLowerCase().trim() === k,
              );
              if (found) return r[found];
            }
            return undefined;
          };

          const timestamp = get(['timestamp', 'reading_time', 'date_time']) ?? '';
          const importStr = get(['import_kwh', 'import', 'kwh_import']) ?? '0';
          const exportStr = get(['export_kwh', 'export', 'kwh_export']) ?? '0';
          const tariff = get(['tariff']);

          return {
            timestamp,
            import_kwh: parseFloat(importStr) || 0,
            export_kwh: parseFloat(exportStr) || 0,
            tariff: tariff as ESBReading['readings'][number]['tariff'],
          };
        });

        const totalImport_kwh = round2(
          readings.reduce((s, r) => s + r.import_kwh, 0),
        );
        const totalExport_kwh = round2(
          readings.reduce((s, r) => s + r.export_kwh, 0),
        );

        // Count unique days from timestamps
        const uniqueDays = new Set(
          readings.map((r) => r.timestamp.split('T')[0].split(' ')[0]),
        );

        const result: ESBReading = {
          mprn,
          readings,
          summary: {
            totalImport_kwh,
            totalExport_kwh,
            days: uniqueDays.size,
          },
        };

        resolve(ESBMeterSchema.parse(result));
      },
    );
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function register(): void {
  registerParser('esb-meter' as DocumentType, {
    detect,
    parse: parseEsbMeter,
    schema: ESBMeterSchema,
  });
}

// Self-register on import (dogfood the API)
register();