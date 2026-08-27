import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseText,
  detectTypeWithConfidence,
  listParsers,
  extractTextFromPdf,
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../tests/fixtures');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3456;

async function getFixtures() {
  const merchantText = await fs.readFile(
    path.join(fixturesDir, 'merchant-statement.txt'),
    'utf-8'
  );
  const bankCsv = await fs.readFile(path.join(fixturesDir, 'bank.csv'), 'utf-8');
  const esbCsv = await fs.readFile(path.join(fixturesDir, 'esb.csv'), 'utf-8');

  return {
    'merchant-statement': merchantText,
    'bank-csv': bankCsv,
    'esb-meter': esbCsv,
  };
}

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DocCrunch — Document Ingestion Engine</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --heading: #f0f6fc;
      --accent: #2f81f7;
      --accent-hover: #388bfd;
      --success: #3fb950;
      --warning: #d29922;
      --error: #f85149;
      --code-bg: #0a0c10;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 24px; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; }
    header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
    h1 { color: var(--heading); font-size: 22px; display: flex; align-items: center; gap: 8px; }
    .badge { font-size: 12px; padding: 3px 8px; border-radius: 12px; font-weight: 600; }
    .badge-blue { background: rgba(56, 139, 253, 0.15); color: #58a6ff; border: 1px solid rgba(56, 139, 253, 0.4); }
    .badge-green { background: rgba(63, 185, 80, 0.15); color: #56d364; border: 1px solid rgba(63, 185, 80, 0.4); }
    .badge-orange { background: rgba(210, 153, 34, 0.15); color: #e3b341; border: 1px solid rgba(210, 153, 34, 0.4); }
    .layout { display: grid; grid-template-columns: 1fr 1.1fr; gap: 24px; }
    @media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
    .card-title { font-size: 15px; font-weight: 600; color: var(--heading); margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
    .presets { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .btn { background: #21262d; color: var(--heading); border: 1px solid var(--border); padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s ease; }
    .btn:hover { background: #30363d; border-color: #8b949e; }
    .btn-primary { background: #238636; border-color: rgba(240, 246, 252, 0.1); color: #fff; font-weight: 600; }
    .btn-primary:hover { background: #2ea043; }
    .dropzone { border: 2px dashed var(--border); border-radius: 6px; padding: 16px; text-align: center; margin-bottom: 14px; cursor: pointer; transition: border-color 0.2s; }
    .dropzone:hover, .dropzone.dragover { border-color: var(--accent); background: rgba(56, 139, 253, 0.05); }
    textarea { width: 100%; height: 280px; background: var(--code-bg); color: #7ee787; border: 1px solid var(--border); border-radius: 6px; padding: 12px; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; font-size: 13px; resize: vertical; margin-bottom: 14px; }
    .actions { display: flex; align-items: center; justify-content: space-between; }
    .status-bar { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .json-viewer { background: var(--code-bg); border: 1px solid var(--border); border-radius: 6px; padding: 14px; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; font-size: 13px; color: #e6edf3; max-height: 480px; overflow: auto; white-space: pre; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 16px; }
    .metric-box { background: #0d1117; border: 1px solid var(--border); border-radius: 6px; padding: 12px; }
    .metric-label { font-size: 11px; text-transform: uppercase; color: #8b949e; letter-spacing: 0.5px; margin-bottom: 4px; }
    .metric-val { font-size: 18px; font-weight: 700; color: var(--heading); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1><span>📄⚡</span> DocCrunch Interactive Testing Studio</h1>
      <div style="display: flex; gap: 8px; align-items: center;">
        <span class="badge badge-blue">Pluggable Engine v0.1.0</span>
        <span class="badge badge-green">100% Deterministic</span>
      </div>
    </header>

    <div class="layout">
      <!-- Input Panel -->
      <div class="card">
        <div class="card-title">
          <span>Input Document</span>
          <span id="detectedTypeBadge" class="badge badge-orange" style="display: none;">Sniffing...</span>
        </div>

        <div class="presets">
          <button class="btn" onclick="loadFixture('merchant-statement')">💳 Merchant Statement</button>
          <button class="btn" onclick="loadFixture('bank-csv')">🏦 Bank CSV</button>
          <button class="btn" onclick="loadFixture('esb-meter')">⚡ ESB Smart Meter</button>
        </div>

        <div class="dropzone" id="dropzone" onclick="document.getElementById('fileInput').click()">
          <span id="dropzoneText">📁 Click or Drag & Drop File (.txt, .csv, .pdf)</span>
          <input type="file" id="fileInput" style="display: none;" onchange="handleFile(event)">
        </div>

        <textarea id="rawContent" placeholder="Paste statement text or CSV rows here..."></textarea>

        <div class="actions">
          <button class="btn" onclick="document.getElementById('rawContent').value = ''; updateDetection();">Clear</button>
          <button class="btn btn-primary" onclick="runParse()">⚡ Parse Document</button>
        </div>
      </div>

      <!-- Output Panel -->
      <div class="card">
        <div class="card-title">
          <span>Normalized Envelope & Visual Summary</span>
          <button class="btn" style="padding: 4px 10px; font-size: 12px;" onclick="copyJson()">Copy JSON</button>
        </div>

        <div id="visualSummary" style="display: none;">
          <div class="metric-grid" id="metricsContainer"></div>
        </div>

        <div id="jsonOutput" class="json-viewer">// Output normalized JSON will appear here...</div>
      </div>
    </div>
  </div>

  <script>
    let fixtures = {};

    async function init() {
      try {
        const res = await fetch('/api/fixtures');
        fixtures = await res.json();
      } catch (err) {
        console.error('Failed to load fixtures', err);
      }
    }
    init();

    function loadFixture(type) {
      if (fixtures[type]) {
        document.getElementById('rawContent').value = fixtures[type];
        updateDetection();
      }
    }

    async function handleFile(event) {
      const file = event.target.files[0];
      if (!file) return;
      document.getElementById('dropzoneText').innerText = 'Selected: ' + file.name;

      if (file.name.endsWith('.pdf')) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData });
        const data = await res.json();
        document.getElementById('rawContent').value = data.text;
      } else {
        const text = await file.text();
        document.getElementById('rawContent').value = text;
      }
      updateDetection();
    }

    async function updateDetection() {
      const content = document.getElementById('rawContent').value;
      const badge = document.getElementById('detectedTypeBadge');
      if (!content.trim()) {
        badge.style.display = 'none';
        return;
      }

      try {
        const res = await fetch('/api/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });
        const data = await res.json();
        if (data.type) {
          badge.innerText = 'Detected: ' + data.type;
          badge.style.display = 'inline-block';
        } else {
          badge.innerText = 'Unclassified';
          badge.style.display = 'inline-block';
        }
      } catch {
        badge.style.display = 'none';
      }
    }

    document.getElementById('rawContent').addEventListener('input', () => {
      clearTimeout(window._detectTimeout);
      window._detectTimeout = setTimeout(updateDetection, 300);
    });

    // Drag and drop setup
    const dropzone = document.getElementById('dropzone');
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        document.getElementById('fileInput').files = e.dataTransfer.files;
        handleFile({ target: { files: e.dataTransfer.files } });
      }
    });

    async function runParse() {
      const content = document.getElementById('rawContent').value;
      const outputElem = document.getElementById('jsonOutput');
      const visualSummary = document.getElementById('visualSummary');
      const metricsContainer = document.getElementById('metricsContainer');

      if (!content.trim()) {
        outputElem.innerText = 'Please provide or load document content first.';
        return;
      }

      outputElem.innerText = 'Parsing and validating against Zod schema...';

      try {
        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });

        const envelope = await res.json();
        outputElem.innerText = JSON.stringify(envelope, null, 2);

        // Render Visual Summary
        if (envelope && envelope.payload && envelope.payload.summary) {
          visualSummary.style.display = 'block';
          metricsContainer.innerHTML = '';
          const summary = envelope.payload.summary;

          for (const [k, v] of Object.entries(summary)) {
            const box = document.createElement('div');
            box.className = 'metric-box';
            box.innerHTML = \`<div class="metric-label">\${k}</div><div class="metric-val">\${v}</div>\`;
            metricsContainer.appendChild(box);
          }
        } else {
          visualSummary.style.display = 'none';
        }
      } catch (err) {
        outputElem.innerText = 'Error: ' + err.message;
        visualSummary.style.display = 'none';
      }
    }

    function copyJson() {
      const text = document.getElementById('jsonOutput').innerText;
      navigator.clipboard.writeText(text);
      alert('JSON copied to clipboard!');
    }
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_CONTENT);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/fixtures') {
    const fixtures = await getFixtures();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(fixtures));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/detect') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const { content } = JSON.parse(body || '{}');
        const detected = detectTypeWithConfidence(content);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(detected));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/parse') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const { content, type } = JSON.parse(body || '{}');
        const envelope = await parseText(content, { type });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(envelope));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`  DocCrunch Local Interactive UI running at:`);
  console.log(`  👉 http://localhost:${PORT}`);
  console.log(`=============================================================\n`);
});
