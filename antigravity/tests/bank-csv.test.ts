import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, parseText } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, 'fixtures');

describe('Bank CSV Parser', () => {
  it('parses bank CSV fixture and matches expected JSON exactly', async () => {
    const fixturePath = path.join(fixturesDir, 'bank.csv');
    const expectedRaw = await fs.readFile(
      path.join(fixturesDir, 'bank-expected.json'),
      'utf-8'
    );
    const expected = JSON.parse(expectedRaw);

    const envelope = await parse(fixturePath);

    expect(envelope.meta.type).toBe('bank-csv');
    expect(envelope.meta.confidence).toBe('high');
    expect(envelope.meta.parserVersion).toBe('bank-csv@0.1.0');
    expect(envelope.meta.source).toBe(fixturePath);

    const payload = envelope.payload;

    expect(payload.currency).toBe(expected.currency);
    expect(payload.summary).toEqual(expected.summary);
    expect(payload.rows).toHaveLength(expected.rows.length);
    expect(payload.rows).toEqual(expected.rows);
  });

  it('parses in-memory CSV text', async () => {
    const csvContent = 'Date,Description,Amount,Balance\n2025-07-01,Test Pay,100.00,500.00\n2025-07-02,Coffee,-5.00,495.00';
    const envelope = await parseText(csvContent);

    expect(envelope.meta.type).toBe('bank-csv');
    expect(envelope.payload.rows).toHaveLength(2);
    expect(envelope.payload.summary.totalIn).toBe(100);
    expect(envelope.payload.summary.totalOut).toBe(5);
    expect(envelope.payload.summary.net).toBe(95);
  });
});
