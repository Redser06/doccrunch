import { mkdtemp, writeFile, cp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseBatch } from '../src/index.js';

const FIX = join(__dirname, 'fixtures');

describe('parseBatch', () => {
  it('parses all fixtures and degrades a broken file without crashing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'doccrunch-batch-'));
    for (const f of ['merchant-statement.txt', 'bank.csv', 'esb.csv']) {
      await cp(join(FIX, f), join(dir, f));
    }
    await writeFile(join(dir, 'broken.xyz'), 'this is not a parseable document');

    const results = await parseBatch(dir);
    expect(results).toHaveLength(4);

    const bySource = Object.fromEntries(results.map((r) => [r.meta.source, r]));
    expect(bySource['merchant-statement.txt'].meta.confidence).toBe('high');
    expect(bySource['bank.csv'].meta.confidence).toBe('high');
    expect(bySource['esb.csv'].meta.confidence).toBe('high');

    const broken = bySource['broken.xyz'];
    expect(broken.meta.confidence).toBe('low');
    expect(broken.error).toBeTruthy();
  });
});
