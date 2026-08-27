import fs from 'node:fs/promises';
import path from 'node:path';
import {
  Envelope,
  ParseOptions,
  ParserPlugin,
  ConfidenceLevel,
} from './core/types.js';
import { getParser, registerParser } from './core/registry.js';
import { detectType, detectTypeWithConfidence } from './core/detect.js';
import { createEnvelope } from './core/envelope.js';
import { extractTextFromPdf } from './pdf/extract-text.js';

// Ensure built-in parsers are registered
import './parsers/index.js';

export * from './core/index.js';
export * from './schemas/index.js';
export * from './parsers/index.js';
export * from './pdf/extract-text.js';

/**
 * Parses raw text content into a normalized Envelope
 */
export async function parseText<T = any>(
  content: string,
  opts?: ParseOptions
): Promise<Envelope<T>> {
  if (typeof content !== 'string') {
    throw new Error('parseText expects string content');
  }

  let type = opts?.type;
  let confidence: ConfidenceLevel = opts?.confidence || 'high';

  if (!type) {
    const detectResult = detectTypeWithConfidence(content, opts?.filename);
    type = detectResult.type;
    confidence = opts?.confidence || detectResult.confidence;
  }

  const parser = getParser<T>(type);
  if (!parser) {
    throw new Error(`No parser registered for type "${type}". Registered parsers: ${Array.from(
      (await import('./core/registry.js')).getAllParsers().keys()
    ).join(', ')}`);
  }

  const source = opts?.source || opts?.filename || 'inline-text';
  const rawPayload = await parser.parse(content, {
    source,
    filename: opts?.filename,
    opts,
  });

  const validatedPayload = parser.schema.parse(rawPayload);

  return createEnvelope<T>({
    type,
    source,
    payload: validatedPayload,
    confidence,
    parserVersion: parser.version || `${type}@0.1.0`,
  });
}

/**
 * Parses a file from the filesystem into a normalized Envelope
 */
export async function parse<T = any>(
  filePath: string,
  opts?: ParseOptions
): Promise<Envelope<T>> {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('parse requires a valid filePath string');
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  const ext = path.extname(resolvedPath).toLowerCase();
  const filename = path.basename(resolvedPath);

  let textContent: string;

  if (ext === '.pdf') {
    const buffer = await fs.readFile(resolvedPath);
    textContent = await extractTextFromPdf(buffer);
  } else {
    textContent = await fs.readFile(resolvedPath, 'utf-8');
  }

  return parseText<T>(textContent, {
    ...opts,
    source: filePath,
    filename,
  });
}

/**
 * Parses all files in a directory into an array of Envelopes.
 * Files that fail to parse will return a low-confidence envelope with an error field instead of crashing.
 */
export async function parseBatch(
  dirPath: string,
  opts?: ParseOptions
): Promise<Array<Envelope<any>>> {
  if (!dirPath || typeof dirPath !== 'string') {
    throw new Error('parseBatch requires a valid dirPath string');
  }

  const resolvedDir = path.resolve(process.cwd(), dirPath);
  const entries = await fs.readdir(resolvedDir, { withFileTypes: true });
  const results: Array<Envelope<any>> = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name.endsWith('.expected.json')) {
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }

    const fullPath = path.join(resolvedDir, entry.name);

    try {
      const envelope = await parse(fullPath, opts);
      results.push(envelope);
    } catch (err: any) {
      results.push(
        createEnvelope({
          type: opts?.type || 'unknown',
          source: fullPath,
          payload: {},
          confidence: 'low',
          parserVersion: 'unknown',
          error: err?.message || String(err),
        })
      );
    }
  }

  return results;
}
