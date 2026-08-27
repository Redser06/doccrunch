'use strict';

var csvParse = require('csv-parse');
var zod = require('zod');

// DocCrunch - Document ingestion engine


// src/core/registry.ts
var registry = /* @__PURE__ */ new Map();
function registerParser(type, parser) {
  registry.set(type, parser);
}
var ESBMeterSchema = zod.z.object({
  mprn: zod.z.string().optional(),
  readings: zod.z.array(
    zod.z.object({
      timestamp: zod.z.string(),
      import_kwh: zod.z.number().nonnegative(),
      export_kwh: zod.z.number().nonnegative().default(0),
      tariff: zod.z.enum(["day", "night", "peak"]).optional()
    })
  ),
  summary: zod.z.object({
    totalImport_kwh: zod.z.number(),
    totalExport_kwh: zod.z.number(),
    days: zod.z.number().int()
  })
});

// src/parsers/esb-meter.ts
function detect(content) {
  const headerLine = content.split("\n").find((l) => l.trim().length > 0);
  if (!headerLine) return false;
  const headers = headerLine.toLowerCase().split(/[,\t]/).map((h) => h.trim());
  const hasTimestamp = headers.some((h) => h === "timestamp" || h === "reading_time" || h === "date_time");
  const hasImport = headers.some((h) => h === "import_kwh" || h === "import" || h === "kwh_import");
  const hasMprn = headers.some((h) => h === "mprn");
  return hasTimestamp && (hasImport || hasMprn);
}
function parseEsbMeter(content, _source) {
  return new Promise((resolve, reject) => {
    csvParse.parse(
      content,
      { columns: true, trim: true, skip_empty_lines: true },
      (err, records) => {
        if (err) {
          reject(err);
          return;
        }
        let mprn;
        const firstRow = records[0];
        if (firstRow) {
          const mprnKey = Object.keys(firstRow).find(
            (k) => k.toLowerCase().trim() === "mprn"
          );
          if (mprnKey) mprn = firstRow[mprnKey];
        }
        const readings = records.map((r) => {
          const get = (keys) => {
            for (const k of keys) {
              const found = Object.keys(r).find(
                (rk) => rk.toLowerCase().trim() === k
              );
              if (found) return r[found];
            }
            return void 0;
          };
          const timestamp = get(["timestamp", "reading_time", "date_time"]) ?? "";
          const importStr = get(["import_kwh", "import", "kwh_import"]) ?? "0";
          const exportStr = get(["export_kwh", "export", "kwh_export"]) ?? "0";
          const tariff = get(["tariff"]);
          return {
            timestamp,
            import_kwh: parseFloat(importStr) || 0,
            export_kwh: parseFloat(exportStr) || 0,
            tariff
          };
        });
        const totalImport_kwh = round2(
          readings.reduce((s, r) => s + r.import_kwh, 0)
        );
        const totalExport_kwh = round2(
          readings.reduce((s, r) => s + r.export_kwh, 0)
        );
        const uniqueDays = new Set(
          readings.map((r) => r.timestamp.split("T")[0].split(" ")[0])
        );
        const result = {
          mprn,
          readings,
          summary: {
            totalImport_kwh,
            totalExport_kwh,
            days: uniqueDays.size
          }
        };
        resolve(ESBMeterSchema.parse(result));
      }
    );
  });
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function register() {
  registerParser("esb-meter", {
    detect,
    parse: parseEsbMeter,
    schema: ESBMeterSchema
  });
}
register();

exports.register = register;
