import { describe, expect, it } from 'vitest';
import { envelopeSchema, parseText, SchemaValidationError } from '../src/index.js';
import { readFixture } from './helpers.js';

describe('normalized envelope', () => {
  it('validates against the envelope schema for every class', () => {
    for (const fixture of ['merchant-statement.txt', 'bank.csv', 'esb.csv']) {
      const envelope = parseText(readFixture(fixture), { source: fixture });
      expect(() => envelopeSchema.parse(envelope)).not.toThrow();
      expect(Object.keys(envelope.meta).sort()).toEqual([
        'confidence',
        'parsedAt',
        'parserVersion',
        'source',
        'type',
      ]);
    }
  });

  it('defaults source to <inline> for raw string content', () => {
    expect(parseText(readFixture('bank.csv')).meta.source).toBe('<inline>');
  });

  it('throws SchemaValidationError with the failing issues attached', () => {
    let thrown: unknown;
    try {
      parseText('MPRN,Timestamp,Import_kWh\n1,2025-07-15T00:00:00Z,-1');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SchemaValidationError);
    expect((thrown as SchemaValidationError).type).toBe('esb-meter');
    expect((thrown as SchemaValidationError).issues).toBeTruthy();
  });

  it('honours an explicit type override, skipping detection', () => {
    // Bank-shaped content that detection would happily classify anyway —
    // forcing the wrong parser proves the override is doing the routing.
    expect(() => parseText(readFixture('bank.csv'), { type: 'esb-meter' })).toThrow(
      /missing Timestamp/,
    );
  });

  it('reports unknown types clearly', () => {
    expect(() => parseText('anything', { type: 'nope' })).toThrow(/No parser registered/);
  });
});
