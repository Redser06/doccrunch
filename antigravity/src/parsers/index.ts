import { registerParser } from '../core/registry.js';
import { merchantStatementParser } from './merchant-statement.js';
import { bankCsvParser } from './bank-csv.js';
import { esbMeterParser } from './esb-meter.js';

export { merchantStatementParser } from './merchant-statement.js';
export { bankCsvParser } from './bank-csv.js';
export { esbMeterParser } from './esb-meter.js';

let builtinsRegistered = false;

export function registerBuiltinParsers(): void {
  if (builtinsRegistered) return;
  registerParser('merchant-statement', merchantStatementParser);
  registerParser('bank-csv', bankCsvParser);
  registerParser('esb-meter', esbMeterParser);
  builtinsRegistered = true;
}

// Auto-register built-in parsers on module evaluation
registerBuiltinParsers();
