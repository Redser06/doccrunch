export { detectType } from './detect.js';
export {
  registerParser,
  getParser,
  getRegisteredTypes,
  clearRegistry,
} from './registry.js';
export { wrapEnvelope, wrapError } from './envelope.js';
export type {
  DocumentType,
  ParserShape,
  EnvelopeResult,
  EnvelopeMeta,
  EnvelopeError,
  DetectFn,
  ParseFn,
} from './types.js';
export { DOCUMENT_TYPES } from './types.js';