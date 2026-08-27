# DocCrunch 📄⚡

> A TypeScript document-ingestion engine with a pluggable architecture: **Any Doc → Normalized JSON**.

This repository contains the **DocCrunch** document ingestion engine, organized for bake-offs and modular evaluations.

---

## Repository Structure

```
.
├── README.md               # Top-level repository overview
└── antigravity/            # DocCrunch implementation by Google Antigravity
    ├── src/                # Core engine, parsers, schemas, CLI
    ├── tests/              # Vitest test suite and exact fixtures
    ├── scripts/            # Demo and local interactive Web UI server
    ├── package.json
    ├── tsconfig.json
    ├── tsup.config.ts
    ├── vitest.config.ts
    └── README.md           # Detailed engine documentation & SDK reference
```

---

## Quick Start (`antigravity/`)

```bash
cd antigravity

# Install dependencies
pnpm install

# Run the full test suite (20/20 passing tests)
pnpm test

# Build dual ESM + CJS packages
pnpm build

# Run end-to-end demo
pnpm demo

# Launch the interactive Web UI studio
pnpm ui
```

---

## Key Features

- 🔌 **Pluggable Architecture**: Built-in parsers (`merchant-statement`, `bank-csv`, `esb-meter`) dogfood the exact same `registerParser()` hook available to external callers.
- 🛡️ **Strict Runtime Validation**: Class-specific Zod schemas validate every payload before envelope wrapping.
- 📦 **Normalized Envelope**: Uniform metadata structure (`type`, `source`, `parsedAt`, `confidence`, `parserVersion`) wrapping class-specific payloads.
- ⚡ **100% Deterministic**: Zero external network or LLM dependencies.
- 🖥️ **Dual SDK, CLI & Web UI**:
  - SDK: `import { parse, parseText, detectType, registerParser, parseBatch } from 'doccrunch'`
  - CLI: `doccrunch parse <file> [--type <type>] [--pretty]`
  - Web UI: Interactive browser testing studio at `http://localhost:3456`
