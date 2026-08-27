import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, parseText } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, 'fixtures');

describe('Merchant Statement Parser', () => {
  it('parses merchant statement fixture and matches expected JSON exactly', async () => {
    const fixturePath = path.join(fixturesDir, 'merchant-statement.txt');
    const expectedRaw = await fs.readFile(
      path.join(fixturesDir, 'merchant-statement-expected.json'),
      'utf-8'
    );
    const expected = JSON.parse(expectedRaw);

    const envelope = await parse(fixturePath);

    expect(envelope.meta.type).toBe('merchant-statement');
    expect(envelope.meta.confidence).toBe('high');
    expect(envelope.meta.parserVersion).toBe('merchant-statement@0.1.0');
    expect(envelope.meta.source).toBe(fixturePath);
    expect(envelope.meta.parsedAt).toBeDefined();

    const payload = envelope.payload;

    // Verify metadata (generatedAt is dynamic, others must match exactly)
    expect(payload.meta.provider).toBe(expected.meta.provider);
    expect(payload.meta.statementPeriodStart).toBe(expected.meta.statementPeriodStart);
    expect(payload.meta.statementPeriodEnd).toBe(expected.meta.statementPeriodEnd);
    expect(payload.meta.merchantId).toBe(expected.meta.merchantId);
    expect(payload.meta.merchantName).toBe(expected.meta.merchantName);
    expect(payload.meta.currency).toBe(expected.meta.currency);
    expect(payload.meta.generatedAt).toBeDefined();
    expect(new Date(payload.meta.generatedAt).toISOString()).toBe(payload.meta.generatedAt);

    // Verify summary totals
    expect(payload.summary).toEqual(expected.summary);

    // Verify line items count & contents
    expect(payload.lineItems).toHaveLength(expected.lineItems.length);
    expect(payload.lineItems).toEqual(expected.lineItems);
  });

  it('parses from raw string content via parseText', async () => {
    const fixtureContent = await fs.readFile(
      path.join(fixturesDir, 'merchant-statement.txt'),
      'utf-8'
    );
    const envelope = await parseText(fixtureContent);

    expect(envelope.meta.type).toBe('merchant-statement');
    expect(envelope.payload.summary.totalVolume).toBe(6525.0);
    expect(envelope.payload.summary.netSettlement).toBe(6479.85);
  });
});
