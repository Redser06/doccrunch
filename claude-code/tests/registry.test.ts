import { z } from 'zod';
import { afterEach, describe, expect, it } from 'vitest';
import {
  detectType,
  getParser,
  listParsers,
  parseText,
  registerParser,
  unregisterParser,
} from '../src/index.js';

const TYPE = 'fake-invoice';

const fakeSchema = z.object({
  invoiceNumber: z.string(),
  total: z.number(),
});

function registerFake() {
  registerParser(TYPE, {
    detect: (input) => input.text.startsWith('FAKE INVOICE'),
    parse: (input) => {
      const [, invoiceNumber = '', total = '0'] = input.text.split('\n');
      return { invoiceNumber, total: Number(total) };
    },
    schema: fakeSchema,
    version: '9.9.9',
    checks: ['text starts with "FAKE INVOICE"'],
  });
}

afterEach(() => {
  unregisterParser(TYPE);
});

describe('registerParser (the plugin hook)', () => {
  it('round-trips a brand-new document class end to end', () => {
    registerFake();
    const doc = 'FAKE INVOICE\nINV-001\n42.5';

    expect(detectType(doc)).toBe(TYPE);

    const envelope = parseText<z.infer<typeof fakeSchema>>(doc, { source: 'inv.txt' });
    expect(envelope.meta).toMatchObject({
      type: TYPE,
      source: 'inv.txt',
      confidence: 'high',
      parserVersion: 'fake-invoice@9.9.9',
    });
    expect(envelope.payload).toEqual({ invoiceNumber: 'INV-001', total: 42.5 });
  });

  it('validates the new class against its own schema', () => {
    registerParser(TYPE, {
      detect: (input) => input.text.startsWith('FAKE INVOICE'),
      parse: () => ({ invoiceNumber: 'INV-001', total: 'not a number' }),
      schema: fakeSchema,
    });
    expect(() => parseText('FAKE INVOICE\n')).toThrow(/failed schema validation/i);
  });

  it('adds the class to the registry and removes it again', () => {
    registerFake();
    expect(listParsers()).toContain(TYPE);
    expect(getParser(TYPE)?.version).toBe('9.9.9');
    expect(unregisterParser(TYPE)).toBe(true);
    expect(listParsers()).not.toContain(TYPE);
  });

  it("surfaces the new class's checks in detection errors", () => {
    registerFake();
    expect(() => detectType('nothing matches this')).toThrow(/text starts with "FAKE INVOICE"/);
  });

  it('rejects malformed plugin definitions', () => {
    expect(() => registerParser(TYPE, { parse: () => ({}), schema: fakeSchema } as any)).toThrow(
      /"detect" must be a function/,
    );
    expect(() => registerParser(TYPE, { detect: () => true, schema: fakeSchema } as any)).toThrow(
      /"parse" must be a function/,
    );
    expect(() =>
      registerParser(TYPE, { detect: () => true, parse: () => ({}), schema: {} } as any),
    ).toThrow(/must be a Zod schema/);
  });

  it('defaults parserVersion when a plugin omits one', () => {
    registerParser(TYPE, {
      detect: (input) => input.text.startsWith('FAKE INVOICE'),
      parse: () => ({ invoiceNumber: 'x', total: 1 }),
      schema: fakeSchema,
    });
    expect(parseText('FAKE INVOICE\n').meta.parserVersion).toBe('fake-invoice@0.0.0');
  });
});
