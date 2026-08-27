'use strict';

var csvParse = require('csv-parse');
var zod = require('zod');

// DocCrunch - Document ingestion engine


// src/core/registry.ts
var registry = /* @__PURE__ */ new Map();
function registerParser(type, parser) {
  registry.set(type, parser);
}
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

// src/parsers/bank-csv.ts
function detect(content) {
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
    csvParse.parse(
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
        const totalIn = round2(
          rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0)
        );
        const totalOut = round2(
          Math.abs(
            rows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0)
          )
        );
        const net = round2(rows.reduce((s, r) => s + r.amount, 0));
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
function round2(n) {
  return Math.round(n * 100) / 100;
}
function register() {
  registerParser("bank-csv", {
    detect,
    parse: parseBankCsv,
    schema: BankCsvSchema
  });
}
register();

exports.register = register;
