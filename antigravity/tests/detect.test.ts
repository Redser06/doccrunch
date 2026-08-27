import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectType, detectTypeWithConfidence } from '../src/core/detect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, 'fixtures');

describe('Document Type Detection', () => {
  it('detects merchant acquiring statements', async () => {
    const content = await fs.readFile(
      path.join(fixturesDir, 'merchant-statement.txt'),
      'utf-8'
    );
    expect(detectType(content)).toBe('merchant-statement');

    const withConfidence = detectTypeWithConfidence(content);
    expect(withConfidence.type).toBe('merchant-statement');
    expect(withConfidence.confidence).toBe('high');
  });

  it('detects bank statement CSVs', async () => {
    const content = await fs.readFile(path.join(fixturesDir, 'bank.csv'), 'utf-8');
    expect(detectType(content)).toBe('bank-csv');

    const withConfidence = detectTypeWithConfidence(content);
    expect(withConfidence.type).toBe('bank-csv');
    expect(withConfidence.confidence).toBe('high');
  });

  it('detects ESB smart meter CSVs', async () => {
    const content = await fs.readFile(path.join(fixturesDir, 'esb.csv'), 'utf-8');
    expect(detectType(content)).toBe('esb-meter');

    const withConfidence = detectTypeWithConfidence(content);
    expect(withConfidence.type).toBe('esb-meter');
    expect(withConfidence.confidence).toBe('high');
  });

  it('throws a helpful diagnostic error when content cannot be classified', () => {
    const invalidText = 'This is some random text with no known document structure.';
    expect(() => detectType(invalidText)).toThrowError(/Could not classify document type/);
    expect(() => detectType(invalidText)).toThrowError(/merchant-statement/);
    expect(() => detectType(invalidText)).toThrowError(/bank-csv/);
    expect(() => detectType(invalidText)).toThrowError(/esb-meter/);
  });
});
