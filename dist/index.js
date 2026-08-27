import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { parse as parse$1 } from 'csv-parse';

// DocCrunch - Document ingestion engine


// src/core/registry.ts
var registry = /* @__PURE__ */ new Map();
function registerParser(type, parser) {
  registry.set(type, parser);
}
function getParser(type) {
  return registry.get(type);
}
function getRegisteredTypes() {
  return Array.from(registry.keys());
}
function clearRegistry() {
  registry.clear();
}

// src/core/detect.ts
var checks = [
  {
    type: "merchant-statement",
    test: (content) => {
      const upper = content.toUpperCase();
      return upper.includes("ELAVON") || upper.includes("MERCHANT STATEMENT") || upper.includes("MERCHANT SERVICES") || upper.includes("ACQUIRER") || // Elavon-style: has card scheme + interchange + settlement language
      upper.includes("INTERCHANGE") && upper.includes("SETTLEMENT") && (upper.includes("VISA") || upper.includes("MASTERCARD"));
    }
  },
  {
    type: "bank-csv",
    test: (content) => {
      const headerLine = content.split("\n").find((l) => l.trim().length > 0);
      if (!headerLine) return false;
      const headers = headerLine.toLowerCase().split(/[,\t]/).map((h) => h.trim());
      const hasDate = headers.some((h) => h === "date" || h === "transaction date");
      const hasDescription = headers.some(
        (h) => h === "description" || h === "details" || h === "narrative"
      );
      const hasAmount = headers.some((h) => h === "amount" || h === "value") || headers.some((h) => h === "debit") && headers.some((h) => h === "credit");
      return hasDate && hasDescription && hasAmount;
    }
  },
  {
    type: "esb-meter",
    test: (content) => {
      const headerLine = content.split("\n").find((l) => l.trim().length > 0);
      if (!headerLine) return false;
      const headers = headerLine.toLowerCase().split(/[,\t]/).map((h) => h.trim());
      const hasTimestamp = headers.some((h) => h === "timestamp" || h === "reading_time" || h === "date_time");
      const hasImport = headers.some((h) => h === "import_kwh" || h === "import" || h === "kwh_import");
      const hasMprn = headers.some((h) => h === "mprn");
      return hasTimestamp && (hasImport || hasMprn);
    }
  }
];
function detectType(content) {
  for (const type of getRegisteredTypes()) {
    const parser = getParser(type);
    if (parser?.detect(content)) {
      return type;
    }
  }
  const tried = [];
  for (const check of checks) {
    tried.push(check.type);
    if (check.test(content)) {
      return check.type;
    }
  }
  throw new Error(
    `Could not detect document type. Checks tried: ${tried.join(", ")}. Provide a --type flag or register a custom parser.`
  );
}

// src/core/envelope.ts
function wrapEnvelope(type, source, payload, parserVersion, confidence = "high") {
  const meta = {
    type,
    source,
    parsedAt: (/* @__PURE__ */ new Date()).toISOString(),
    confidence,
    parserVersion
  };
  return { meta, payload };
}
function wrapError(type, source, parserVersion, error) {
  return {
    meta: {
      type,
      source,
      parsedAt: (/* @__PURE__ */ new Date()).toISOString(),
      confidence: "low",
      parserVersion
    },
    payload: {},
    error
  };
}
var Envelope = z.object({
  meta: z.object({
    type: z.enum(["merchant-statement", "bank-csv", "esb-meter"]),
    source: z.string().describe("filename or provenance"),
    parsedAt: z.string().describe("ISO datetime"),
    confidence: z.enum(["high", "medium", "low"]).default("high"),
    parserVersion: z.string()
  }),
  payload: z.unknown().describe("class-specific parsed data")
});
var MerchantStatementSchema = z.object({
  meta: z.object({
    provider: z.enum([
      "elavon",
      "worldpay",
      "aib-merchant-services",
      "global-payments",
      "unknown"
    ]),
    statementPeriodStart: z.string(),
    statementPeriodEnd: z.string(),
    merchantId: z.string(),
    merchantName: z.string(),
    currency: z.literal("EUR").default("EUR"),
    generatedAt: z.string()
  }),
  summary: z.object({
    totalVolume: z.number(),
    totalCount: z.number().int(),
    totalInterchange: z.number(),
    totalSchemeFees: z.number(),
    totalAcquirerFees: z.number(),
    totalFees: z.number(),
    netSettlement: z.number()
  }),
  lineItems: z.array(
    z.object({
      date: z.string(),
      cardType: z.enum([
        "visa",
        "mastercard",
        "amex",
        "visa-debit",
        "mastercard-debit",
        "unknown"
      ]),
      transactionType: z.enum(["sale", "refund", "chargeback", "reversal", "other"]),
      volume: z.number(),
      count: z.number().int(),
      rate: z.number(),
      interchangeFee: z.number(),
      schemeFee: z.number(),
      acquirerFee: z.number(),
      totalFee: z.number(),
      netAmount: z.number()
    })
  )
});

