/**
 * End-to-end tour of the SDK, straight off the TypeScript source.
 *   pnpm demo
 */
import { mkdtemp, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import {
  detectType,
  listParsers,
  parse,
  parseBatch,
  parseText,
  registerParser,
  unregisterParser,
} from '../src/index.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');
const rule = (title: string) => console.log(`\n\x1b[1m${title}\x1b[0m\n${'─'.repeat(64)}`);

rule('1. Registered document classes');
console.log(listParsers().join('\n'));

rule('2. detectType() on each fixture');
for (const file of ['merchant-statement.txt', 'bank.csv', 'esb.csv']) {
  const { readFile } = await import('node:fs/promises');
  console.log(`${file.padEnd(24)} -> ${detectType(await readFile(join(FIXTURES, file), 'utf8'))}`);
}

rule('3. parse() — merchant statement');
const merchant = await parse<any>(join(FIXTURES, 'merchant-statement.txt'));
console.log(JSON.stringify(merchant.meta, null, 2));
console.log('summary:', JSON.stringify(merchant.payload.summary));
console.log('lineItems:', merchant.payload.lineItems.length);

rule('4. parse() — bank CSV and ESB meter CSV');
const bank = await parse<any>(join(FIXTURES, 'bank.csv'));
const esb = await parse<any>(join(FIXTURES, 'esb.csv'));
console.log('bank summary:', JSON.stringify(bank.payload.summary));
console.log('esb  summary:', JSON.stringify(esb.payload.summary));

rule('5. registerParser() — a new class in 8 lines');
registerParser('fake-invoice', {
  detect: (input) => input.text.startsWith('FAKE INVOICE'),
  parse: (input) => ({ invoiceNumber: input.text.split('\n')[1] ?? '', total: 42.5 }),
  schema: z.object({ invoiceNumber: z.string(), total: z.number() }),
  version: '1.0.0',
  checks: ['text starts with "FAKE INVOICE"'],
});
console.log(JSON.stringify(parseText('FAKE INVOICE\nINV-001', { source: 'inv.txt' }), null, 2));
unregisterParser('fake-invoice');

rule('6. parseBatch() — one broken file must not crash the batch');
const dir = await mkdtemp(join(tmpdir(), 'doccrunch-demo-'));
try {
  for (const file of ['merchant-statement.txt', 'bank.csv', 'esb.csv']) {
    await copyFile(join(FIXTURES, file), join(dir, file));
  }
  await writeFile(join(dir, 'broken.txt'), 'not a document DocCrunch knows about');
  for (const entry of await parseBatch(dir)) {
    const status = entry.error ? `\x1b[31mERROR\x1b[0m ${entry.error.split('\n')[0]}` : '\x1b[32mok\x1b[0m';
    console.log(`${entry.meta.source.padEnd(24)} ${entry.meta.type.padEnd(20)} ${entry.meta.confidence.padEnd(7)} ${status}`);
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
console.log();
