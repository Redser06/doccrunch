import { parse as csvParseSync } from 'csv-parse/sync';
import { ParserPlugin, ParseContext } from '../core/types.js';
import { ESBReading, ESBReadingSchema, ESBReadingItem } from '../schemas/esb-meter.js';

function normalizeTariff(raw?: string): 'day' | 'night' | 'peak' | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === 'day' || s === 'night' || s === 'peak') {
    return s;
  }
  return undefined;
}

export const esbMeterParser: ParserPlugin<ESBReading> = {
  name: 'esb-meter',
  version: 'esb-meter@0.1.0',
  detect(content: string): boolean {
    const firstLine = content.split(/\r?\n/)[0] || '';
    const normalized = firstLine.toLowerCase();
    return (
      normalized.includes('mprn') ||
      (normalized.includes('kwh') && normalized.includes('timestamp'))
    );
  },
  parse(content: string, _context: ParseContext): ESBReading {
    const records: Array<Record<string, string>> = csvParseSync(content, {
      columns: (header: string[]) =>
        header.map((col) => col.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')),
      skip_empty_lines: true,
      trim: true,
    });

    let mprn: string | undefined = undefined;
    const readings: ESBReadingItem[] = [];
    const uniqueDates = new Set<string>();
    let totalImport = 0;
    let totalExport = 0;

    for (const record of records) {
      if (!mprn && record['mprn']) {
        mprn = record['mprn'].trim();
      }

      const timestamp = record['timestamp'] || record['time'] || record['datetime'] || '';
      if (timestamp.length >= 10) {
        uniqueDates.add(timestamp.slice(0, 10));
      }

      const rawImport = record['import_kwh'] || record['importkwh'] || record['import'] || '0';
      const rawExport = record['export_kwh'] || record['exportkwh'] || record['export'] || '0';

      const import_kwh = Math.max(0, Number(parseFloat(rawImport).toFixed(2)));
      const export_kwh = Math.max(0, Number(parseFloat(rawExport).toFixed(2)));

      const tariff = normalizeTariff(record['tariff']);

      const reading: ESBReadingItem = {
        timestamp,
        import_kwh,
        export_kwh,
      };

      if (tariff) {
        reading.tariff = tariff;
      }

      readings.push(reading);
      totalImport += import_kwh;
      totalExport += export_kwh;
    }

    const days = Math.max(1, uniqueDates.size);

    const result: ESBReading = {
      readings,
      summary: {
        totalImport_kwh: Number(totalImport.toFixed(2)),
        totalExport_kwh: Number(totalExport.toFixed(2)),
        days,
      },
    };

    if (mprn) {
      result.mprn = mprn;
    }

    return ESBReadingSchema.parse(result);
  },
  schema: ESBReadingSchema,
};
