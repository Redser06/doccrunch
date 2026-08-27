'use strict';

var zod = require('zod');

// DocCrunch - Document ingestion engine

// src/core/registry.ts
var registry = /* @__PURE__ */ new Map();
function registerParser(type, parser) {
  registry.set(type, parser);
}
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
      /^(\d{4}-\d{2}-\d{2})\s+([\w-]+)\s+(\w+)\s+(-?[\d,.]+)\s+(\d+)\s+([\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)$/
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

exports.register = register;
