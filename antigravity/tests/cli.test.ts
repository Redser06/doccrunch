import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const fixturesDir = path.resolve(__dirname, 'fixtures');

describe('CLI Integration', () => {
  it('executes doccrunch parse via tsx on merchant-statement fixture', async () => {
    const cliPath = path.resolve(projectRoot, 'src/cli.ts');
    const fixturePath = path.resolve(fixturesDir, 'merchant-statement.txt');

    const { stdout } = await execFileAsync('npx', [
      'tsx',
      cliPath,
      'parse',
      fixturePath,
    ]);

    const parsed = JSON.parse(stdout.trim());
    expect(parsed.meta.type).toBe('merchant-statement');
    expect(parsed.payload.summary.netSettlement).toBe(6479.85);
  });

  it('executes doccrunch parse with --pretty flag on bank.csv', async () => {
    const cliPath = path.resolve(projectRoot, 'src/cli.ts');
    const fixturePath = path.resolve(fixturesDir, 'bank.csv');

    const { stdout } = await execFileAsync('npx', [
      'tsx',
      cliPath,
      'parse',
      fixturePath,
      '--pretty',
    ]);

    expect(stdout).toContain('\n');
    const parsed = JSON.parse(stdout);
    expect(parsed.meta.type).toBe('bank-csv');
    expect(parsed.payload.summary.totalIn).toBe(4065.11);
  });

  it('executes doccrunch detect on esb.csv', async () => {
    const cliPath = path.resolve(projectRoot, 'src/cli.ts');
    const fixturePath = path.resolve(fixturesDir, 'esb.csv');

    const { stdout } = await execFileAsync('npx', [
      'tsx',
      cliPath,
      'detect',
      fixturePath,
    ]);

    expect(stdout.trim()).toBe('esb-meter');
  });
});
