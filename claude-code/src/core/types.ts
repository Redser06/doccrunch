import type { ZodTypeAny } from 'zod';

/** Confidence the core (or a parser) has in a result. */
export type Confidence = 'high' | 'medium' | 'low';

/**
 * Built-in document classes. Kept open (`string & {}`) because `registerParser`
 * lets downstream projects add classes the core has never heard of.
 */
export type DocType =
  | 'merchant-statement'
  | 'bank-csv'
  | 'esb-meter'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

/** Everything a parser is handed. */
export interface ParserInput {
  /** Raw text content of the document (PDFs are extracted to text first). */
  text: string;
  /** Filename / provenance, if known. */
  source?: string;
}

/** What a parser plugin registers with the core. */
export interface ParserDefinition<TPayload = unknown> {
  /** Cheap content sniff. Return true if this parser claims the document. */
  detect: (input: ParserInput) => boolean;
  /** Turn raw content into the class-specific payload. */
  parse: (input: ParserInput) => TPayload;
  /** Zod schema for the payload. The core validates every payload against it. */
  schema: ZodTypeAny;
  /** Version stamped into `meta.parserVersion` (defaults to `0.0.0`). */
  version?: string;
  /**
   * Human-readable description of what `detect` looks for. Surfaced in the
   * error `detectType` throws when nothing matches.
   */
  checks?: string[];
  /** Optional per-result confidence. Defaults to `high` when the payload validates. */
  confidence?: (payload: TPayload, input: ParserInput) => Confidence;
  /** Optional non-fatal notes (e.g. stated totals disagreeing with line items). */
  warnings?: (payload: TPayload, input: ParserInput) => string[];
}

/** The normalized envelope every parse returns. */
export interface Envelope<TPayload = unknown> {
  meta: {
    type: DocType;
    /** filename / provenance */
    source: string;
    /** ISO datetime */
    parsedAt: string;
    confidence: Confidence;
    /** e.g. `merchant-statement@0.1.0` */
    parserVersion: string;
  };
  payload: TPayload;
  /** Non-fatal notes from the parser. Omitted when there are none. */
  warnings?: string[];
  /** Present only on failed entries from `parseBatch`. */
  error?: string;
}

export interface ParseTextOptions {
  /** Skip detection and force a document class. */
  type?: DocType;
  /** Provenance recorded in `meta.source`. */
  source?: string;
}

/** Thrown when content cannot be classified. Lists every check that was tried. */
export class DetectionError extends Error {
  readonly checksTried: string[];
  constructor(checksTried: string[]) {
    super(
      `Could not classify document. Checks tried:\n` +
        checksTried.map((c) => `  - ${c}`).join('\n') +
        `\nHint: pass an explicit type (parseText(text, { type }) / --type) or ` +
        `register a parser for this class with registerParser().`,
    );
    this.name = 'DetectionError';
    this.checksTried = checksTried;
  }
}

/** Thrown when a payload fails its Zod schema. */
export class SchemaValidationError extends Error {
  readonly type: DocType;
  readonly issues: unknown;
  constructor(type: DocType, issues: unknown, message: string) {
    super(`Payload for "${type}" failed schema validation: ${message}`);
    this.name = 'SchemaValidationError';
    this.type = type;
    this.issues = issues;
  }
}
