# DocCrunch

**Any doc → normalized JSON.** A pluggable TypeScript document-ingestion engine. Each document class is a self-contained parser registered into a shared core that auto-detects type, routes to the parser, validates with Zod, and wraps results in a stable envelope.

## Public forms

**SDK**
```ts
import { parse, parseText, detectType, registerParser, parseBatch } from 'doccrunch';

const result = await parse('./statement.pdf');     // → { meta, payload }
```

**CLI**
```bash
doccrunch parse <file> [--type merchant-statement|bank-csv|esb-meter] [--pretty]
```

## The envelope
Every parser returns a class-specific `payload`; the core wraps it:
```json
{
  "meta": { "type": "...", "source": "...", "parsedAt": "ISO", "confidence": "high|medium|low", "parserVersion": "..." },
  "payload": { "...": "class-specific data" }
}
```

## Built-in parsers
| Type | Source | Payload |
|---|---|---|
| `merchant-statement` | PDF (digital-native) → text | provider, period, merchant, fee summary, line items |
| `bank-csv` | bank CSV export | rows (date/description/amount/balance) + in/out/net summary |
| `esb-meter` | ESB smart-meter CSV | readings[] + import/export totals |

## Extend it (the plugin hook)
Add a document class without touching the core:
```ts
registerParser('my-type', {
  detect: (content) => content.startsWith('MYTYPE'),
  parse:  async (content) => ({ /* payload */ }),
  schema: MyZodSchema,   // thrown on mismatch
});
```
The 3 built-ins register through this same hook — the SDK dogfoods its own API.

## Develop
```bash
pnpm install
pnpm test      # vitest
pnpm demo      # parse all fixtures + a custom-registered plugin
pnpm build     # tsup → dist (ESM + CJS + d.ts), sub-path exports
pnpm dev parse tests/fixtures/bank.csv
```

## Roadmap
- **P2** — MCP wrapper (`parse_document` tool) consuming this SDK
- **P3** — vision class (receipt photo, coffee-bag label) via a vision LLM
- More text classes (insurance quotes, PPR transactions)

## Not here yet (deliberately)
OCR, >3 built-in types, web UI, LLM-based parsing. The core is intentionally small and deterministic.