// src/parsers/merchant-statement.ts
function detect(content) {
  const upper = content.toUpperCase();
  return upper.includes("ELAVON") || upper.includes("MERCHANT STATEMENT") || upper.includes("MERCHANT SERVICES") || upper.includes("ACQUIRER") || upper.includes("INTERCHANGE") && upper.includes("SETTLEMENT") && (upper.includes("VISA") || upper.includes("MASTERCARD"));
}
function parseMerchantStatement(content, _source) {
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  let provider = "unknown";
  let statementPeriodStart = "";
  let statementPeriodEnd = "";
  let merchantId = "";
  let merchantName = "";
  let generatedAt = "";
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("elavon")) provider = "elavon";
    if (lower.includes("worldpay")) provider = "worldpay";
    if (lower.includes("aib merchant")) provider = "aib-merchant-services";
    if (lower.includes("global payments")) provider = "global-payments";
    const periodMatch = line.match(
      /statement period[:\s]+(\d{4}-\d{2}-\d{2})\s+(?:to|–|-)\s+(\d{4}-\d{2}-\d{2})/i
    );
    if (periodMatch) {
      statementPeriodStart = periodMatch[1];
      statementPeriodEnd = periodMatch[2];
    }
    const merchantIdMatch = line.match(/merchant\s*(?:id|number)[:\s]+([A-Z0-9-]+)/i);
    if (merchantIdMatch) merchantId = merchantIdMatch[1];
    const merchantNameMatch = line.match(/merchant\s*name[:\s]+(.+)/i);
    if (merchantNameMatch) merchantName = merchantNameMatch[1].trim();
    const generatedMatch = line.match(/generated(?:\s*at|[:\s])[:\s]+(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2})/i);
    if (generatedMatch) generatedAt = generatedMatch[1];
  }
  const lineItems = [];
  for (const line of lines) {
    const match = line.match(
      /^(\d{4}-\d{2}-\d{2})\s+([\w-]+)\s+(\w+)\s+([\d,.]+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)$/
    );
    if (match) {
      const [
        ,
        date,
        cardTypeRaw,
        txnTypeRaw,
        volumeRaw,
        countRaw,
        rateRaw,
        icRaw,
        sfRaw,
        afRaw,
        tfRaw,
        netRaw
      ] = match;
      const cardType = normalizeCardType(cardTypeRaw);
      const transactionType = normalizeTxnType(txnTypeRaw);
      const volume = parseFloat(volumeRaw.replace(/,/g, ""));
      const count = parseInt(countRaw, 10);
      const rate = parseFloat(rateRaw);
      const interchangeFee = parseFloat(icRaw);
      const schemeFee = parseFloat(sfRaw);
      const acquirerFee = parseFloat(afRaw);
      const totalFee = parseFloat(tfRaw);
      const netAmount = parseFloat(netRaw);
      lineItems.push({
        date,
        cardType,
        transactionType,
        volume,
        count,
        rate,
        interchangeFee,
        schemeFee,
        acquirerFee,
        totalFee,
        netAmount
      });
    }
  }
  const totalVolume = round2(lineItems.reduce((s, li) => s + li.volume, 0));
  const totalCount = lineItems.reduce((s, li) => s + li.count, 0);
  const totalInterchange = round2(lineItems.reduce((s, li) => s + li.interchangeFee, 0));
  const totalSchemeFees = round2(lineItems.reduce((s, li) => s + li.schemeFee, 0));
  const totalAcquirerFees = round2(lineItems.reduce((s, li) => s + li.acquirerFee, 0));
  const totalFees = round2(lineItems.reduce((s, li) => s + li.totalFee, 0));
  const netSettlement = round2(lineItems.reduce((s, li) => s + li.netAmount, 0));
  const result = {
    meta: {
      provider,
      statementPeriodStart,
      statementPeriodEnd,
      merchantId,
      merchantName,
      currency: "EUR",
      generatedAt
    },
    summary: {
      totalVolume,
      totalCount,
      totalInterchange,
      totalSchemeFees,
      totalAcquirerFees,
      totalFees,
      netSettlement
    },
    lineItems
  };
  return Promise.resolve(MerchantStatementSchema.parse(result));
}
function normalizeCardType(raw) {
  const lower = raw.toLowerCase().replace(/\s+/g, "-");
  if (lower === "visa") return "visa";
  if (lower === "mastercard" || lower === "mc") return "mastercard";
  if (lower === "amex" || lower === "american-express") return "amex";
  if (lower === "visa-debit") return "visa-debit";
  if (lower === "mastercard-debit" || lower === "mc-debit") return "mastercard-debit";
  return "unknown";
}
function normalizeTxnType(raw) {
  const lower = raw.toLowerCase();
  if (lower === "sale") return "sale";
  if (lower === "refund") return "refund";
  if (lower === "chargeback" || lower === "cbk") return "chargeback";
  if (lower === "reversal") return "reversal";
  return "other";
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function register() {
  registerParser("merchant-statement", {
    detect,
    parse: parseMerchantStatement,
    schema: MerchantStatementSchema
  });
}
register();
var BankCsvSchema = z.object({
  account: z.string().optional(),
  currency: z.string().default("EUR"),
  rows: z.array(
    z.object({
      date: z.string(),
      description: z.string(),
      amount: z.number(),
      balance: z.number().optional(),
      category: z.string().optional()
    })
  ),
  summary: z.object({
    totalIn: z.number(),
    totalOut: z.number(),
    net: z.number()
  })
});

// src/parsers/bank-csv.ts
function detect2(content) {
  const headerLine = content.split("\n").find((l) => l.trim().length > 0);
  if (!headerLine) return false;
  const headers = headerLine.toLowerCase().split(/[,\t]/).map((h) => h.trim());
  const hasDate = headers.some((h) => h === "date" || h === "transaction date");
  const hasDescription = headers.some(
    (h) => h === "description" || h === "details" || h === "narrative"
  );
  const hasAmount = headers.some((h) => h === "amount" || h === "value") || headers.some((h) => h === "debit") && headers.some((h) => h === "credit");
  return hasDate && hasDescription && hasAmount;
}
function parseBankCsv(content, _source) {
  return new Promise((resolve, reject) => {
    parse$1(
      content,
      { columns: true, trim: true, skip_empty_lines: true },
      (err, records) => {
        if (err) {
          reject(err);
          return;
        }
        const rows = records.map((r) => {
          const get = (keys) => {
            for (const k of keys) {
              const found = Object.keys(r).find(
                (rk) => rk.toLowerCase().trim() === k
              );
              if (found) return r[found];
            }
            return void 0;
          };
          const date = get(["date", "transaction date"]) ?? "";
          const description = get(["description", "details", "narrative"]) ?? "";
          const balance = get(["balance", "running balance"]);
          const category = get(["category"]);
          const amountStr = get(["amount", "value"]);
          let amount;
          if (amountStr !== void 0) {
            amount = parseFloat(amountStr.replace(/[€,\s]/g, ""));
          } else {
            const debit = get(["debit"]);
            const credit = get(["credit"]);
            if (debit && parseFloat(debit.replace(/[€,\s]/g, "")) !== 0) {
              amount = -parseFloat(debit.replace(/[€,\s]/g, ""));
            } else if (credit) {
              amount = parseFloat(credit.replace(/[€,\s]/g, ""));
            } else {
              amount = 0;
            }
          }
          return {
            date,
            description,
            amount,
            balance: balance !== void 0 ? parseFloat(balance.replace(/[€,\s]/g, "")) : void 0,
            category: category ?? void 0
          };
        });
        const totalIn = round22(
          rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0)
        );
        const totalOut = round22(
          Math.abs(
            rows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0)
          )
        );
        const net = round22(rows.reduce((s, r) => s + r.amount, 0));
        const result = {
          account: void 0,
          currency: "EUR",
          rows,
          summary: { totalIn, totalOut, net }
        };
        resolve(BankCsvSchema.parse(result));
      }
    );
  });
}
function round22(n) {
  return Math.round(n * 100) / 100;
}
function register2() {
  registerParser("bank-csv", {
    detect: detect2,
    parse: parseBankCsv,
    schema: BankCsvSchema
  });
}
register2();
var ESBMeterSchema = z.object({
  mprn: z.string().optional(),
  readings: z.array(
    z.object({
      timestamp: z.string(),
      import_kwh: z.number().nonnegative(),
      export_kwh: z.number().nonnegative().default(0),
      tariff: z.enum(["day", "night", "peak"]).optional()
    })
  ),
  summary: z.object({
    totalImport_kwh: z.number(),
    totalExport_kwh: z.number(),
    days: z.number().int()
  })
});

