# DocCrunch 📄⚡

> Pluggable TypeScript document-ingestion engine: **Any Doc → Normalized JSON**.

DocCrunch is a high-throughput, deterministic document-ingestion library and CLI. Each document class is a self-contained parser plugged into a shared core via `registerParser()`.

## Features

- 🔌 **Pluggable Architecture**: Built-in parsers and custom user plugins register through the exact same hook (`registerParser`).
- 🛡️ **Strict Zod Schemas**: Every parsed document is strictly validated at runtime against its class-specific Zod schema.
- 📦 **Normalized Envelope**: Uniform metadata envelope (`type`, `source`, `parsedAt`, `confidence`, `parserVersion`) wrapping class-specific payloads.
- 🎯 **100% Deterministic**: Zero LLM or external network dependencies — instant, repeatable, reproducible results.
- 🚀 **Dual ESM & CJS**: Full TypeScript types, subpath exports (`/schemas`, `/parsers`, `/core`), and standalone CLI.

---

## Supported Built-in Document Classes

1. `merchant-statement`: Merchant acquiring statements (Elavon, Worldpay, AIB, etc. from PDF text or plain text)
2. `bank-csv`: Bank transaction CSV statements (Date, Description, Amount, Running Balance, Category)
3. `esb-meter`: ESB Irish smart-meter half-hourly CSV interval data (MPRN, Timestamp, Import/Export kWh, Day/Night/Peak Tariffs)

---

## SDK Usage

```typescript
import {
  parse,
  parseText,
  detectType,
  registerParser,
  parseBatch
} from 'doccrunch';
import { z } from 'zod';

// 1. Automatic Type Detection and Parsing from File
const statement = await parse('./path/to/statement.txt');
console.log(statement.meta.type); // 'merchant-statement'
console.log(statement.payload.summary.netSettlement);

// 2. Parse from in-memory string
const bankData = await parseText('Date,Description,Amount,Balance\n2025-07-01,Salary,3500.00,3500.00');
console.log(bankData.payload.summary.totalIn); // 3500

// 3. Sniff / Detect Type
const docType = detectType('ELAVON MERCHANT SERVICES\n...');
console.log(docType); // 'merchant-statement'

// 4. Register a Custom Parser Plugin
registerParser('my-invoice', {
  name: 'my-invoice',
  version: 'my-invoice@1.0.0',
  detect: (text) => text.includes('INVOICE_HEADER'),
  parse: (text) => {
    // Custom extraction logic
    return { invoiceId: 'INV-123', totalAmount: 99.99 };
  },
  schema: z.object({
    invoiceId: z.string(),
    totalAmount: z.number(),
  }),
});

// 5. Batch Parse Directory (Non-fatal on bad files)
const results = await parseBatch('./unprocessed_docs');
```

---

## CLI Usage

Install or run via npx / node:

```bash
# Parse a document to JSON
doccrunch parse tests/fixtures/bank.csv --pretty

# Force specific parser
doccrunch parse tests/fixtures/merchant-statement.txt --type merchant-statement

# Detect document type
doccrunch detect tests/fixtures/esb.csv

# Batch parse directory
doccrunch batch tests/fixtures --pretty
```

---

## MCP Server Support

> MCP (Model Context Protocol) server integration point:
> Can be mounted as an MCP tool provider exposing `doccrunch_parse` and `doccrunch_detect` endpoints.

---

## Testing & Build

```bash
# Run unit & fixture tests
pnpm test

# Typecheck
pnpm typecheck

# Build dual ESM/CJS bundles
pnpm build

# Run live demo
pnpm demo
```
