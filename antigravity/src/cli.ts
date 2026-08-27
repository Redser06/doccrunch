import { Command } from 'commander';
import { parse, parseBatch, detectType } from './index.js';
import fs from 'node:fs/promises';

const program = new Command();

program
  .name('doccrunch')
  .description('Pluggable document-ingestion engine: any doc -> normalized JSON')
  .version('0.1.0');

program
  .command('parse')
  .description('Parse a document file into normalized JSON')
  .argument('<file>', 'Path to file to parse')
  .option('-t, --type <type>', 'Force specific document type (merchant-statement, bank-csv, esb-meter)')
  .option('-p, --pretty', 'Pretty-print JSON output', false)
  .action(async (file: string, options: { type?: string; pretty?: boolean }) => {
    try {
      const envelope = await parse(file, {
        type: options.type,
      });

      const json = options.pretty
        ? JSON.stringify(envelope, null, 2)
        : JSON.stringify(envelope);

      process.stdout.write(json + '\n');
    } catch (err: any) {
      process.stderr.write(`Error: ${err?.message || String(err)}\n`);
      process.exit(1);
    }
  });

program
  .command('detect')
  .description('Sniff and detect the document type of a file')
  .argument('<file>', 'Path to file to inspect')
  .action(async (file: string) => {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const detected = detectType(content, file);
      process.stdout.write(detected + '\n');
    } catch (err: any) {
      process.stderr.write(`Error: ${err?.message || String(err)}\n`);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Parse a directory of document files')
  .argument('<dir>', 'Path to directory')
  .option('-p, --pretty', 'Pretty-print JSON output', false)
  .action(async (dir: string, options: { pretty?: boolean }) => {
    try {
      const results = await parseBatch(dir);
      const json = options.pretty
        ? JSON.stringify(results, null, 2)
        : JSON.stringify(results);

      process.stdout.write(json + '\n');
    } catch (err: any) {
      process.stderr.write(`Error: ${err?.message || String(err)}\n`);
      process.exit(1);
    }
  });

// Run CLI
program.parse(process.argv);
