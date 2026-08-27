import { parse as parseCsv } from 'csv-parse/sync';
import { registerParser } from '../core/registry.js';
import type { ParserInput } from '../core/types.js';
import { esbReadingSchema, type EsbInterval, type EsbReading } from '../schemas/esb-meter.js';
import { headerLine, parseNumber, pick, sum, toIsoDateTime } from './util.js';

export const ESB_METER_VERSION = '0.1.0';
export const ESB_METER_TYPE = 'esb-meter';

const DETECT_CHECKS = [
  'CSV header includes an MPRN column',
  'CSV header includes both a kWh column and a Timestamp column',
];

const TARIFFS = new Set(['day', 'night', 'peak']);

export function detectEsbMeter(input: ParserInput): boolean {
  const header = headerLine(input.text).toLowerCase();
  if (!header.includes(',')) return false;
  if (/\bmprn\b/.test(header)) return true;
  return header.includes('kwh') && /timestamp|read\s*date|datetime/.test(header);
}

type Row = Record<string, string | undefined>;

export function parseEsbMeter(input: ParserInput): EsbReading {
  const raw = parseCsv(input.text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as Row[];
  if (raw.length === 0) throw new Error('ESB CSV contained a header but no data rows.');

  const readings: EsbInterval[] = raw.map((r, i) => {
    const timestamp = pick(r, 'timestamp', 'read date and end time', 'datetime', 'time');
    if (!timestamp) throw new Error(`Row ${i + 1}: missing Timestamp`);

    const importRaw = pick(r, 'import_kwh', 'import kwh', 'import', 'read value', 'kwh');
    const exportRaw = pick(r, 'export_kwh', 'export kwh', 'export');
    const tariffRaw = pick(r, 'tariff', 'rate')?.toLowerCase();

    if (importRaw === undefined) throw new Error(`Row ${i + 1}: missing Import_kWh`);

    return {
      timestamp: toIsoDateTime(timestamp, `row ${i + 1} timestamp`),
      import_kwh: parseNumber(importRaw, `row ${i + 1} import_kwh`),
      export_kwh: exportRaw === undefined ? 0 : parseNumber(exportRaw, `row ${i + 1} export_kwh`),
      ...(tariffRaw && TARIFFS.has(tariffRaw)
        ? { tariff: tariffRaw as NonNullable<EsbInterval['tariff']> }
        : {}),
    };
  });

  const mprn = raw.map((r) => pick(r, 'mprn')).find(Boolean);
  const days = new Set(readings.map((r) => r.timestamp.slice(0, 10))).size;

  return {
    ...(mprn ? { mprn } : {}),
    readings,
    summary: {
      totalImport_kwh: sum(readings.map((r) => r.import_kwh)),
      totalExport_kwh: sum(readings.map((r) => r.export_kwh)),
      days,
    },
  };
}

/** Half-hourly data should land on :00/:30 — flag gaps and odd cadence. */
export function cadenceWarnings(payload: EsbReading): string[] {
  const offGrid = payload.readings.filter((r) => !/:(00|30):00Z$/.test(r.timestamp));
  return offGrid.length
    ? [`${offGrid.length} reading(s) are not on a half-hourly boundary (first: ${offGrid[0]!.timestamp})`]
    : [];
}

registerParser<EsbReading>(ESB_METER_TYPE, {
  detect: detectEsbMeter,
  parse: parseEsbMeter,
  schema: esbReadingSchema,
  version: ESB_METER_VERSION,
  checks: DETECT_CHECKS,
  confidence: (payload) => (cadenceWarnings(payload).length ? 'medium' : 'high'),
  warnings: (payload) => cadenceWarnings(payload),
});
