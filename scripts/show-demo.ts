import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { parseText, registerParser, getRegisteredTypes } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Demonstrates the plugin hook: register a trivial new document class.
registerParser('greeting' as any, {
  detect: (c: string) => c.trimStart().startsWith('HELLO'),
  parse: async (c: string) => ({ greeting: c.trim().split('\n')[0] }),
  schema: { parse: (v: unknown) => v } as any,
});

const FIX = join(__dirname, '../tests/fixtures');

console.log('Registered types:', getRegisteredTypes());
console.log('\n--- merchant statement ---');
console.log(JSON.stringify(await parseText(await readFile(join(FIX, 'merchant-statement.txt'), 'utf-8'), { source: 'merchant-statement.txt' }), null, 2));
console.log('\n--- bank csv ---');
console.log(JSON.stringify(await parseText(await readFile(join(FIX, 'bank.csv'), 'utf-8'), { source: 'bank.csv' }), null, 2));
console.log('\n--- esb meter (summary only) ---');
const esb = await parseText(await readFile(join(FIX, 'esb.csv'), 'utf-8'), { source: 'esb.csv' });
console.log(JSON.stringify({ meta: esb.meta, summary: (esb.payload as any).summary, readings: (esb.payload as any).readings.length }, null, 2));
console.log('\n--- custom plugin ("greeting") ---');
console.log(JSON.stringify(await parseText('HELLO there doccrunch', { source: 'inline' }), null, 2));
