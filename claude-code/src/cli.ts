#!/usr/bin/env node
import { Command } from 'commander';

import { detectType } from './core/detect.js';
import { listParsers } from './core/registry.js';
import { parse, parseBatch } from './index.js';

const program = new Command();

function emit(value: unknown, pretty: boolean): void {
  process.stdout.write(JSON.stringify(value, null, pretty ? 2 : 0) + '\n');
}

function fail(error: unknown): never {
  process.stderr.write(`doccrunch: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

program
  .name('doccrunch')
  .description('Any doc -> normalized JSON')
  .version('0.1.0');

program
  .command('parse', { isDefault: true })
  .argument('<file>', 'file to parse')
  .option('-t, --type <type>', `force a document class (${listParsers().join(' | ')})`)
  .option('-p, --pretty', 'pretty-print the JSON', false)
  .description('parse a file and print the normalized envelope as JSON')
  .action(async (file: string, opts: { type?: string; pretty: boolean }) => {
    try {
      emit(await parse(file, { type: opts.type }), opts.pretty);
    } catch (error) {
      fail(error);
    }
  });

program
  .command('detect')
  .argument('<file>', 'file to classify')
  .option('-p, --pretty', 'pretty-print the JSON', false)
  .description('print the detected document class without parsing')
  .action(async (file: string, opts: { pretty: boolean }) => {
    try {
      const { readFile } = await import('node:fs/promises');
      const text = await readFile(file, 'utf8');
      emit({ file, type: detectType({ text, source: file }) }, opts.pretty);
    } catch (error) {
      fail(error);
    }
  });

program
  .command('batch')
  .argument('<dir>', 'folder to parse')
  .option('-p, --pretty', 'pretty-print the JSON', false)
  .description('parse every supported file in a folder (failures become low-confidence entries)')
  .action(async (dir: string, opts: { pretty: boolean }) => {
    try {
      emit(await parseBatch(dir), opts.pretty);
    } catch (error) {
      fail(error);
    }
  });

program
  .command('types')
  .description('list registered document classes')
  .action(() => {
    process.stdout.write(listParsers().join('\n') + '\n');
  });

program.parseAsync(process.argv).catch(fail);
