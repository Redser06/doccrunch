'use strict';

var zod = require('zod');

// DocCrunch - Document ingestion engine

var Envelope = zod.z.object({
  meta: zod.z.object({
    type: zod.z.string().describe("document class \u2014 built-ins: merchant-statement, bank-csv, esb-meter; extensible via registerParser"),
    source: zod.z.string().describe("filename or provenance"),
    parsedAt: zod.z.string().describe("ISO datetime"),
    confidence: zod.z.enum(["high", "medium", "low"]).default("high"),
    parserVersion: zod.z.string()
  }),
  payload: zod.z.unknown().describe("class-specific parsed data")
});
var MerchantStatementSchema = zod.z.object({
  meta: zod.z.object({
    provider: zod.z.enum([
      "elavon",
      "worldpay",
      "aib-merchant-services",
      "global-payments",
      "unknown"
    ]),
    statementPeriodStart: zod.z.string(),
    statementPeriodEnd: zod.z.string(),
    merchantId: zod.z.string(),
    merchantName: zod.z.string(),
    currency: zod.z.literal("EUR").default("EUR"),
    generatedAt: zod.z.string()
  }),
  summary: zod.z.object({
    totalVolume: zod.z.number(),
    totalCount: zod.z.number().int(),
    totalInterchange: zod.z.number(),
    totalSchemeFees: zod.z.number(),
    totalAcquirerFees: zod.z.number(),
    totalFees: zod.z.number(),
    netSettlement: zod.z.number()
  }),
  lineItems: zod.z.array(
    zod.z.object({
      date: zod.z.string(),
      cardType: zod.z.enum([
        "visa",
        "mastercard",
        "amex",
        "visa-debit",
        "mastercard-debit",
        "unknown"
      ]),
      transactionType: zod.z.enum(["sale", "refund", "chargeback", "reversal", "other"]),
      volume: zod.z.number(),
      count: zod.z.number().int(),
      rate: zod.z.number(),
      interchangeFee: zod.z.number(),
      schemeFee: zod.z.number(),
      acquirerFee: zod.z.number(),
      totalFee: zod.z.number(),
      netAmount: zod.z.number()
    })
  )
});
var BankCsvSchema = zod.z.object({
  account: zod.z.string().optional(),
  currency: zod.z.string().default("EUR"),
  rows: zod.z.array(
    zod.z.object({
      date: zod.z.string(),
      description: zod.z.string(),
      amount: zod.z.number(),
      balance: zod.z.number().optional(),
      category: zod.z.string().optional()
    })
  ),
  summary: zod.z.object({
    totalIn: zod.z.number(),
    totalOut: zod.z.number(),
    net: zod.z.number()
  })
});
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

exports.BankCsvSchema = BankCsvSchema;
exports.ESBMeterSchema = ESBMeterSchema;
exports.Envelope = Envelope;
exports.MerchantStatementSchema = MerchantStatementSchema;
