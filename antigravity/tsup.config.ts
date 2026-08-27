import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      'schemas/index': 'src/schemas/index.ts',
      'parsers/index': 'src/parsers/index.ts',
      'core/index': 'src/core/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
  },
  {
    entry: {
      cli: 'src/cli.ts',
    },
    format: ['esm'],
    banner: {
      js: '#!/usr/bin/env node',
    },
    clean: false,
    sourcemap: true,
  },
]);
