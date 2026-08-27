import { z } from 'zod';

// DocCrunch - Document ingestion engine

var Envelope = z.object({
  meta: z.object({
    type: z.string().describe("document class \u2014 built-ins: merchant-statement, bank-csv, esb-meter; extensible via registerParser"),
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

export { BankCsvSchema, ESBMeterSchema, Envelope, MerchantStatementSchema };
