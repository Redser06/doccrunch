import { describe, expect, it } from 'vitest';
import { DetectionError, detectType, listParsers, tryDetectType } from '../src/index.js';
import { readFixture } from './helpers.js';

describe('detectType', () => {
  it('classifies the merchant statement from its header text', () => {
    expect(detectType(readFixture('merchant-statement.txt'))).toBe('merchant-statement');
  });

  it('classifies a merchant statement that only says "Merchant Statement"', () => {
    expect(detectType('Merchant Statement\nMerchant ID: 1')).toBe('merchant-statement');
  });

  it('classifies the bank CSV from its Date,Description,Amount header', () => {
    expect(detectType(readFixture('bank.csv'))).toBe('bank-csv');
  });

  it('classifies the ESB CSV from its MPRN header', () => {
    expect(detectType(readFixture('esb.csv'))).toBe('esb-meter');
  });

  it('classifies an ESB CSV with no MPRN column via kWh + Timestamp', () => {
    expect(detectType('Timestamp,Import_kWh,Export_kWh\n2025-07-15T00:00:00Z,0.1,0')).toBe(
      'esb-meter',
    );
  });

  it('does not confuse the two CSV classes', () => {
    expect(detectType(readFixture('bank.csv'))).not.toBe('esb-meter');
    expect(detectType(readFixture('esb.csv'))).not.toBe('bank-csv');
  });

  it('throws a helpful error listing every check tried', () => {
    let thrown: unknown;
    try {
      detectType('hello world, definitely not a document we know');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(DetectionError);
    const error = thrown as DetectionError;
    expect(error.checksTried.length).toBeGreaterThanOrEqual(4);
    expect(error.message).toContain('ELAVON MERCHANT SERVICES');
    expect(error.message).toContain('Date, Description and Amount');
    expect(error.message).toContain('MPRN');
    expect(error.message).toContain('registerParser');
  });

  it('tryDetectType returns undefined instead of throwing', () => {
    expect(tryDetectType('nothing to see here')).toBeUndefined();
  });

  it('registers the three built-ins through the public hook', () => {
    expect(listParsers()).toEqual(
      expect.arrayContaining(['merchant-statement', 'bank-csv', 'esb-meter']),
    );
  });
});