// src/parsers/esb-meter.ts
function detect3(content) {
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
    parse$1(
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
        const totalImport_kwh = round23(
          readings.reduce((s, r) => s + r.import_kwh, 0)
        );
        const totalExport_kwh = round23(
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
function round23(n) {
  return Math.round(n * 100) / 100;
}
function register3() {
  registerParser("esb-meter", {
    detect: detect3,
    parse: parseEsbMeter,
    schema: ESBMeterSchema
  });
}
register3();

// src/core/types.ts
var DOCUMENT_TYPES = [
  "merchant-statement",
  "bank-csv",
  "esb-meter"
];

// src/index.ts
async function parse(filePath, opts) {
  const buffer = await readFile(filePath, "utf-8");
  return parseText(buffer, { ...opts, source: filePath });
}
async function parseText(text, opts) {
  const source = opts?.source ?? "<text input>";
  const type = opts?.type ?? detectType(text);
  const parser = getParser(type);
  if (!parser) {
    throw new Error(`No parser registered for type: ${type}`);
  }
  const payload = await parser.parse(text, source);
  const parserVersion = `${type}@0.1.0`;
  const result = wrapEnvelope(type, source, payload, parserVersion);
  Envelope.parse(result);
  return result;
}
async function parseBatch(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = join(dir, entry.name);
    if (entry.name.endsWith("-expected.json") || entry.name.startsWith(".")) continue;
    try {
      const buffer = await readFile(filePath, "utf-8");
      const type = detectType(buffer);
      const parser = getParser(type);
      if (!parser) {
        throw new Error(`No parser registered for type: ${type}`);
      }
      const payload = await parser.parse(buffer, entry.name);
      const parserVersion = `${type}@0.1.0`;
      parser.schema.parse(payload);
      const envelope = wrapEnvelope(type, entry.name, payload, parserVersion);
      results.push({
        meta: envelope.meta,
        payload: envelope.payload
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        meta: {
          type: "merchant-statement",
          // default type for error entries
          source: entry.name,
          parsedAt: (/* @__PURE__ */ new Date()).toISOString(),
          confidence: "low",
          parserVersion: "unknown@0.0.0"
        },
        payload: {},
        error: message
      });
    }
  }
  return results;
}

export { BankCsvSchema, DOCUMENT_TYPES, ESBMeterSchema, Envelope, MerchantStatementSchema, clearRegistry, detectType, getParser, getRegisteredTypes, parse, parseBatch, parseText, registerParser, wrapEnvelope, wrapError };
