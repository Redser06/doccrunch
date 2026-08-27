import { DetectionError, type DocType, type ParserInput } from './types.js';
import { getParser, listParsers } from './registry.js';

function toInput(content: string | ParserInput): ParserInput {
  return typeof content === 'string' ? { text: content } : content;
}

/**
 * Sniff content and return its document class.
 * Walks registered parsers in registration order and returns the first match.
 * @throws {DetectionError} listing every check that was tried.
 */
export function detectType(content: string | ParserInput): DocType {
  const input = toInput(content);
  const checksTried: string[] = [];

  for (const type of listParsers()) {
    const parser = getParser(type);
    if (!parser) continue;
    checksTried.push(
      ...(parser.checks?.map((c) => `${type}: ${c}`) ?? [`${type}: (no checks documented)`]),
    );
    try {
      if (parser.detect(input)) return type;
    } catch {
      // A throwing detector never claims the document; keep walking.
    }
  }

  throw new DetectionError(checksTried);
}

/** Non-throwing variant. Returns `undefined` when nothing matches. */
export function tryDetectType(content: string | ParserInput): DocType | undefined {
  try {
    return detectType(content);
  } catch {
    return undefined;
  }
}
