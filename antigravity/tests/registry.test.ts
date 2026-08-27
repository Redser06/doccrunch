import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  registerParser,
  getParser,
  listParsers,
  detectType,
  parseText,
  registerBuiltinParsers,
} from '../src/index.js';

describe('Parser Registry & Plugin Hook', () => {
  beforeEach(() => {
    registerBuiltinParsers();
  });

  it('lists built-in parsers registered through the hook', () => {
    const list = listParsers();
    const types = list.map((p) => p.type);
    expect(types).toContain('merchant-statement');
    expect(types).toContain('bank-csv');
    expect(types).toContain('esb-meter');
  });

  it('registers and round-trips a custom plugin parser end-to-end', async () => {
    const CustomRecipeSchema = z.object({
      recipeTitle: z.string(),
      servings: z.number().int(),
      ingredients: z.array(z.string()),
    });

    type CustomRecipe = z.infer<typeof CustomRecipeSchema>;

    registerParser<CustomRecipe>('custom-recipe', {
      name: 'custom-recipe',
      version: 'custom-recipe@0.2.0',
      detect: (content: string) => content.includes('RECIPE_HEADER:'),
      parse: (content: string) => {
        const lines = content.split('\n').map((l) => l.trim());
        const titleLine = lines.find((l) => l.startsWith('TITLE:')) || 'TITLE: Untitled';
        const servingsLine = lines.find((l) => l.startsWith('SERVINGS:')) || 'SERVINGS: 1';
        const ingredients = lines
          .filter((l) => l.startsWith('- '))
          .map((l) => l.slice(2).trim());

        return {
          recipeTitle: titleLine.replace('TITLE:', '').trim(),
          servings: parseInt(servingsLine.replace('SERVINGS:', '').trim(), 10),
          ingredients,
        };
      },
      schema: CustomRecipeSchema,
    });

    expect(getParser('custom-recipe')).toBeDefined();

    const sampleDoc = `RECIPE_HEADER: TRUE\nTITLE: Irish Soda Bread\nSERVINGS: 8\n- Flour\n- Buttermilk\n- Baking Soda\n- Salt`;

    expect(detectType(sampleDoc)).toBe('custom-recipe');

    const envelope = await parseText<CustomRecipe>(sampleDoc);

    expect(envelope.meta.type).toBe('custom-recipe');
    expect(envelope.meta.parserVersion).toBe('custom-recipe@0.2.0');
    expect(envelope.meta.confidence).toBe('high');
    expect(envelope.payload.recipeTitle).toBe('Irish Soda Bread');
    expect(envelope.payload.servings).toBe(8);
    expect(envelope.payload.ingredients).toEqual([
      'Flour',
      'Buttermilk',
      'Baking Soda',
      'Salt',
    ]);
  });
});
