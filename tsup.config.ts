import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    core: 'src/core/index.ts',
    'parsers-merchant-statement': 'src/parsers/merchant-statement.ts',
    'parsers-bank-csv': 'src/parsers/bank-csv.ts',
    'parsers-esb-meter': 'src/parsers/esb-meter.ts',
    schemas: 'src/schemas/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  clean: true,
  treeshake: true,
  banner: {
    js: '// DocCrunch - Document ingestion engine',
  },
});