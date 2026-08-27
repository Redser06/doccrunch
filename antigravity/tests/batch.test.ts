import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseBatch } from '../src/index.js';

describe('Batch Processing', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doccrunch-batch-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('parses mixed directory and gracefully returns low-confidence error envelope for broken files', async () => {
    // 1. Valid Bank CSV
    const validBankCsv = 'Date,Description,Amount,Balance\n2025-07-01,Shop,10.00,10.00';
    await fs.writeFile(path.join(tempDir, 'valid-bank.csv'), validBankCsv);

    // 2. Valid ESB CSV
    const validEsbCsv = 'MPRN,Timestamp,Import_kWh,Export_kWh,Tariff\n1001,2025-07-15T00:00:00Z,0.5,0.0,night';
    await fs.writeFile(path.join(tempDir, 'valid-esb.csv'), validEsbCsv);

    // 3. Corrupted / Unsupported file
    const corruptedContent = 'UNSUPPORTED_GARBAGE_RANDOM_BYTES_12345';
    await fs.writeFile(path.join(tempDir, 'corrupted.txt'), corruptedContent);

    const batchResults = await parseBatch(tempDir);

    expect(batchResults).toHaveLength(3);

    const successful = batchResults.filter((r) => !r.error);
    const failed = batchResults.filter((r) => !!r.error);

    expect(successful).toHaveLength(2);
    expect(failed).toHaveLength(1);

    const failedItem = failed[0];
    expect(failedItem.meta.confidence).toBe('low');
    expect(failedItem.error).toBeDefined();
    expect(failedItem.error).toMatch(/Could not classify document type/);
    expect(failedItem.payload).toEqual({});
  });
});
