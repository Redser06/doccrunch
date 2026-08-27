import { ParserPlugin } from './types.js';

const parsers = new Map<string, ParserPlugin<any>>();

export function registerParser<T = any>(type: string, plugin: ParserPlugin<T>): void {
  if (!type || typeof type !== 'string') {
    throw new Error('registerParser requires a non-empty string type');
  }
  if (!plugin || typeof plugin.parse !== 'function' || typeof plugin.detect !== 'function' || !plugin.schema) {
    throw new Error(`Invalid parser plugin for type "${type}". Must supply detect, parse, and schema.`);
  }

  const normalizedPlugin: ParserPlugin<T> = {
    name: plugin.name || type,
    version: plugin.version || `${type}@0.1.0`,
    detect: plugin.detect,
    parse: plugin.parse,
    schema: plugin.schema,
  };

  parsers.set(type, normalizedPlugin);
}

export function getParser<T = any>(type: string): ParserPlugin<T> | undefined {
  return parsers.get(type);
}

export function listParsers(): Array<{ type: string; name?: string; version?: string }> {
  const list: Array<{ type: string; name?: string; version?: string }> = [];
  for (const [type, plugin] of parsers.entries()) {
    list.push({
      type,
      name: plugin.name,
      version: plugin.version,
    });
  }
  return list;
}

export function getAllParsers(): Map<string, ParserPlugin<any>> {
  return parsers;
}

export function unregisterParser(type: string): boolean {
  return parsers.delete(type);
}

export function clearParsers(): void {
  parsers.clear();
}
