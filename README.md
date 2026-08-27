# DocCrunch

**Any doc → normalized JSON.** A pluggable TypeScript document-ingestion engine. Each document class is a self-contained parser registered into a shared core that auto-detects type, routes to the parser, validates with Zod, and wraps results in a stable envelope.

Shipped as three forms: **SDK**, **CLI**, and **MCP server** (a thin transport over the SDK).

## Repository layout

This is a **bake-off repo** — multiple independent builder implementations of the same spec live side-by-side, one per subfolder, so they can be compared apples-to-apples.

| Folder | Builder | Status |
|---|---|---|
| [`Berd-Kimi/`](./Berd-Kimi) | Berd · glm-5.2 (Product Guru) | ✅ Phase 0–2 complete |

> The spec driving these builds is defined by this repo; each builder folder is a self-contained implementation of it. Add new builders as their own subfolders.

## Quick start (Berd-Kimi)

```bash
cd Berd-Kimi
pnpm install
pnpm test      # vitest — 11 tests
pnpm demo      # parse all fixtures + a custom-registered plugin
pnpm dev parse tests/fixtures/bank.csv   # CLI
pnpm build     # tsup → dist (ESM + CJS + d.ts)
```

### SDK
```ts
import { parse, parseText, detectType, registerParser, parseBatch } from 'doccrunch';
const result = await parse('./statement.pdf');   // → { meta, payload }
```

### CLI
```bash
doccrunch parse <file> [--type merchant-statement|bank-csv|esb-meter] [--pretty]
```

### MCP server
```bash
node dist/mcp/server.js        # or: tsx src/mcp/server.ts
```
Tools: `parse_document`, `parse_text`, `parse_batch`, `list_types`.

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
| `bank-csv` | bank CSV export | rows + in/out/net summary |
| `esb-meter` | ESB smart-meter CSV | readings[] + import/export totals |

## Extend it (plugin hook)
```ts
registerParser('my-type', { detect, parse, schema });
```
The built-ins register through this same hook — the SDK dogfoods its own API.

## Roadmap
- **P0–P1** ✅ plugin core, 3 text parsers, SDK + CLI
- **P2** ✅ MCP wrapper consuming the SDK
- **P3** vision class (receipt photo / coffee label) via a vision LLM
- More text classes (insurance quotes, PPR transactions)

Not here yet (deliberately): OCR, >3 built-in types, web UI, LLM-based parsing.

## License
MIT
