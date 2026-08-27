import type { DocumentType, ParserShape } from './types.js';

const registry = new Map<DocumentType, ParserShape>();

export function registerParser(type: DocumentType, parser: ParserShape): void {
  registry.set(type, parser);
}

export function getParser(type: DocumentType): ParserShape | undefined {
  return registry.get(type);
}

export function getRegisteredTypes(): DocumentType[] {
  return Array.from(registry.keys());
}

export function clearRegistry(): void {
  registry.clear();
}