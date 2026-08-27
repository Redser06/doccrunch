# DocCrunch

Any doc → normalized JSON. A TypeScript ingestion engine where every document
class is a self-contained parser plugged into a shared core.

Phase 0–1 wedge: **merchant acquiring statements** (PDF text), **bank CSVs**, and
**ESB smart-meter CSVs**.

```bash
pnpm install
pnpm test        # 49 tests
pnpm build       # ESM + CJS + .d.ts
pnpm demo        # guided tour of the SDK
pnpm verify      # manual-verification UI on http://localhost:4319
```

## SDK

```ts
import { parse, parseText, parseBatch, detectType, registerParser } from 'doccrunch';

const envelope = await parse('statement.pdf');          // read file → detect → parse → validate
const fromString = parseText(csvText, { source: 'x' }); // same, for raw content
const all = await parseBatch('./inbox');                // never throws; failures become entries
detectType(csvText);                                    // 'bank-csv'
```

Sub-path imports: `doccrunch/core`, `doccrunch/schemas`, `doccrunch/parsers`.

## CLI

```bash
doccrunch parse tests/fixtures/bank.csv --pretty
doccrunch parse statement.pdf --type merchant-statement
doccrunch detect tests/fixtures/esb.csv
doccrunch batch ./inbox --pretty
doccrunch types
```

Valid JSON on stdout, errors on stderr with exit code 1.

## The envelope

Every parse returns the same wrapper; only `payload` changes shape by class.

```jsonc
{
  "meta": {
    "type": "bank-csv",
    "source": "bank.csv",
    "parsedAt": "2025-07-21T09:14:02.113Z",
    "confidence": "high",              // high | medium | low
    "parserVersion": "bank-csv@0.1.0"
  },
  "payload": { /* class-specific, Zod-validated */ },
  "warnings": ["…"],                   // optional, non-fatal reconciliation notes
  "error": "…"                         // only on failed parseBatch entries
}
```

`meta.type` is a plain string, not a closed enum — `registerParser` lets a project
add classes the core has never heard of.

## Adding a document class

The three built-ins register through the same public hook a downstream project uses.
Nothing else in the core knows they exist.

```ts
import { z } from 'zod';
import { registerParser, parseText } from 'doccrunch';

registerParser('fake-invoice', {
  detect: (input) => input.text.startsWith('FAKE INVOICE'),
  parse: (input) => ({ invoiceNumber: input.text.split('\n')[1], total: 42.5 }),
  schema: z.object({ invoiceNumber: z.string(), total: z.number() }),
  version: '1.0.0',
  checks: ['text starts with "FAKE INVOICE"'],   // shown in detection errors
});

parseText('FAKE INVOICE\nINV-001'); // → envelope with parserVersion fake-invoice@1.0.0
```

Optional hooks: `confidence(payload, input)` and `warnings(payload, input)` let a
parser downgrade its own result instead of failing outright — used by all three
built-ins for reconciliation checks.

## Architecture

```
src/
├── index.ts              parse / parseText / parseBatch + public surface
├── cli.ts                commander CLI
├── core/
│   ├── types.ts          envelope, plugin contract, typed errors
│   ├── registry.ts       registerParser + lookup (the only extension point)
│   ├── detect.ts         content sniffing; throws listing every check tried
│   └── envelope.ts       run parser → validate → wrap
├── pdf/extract-text.ts   unpdf wrapper, lazily imported
├── parsers/              merchant-statement · bank-csv · esb-meter · util
└── schemas/              envelope + one Zod schema per class
```

Detection walks registered parsers in registration order and returns the first
claim. When nothing matches, the error lists every check that ran:

```
Could not classify document. Checks tried:
  - merchant-statement: text contains "ELAVON MERCHANT SERVICES"
  - merchant-statement: text contains "Merchant Statement"
  - bank-csv: CSV header includes Date, Description and Amount columns
  - esb-meter: CSV header includes an MPRN column
  - esb-meter: CSV header includes both a kWh column and a Timestamp column
Hint: pass an explicit type (parseText(text, { type }) / --type) or register a
parser for this class with registerParser().
```

Parsing is deterministic — regex, `csv-parse`, and arithmetic. No LLM calls, no
network, no OCR. An MCP server is out of scope for this phase (see the stub
comment at the bottom of `src/index.ts`).

## Verification UI

`pnpm verify` serves a zero-dependency console at <http://localhost:4319> for
eyeballing the engine by hand:

- pick a fixture (or paste/drop your own document) and parse it live
- **field-by-field diff** against the spec's expected JSON — 315 leaf fields, each
  marked `match` / `mismatch` / `known-spec-error` / `dynamic`
- the full envelope JSON, plus detected type, confidence and parser warnings
- edit the document in place and re-parse to watch detection, warnings and
  confidence react

It lives in `ui/`, outside `src/`, so the shipped package stays a library + CLI.

## Fixture arithmetic: four values in the spec don't add up

Every field DocCrunch produces matches the bake-off spec's expected JSON **except
four summary numbers, where the spec disagrees with its own fixture rows.**
DocCrunch computes the arithmetically correct value and flags the gap rather than
hardcoding the spec's figure. The details live in
`tests/fixtures/known-discrepancies.json`, are pinned by
`tests/spec-discrepancies.test.ts`, and are surfaced inline in the UI.

| Fixture | Field | Spec says | Fixture rows give |
|---|---|---|---|
| `bank-expected.json` | `summary.totalOut` | 1334.61 | **1274.61** |
| `bank-expected.json` | `summary.net` | 2730.50 | **2790.50** |
| `esb-expected.json` | `summary.totalImport_kwh` | 13.05 | **13.71** |
| `esb-expected.json` | `summary.totalExport_kwh` | 4.72 | **6.29** |

- Bank debits in `bank.csv`: `84.23 + 120.40 + 12.99 + 60.00 + 980.50 + 9.99 + 6.50 = 1274.61`.
  The spec's `totalOut` is exactly 60.00 too high, and its `net` inherits the error.
  2790.50 is also the closing figure in the fixture's own `Balance` column.
- ESB: the 48 `Import_kWh` values sum to 13.71 and the 48 `Export_kWh` values to 6.29.

The merchant statement, by contrast, reconciles perfectly — volume minus fees
equals the stated net settlement to the cent — and matches field for field.

## Notes and assumptions

- **Currency.** The merchant schema pins `EUR`; the fixture carries no currency
  marker, so the parser asserts it. The bank parser reads a `Currency` column or a
  `€`/`$`/`£` symbol when present and otherwise defaults to `EUR`.
- **Dates.** `YYYY-MM-DD`, `01 July 2025`, and day-first `01/07/2025` all normalize
  to ISO. Timestamps normalize to second-precision UTC (`2025-07-15T00:00:00Z`),
  deliberately avoiding `toISOString()`'s `.000` milliseconds.
- **Money.** Amounts are rounded to 2dp symmetrically around zero, so sums of
  half-hourly readings don't drift (`13.71`, not `13.709999999999997`).
- **Reconciliation.** Each parser cross-checks what the document asserts against
  what its rows compute. A mismatch produces a `warning` and drops confidence to
  `medium` — it never silently rewrites the document's own numbers.
- **PDFs.** `unpdf` is imported lazily, so CSV parsing never loads a PDF engine.
  The merchant fixture is plain text and exercises the same code path from
  `parseText` onward.
