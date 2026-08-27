import { mkdtemp, rm, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseBatch, type Envelope } from '../src/index.js';
import { fixturePath } from './helpers.js';

let dir: string;
let results: Envelope[];

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'doccrunch-batch-'));
  await copyFile(fixturePath('merchant-statement.txt'), join(dir, 'merchant-statement.txt'));
  await copyFile(fixturePath('bank.csv'), join(dir, 'bank.csv'));
  await copyFile(fixturePath('esb.csv'), join(dir, 'esb.csv'));
  // One unclassifiable file and one structurally broken CSV.
  await writeFile(join(dir, 'broken.txt'), 'this is not a document DocCrunch knows about');
  await writeFile(join(dir, 'broken.csv'), 'Date,Description,Amount\nnot-a-date,oops,abc');
  await writeFile(join(dir, 'ignored.md'), '# not a supported extension');
  results = await parseBatch(dir);
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('parseBatch', () => {
  it('parses every supported file and skips unsupported extensions', () => {
    expect(results.map((r) => r.meta.source)).toEqual([
      'bank.csv',
      'broken.csv',
      'broken.txt',
      'esb.csv',
      'merchant-statement.txt',
    ]);
  });

  it('does not crash on a broken file — it returns a low-confidence entry', () => {
    const broken = results.filter((r) => r.meta.source.startsWith('broken'));
    expect(broken).toHaveLength(2);
    for (const entry of broken) {
      expect(entry.meta.confidence).toBe('low');
      expect(entry.meta.type).toBe('unknown');
      expect(entry.payload).toEqual({});
      expect(entry.error).toBeTruthy();
    }
    expect(broken.find((b) => b.meta.source === 'broken.txt')!.error).toMatch(
      /Could not classify document/,
    );
    expect(broken.find((b) => b.meta.source === 'broken.csv')!.error).toMatch(/Could not parse/);
  });

  it('still returns high-confidence envelopes for the good files', () => {
    const good = results.filter((r) => !r.error);
    expect(good).toHaveLength(3);
    expect(good.map((r) => r.meta.type).sort()).toEqual([
      'bank-csv',
      'esb-meter',
      'merchant-statement',
    ]);
    for (const entry of good) expect(entry.meta.confidence).toBe('high');
  });
});
