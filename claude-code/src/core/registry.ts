import type { DocType, ParserDefinition } from './types.js';

const registry = new Map<DocType, ParserDefinition<any>>();

/**
 * The plugin hook. The three built-ins register through this exact function —
 * new document classes need nothing else.
 */
export function registerParser<TPayload>(
  type: DocType,
  definition: ParserDefinition<TPayload>,
): void {
  if (typeof definition?.detect !== 'function') {
    throw new TypeError(`registerParser("${type}"): "detect" must be a function`);
  }
  if (typeof definition?.parse !== 'function') {
    throw new TypeError(`registerParser("${type}"): "parse" must be a function`);
  }
  if (!definition?.schema || typeof (definition.schema as any).safeParse !== 'function') {
    throw new TypeError(`registerParser("${type}"): "schema" must be a Zod schema`);
  }
  registry.set(type, definition as ParserDefinition<any>);
}

export function getParser(type: DocType): ParserDefinition<any> | undefined {
  return registry.get(type);
}

/** Registered types, in registration order (detection walks this order). */
export function listParsers(): DocType[] {
  return [...registry.keys()];
}

/** Remove a parser. Mostly useful for tests and hot-reloading. */
export function unregisterParser(type: DocType): boolean {
  return registry.delete(type);
}

export function parserVersion(type: DocType): string {
  return `${type}@${registry.get(type)?.version ?? '0.0.0'}`;
}
