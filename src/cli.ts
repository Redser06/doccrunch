#!/usr/bin/env node
// DocCrunch CLI - doccrunch parse <file> [--type X] [--pretty]

import { readFile } from 'node:fs/promises';
import { program } from 'commander';

import { parseText } from './index.js';
import type { DocumentType } from './core/types.js';

program
  .name('doccrunch')
  .description('Document ingestion engine: any doc → normalized JSON')
  .version('0.1.0');

program
  .command('parse <file>')
  .description('Parse a document file and emit validated JSON')
  .option(
    '--type <type>',
    'Force document type: merchant-statement | bank-csv | esb-meter',
  )
  .option('--pretty', 'Pretty-print JSON output', false)
  .action(async (file: string, opts: { type?: string; pretty?: boolean }) => {
    try {
      const content = await readFile(file, 'utf-8');
      const parseOpts = opts.type
        ? { type: opts.type as DocumentType }
        : undefined;

      const result = await parseText(content, { ...parseOpts, source: file });

      const json = opts.pretty
        ? JSON.stringify(result, null, 2)
        : JSON.stringify(result);

      process.stdout.write(json + '\n');
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });

// MCP server stub (not built in Phase 0-1)
// program.command('serve').description('Start MCP server').action(() => {
//   console.error('MCP server not yet implemented');
//   process.exit(1);
// });

program.parse();