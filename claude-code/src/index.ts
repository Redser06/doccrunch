import { readFile, readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

import { detectType } from './core/detect.js';
import { errorEnvelope, runParser } from './core/envelope.js';
import type { DocType, Envelope, ParseTextOptions } from './core/types.js';
import { extractTextFromPdf, looksLikePdf } from './pdf/extract-text.js';

// Registers the three built-ins through the public plugin hook.
import './parsers/index.js';

export { registerParser, getParser, listParsers, unregisterParser } from './core/registry.js';
export { detectType, tryDetectType } from './core/detect.js';
export { DetectionError, SchemaValidationError } from './core/types.js';
export type {
  Confidence,
  DocType,
  Envelope,
  ParserDefinition,
  ParserInput,
  ParseTextOptions,
} from './core/types.js';
export * from './schemas/index.js';
export { extractTextFromPdf } from './pdf/extract-text.js';

/** File extensions `parseBatch` will attempt. */
export const SUPPORTED_EXTENSIONS = ['.txt', '.csv', '.pdf', '.text'] as const;

/** Parse raw string content: detect (unless `type` is given), route, wrap, validate. */
export function parseText<TPayload = unknown>(
  text: string,
  opts: ParseTextOptions = {},
): Envelope<TPayload> {
  const input = { text, source: opts.source ?? '<inline>' };
  const type: DocType = opts.type ?? detectType(input);
  return runParser<TPayload>(type, input);
}

/** Read a file (PDFs are extracted to text first), then parse it. */
export async function parse<TPayload = unknown>(
  filePath: string,
  opts: Omit<ParseTextOptions, 'source'> & { source?: string } = {},
): Promise<Envelope<TPayload>> {
  const bytes = await readFile(filePath);
  const isPdf = extname(filePath).toLowerCase() === '.pdf' || looksLikePdf(bytes);
  const text = isPdf ? await extractTextFromPdf(new Uint8Array(bytes)) : bytes.toString('utf8');
  return parseText<TPayload>(text, { ...opts, source: opts.source ?? basename(filePath) });
}

/**
 * Parse every supported file in a folder. A file that fails to parse becomes a
 * low-confidence envelope carrying an `error` — the batch never crashes.
 * Results are sorted by filename for determinism.
 */
export async function parseBatch(dir: string): Promise<Envelope[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && (SUPPORTED_EXTENSIONS as readonly string[]).includes(extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort();

  const results: Envelope[] = [];
  for (const name of files) {
    try {
      results.push(await parse(join(dir, name)));
    } catch (error) {
      results.push(errorEnvelope(name, error));
    }
  }
  return results;
}

// MCP server: intentionally out of scope for phase 0-1. A future `src/mcp/`
// would expose parse/parseBatch as tools over the same registry.
