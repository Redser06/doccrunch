/**
 * DocCrunch verification UI — a zero-dependency local server for eyeballing what
 * the engine produces and diffing it against the bake-off spec's expected JSON.
 *
 *   pnpm verify            # http://localhost:4173
 *
 * Deliberately outside the shipped package: `src/` stays a pure library + CLI.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listParsers, parseText, tryDetectType } from '../src/index.js';
import { compareToExpected, DISCREPANCY_DOC } from './compare.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'tests', 'fixtures');
const PORT = Number(process.env.PORT ?? 4319);
const MAX_PORT_ATTEMPTS = 10;

const FIXTURE_SET = [
  {
    id: 'merchant-statement',
    label: 'Merchant statement',
    sub: 'Elavon · PDF text',
    file: 'merchant-statement.txt',
    expectedFile: 'merchant-statement-expected.json',
  },
  {
    id: 'bank-csv',
    label: 'Bank statement',
    sub: 'CSV · 10 rows',
    file: 'bank.csv',
    expectedFile: 'bank-expected.json',
  },
  {
    id: 'esb-meter',
    label: 'ESB smart meter',
    sub: 'CSV · 48 half-hourly reads',
    file: 'esb.csv',
    expectedFile: 'esb-expected.json',
  },
] as const;

async function loadFixtures() {
  return Promise.all(
    FIXTURE_SET.map(async (f) => ({
      ...f,
      content: await readFile(join(FIXTURES, f.file), 'utf8'),
      expected: JSON.parse(await readFile(join(FIXTURES, f.expectedFile), 'utf8')),
    })),
  );
}

function parseOne(text: string, type: string | undefined, source: string) {
  try {
    const envelope = parseText(text, { ...(type ? { type } : {}), source });
    return { ok: true as const, envelope };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Error',
    };
  }
}

async function runAll() {
  const fixtures = await loadFixtures();
  return fixtures.map((f) => {
    const result = parseOne(f.content, undefined, f.file);
    if (!result.ok) {
      return { id: f.id, label: f.label, pass: false, error: result.error, fields: [], counts: {} };
    }
    const diff = compareToExpected(result.envelope.payload, f.expected, f.expectedFile);
    return {
      id: f.id,
      label: f.label,
      detectedType: result.envelope.meta.type,
      confidence: result.envelope.meta.confidence,
      warnings: result.envelope.warnings ?? [],
      envelope: result.envelope,
      ...diff,
    };
  });
}

function json(res: import('node:http').ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 5_000_000) reject(new Error('Request body too large (limit 5 MB)'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const html = await readFile(join(HERE, 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }

    if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
      return json(res, 200, {
        fixtures: await loadFixtures(),
        types: listParsers(),
        discrepancies: DISCREPANCY_DOC,
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/verify') {
      return json(res, 200, { results: await runAll() });
    }

    if (req.method === 'POST' && url.pathname === '/api/parse') {
      const body = JSON.parse((await readBody(req)) || '{}') as {
        text?: string;
        type?: string;
        source?: string;
        expectedFile?: string;
      };
      const text = body.text ?? '';
      const result = parseOne(text, body.type || undefined, body.source || '<pasted>');
      const detected = tryDetectType(text) ?? null;

      let diff = null;
      if (result.ok && body.expectedFile) {
        const expected = JSON.parse(await readFile(join(FIXTURES, body.expectedFile), 'utf8'));
        diff = compareToExpected(result.envelope.payload, expected, body.expectedFile);
      }
      return json(res, 200, { ...result, detected, diff });
    }

    return json(res, 404, { error: `No route for ${req.method} ${url.pathname}` });
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

/** Walk forward a few ports so a busy dev port never blocks the console. */
function listen(port: number, attempt = 0): void {
  const onError = (error: NodeJS.ErrnoException) => {
    server.off('listening', onListening);
    if (error.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      process.stdout.write(`  port ${port} is busy, trying ${port + 1}\n`);
      return listen(port + 1, attempt + 1);
    }
    throw error;
  };
  const onListening = () => {
    server.off('error', onError);
    process.stdout.write(`\n  DocCrunch verification UI  ->  http://localhost:${port}\n\n`);
  };

  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port, '127.0.0.1');
}

listen(PORT);
