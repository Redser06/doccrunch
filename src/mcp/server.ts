// DocCrunch MCP server — thin transport layer over the SDK.
// Tools: parse_document, parse_text, parse_batch, list_types
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { parse, parseText, parseBatch, getRegisteredTypes } from '../index.js';

const server = new McpServer({ name: 'doccrunch', version: '0.1.0' });

server.tool(
  'parse_document',
  'Parse a document file into normalized JSON (auto-detects type)',
  { path: z.string().describe('absolute path to the document file'),
    type: z.string().optional().describe('force a document type') },
  async ({ path, type }) => {
    try {
      const result = await parse(path, type ? { type: type as any } : undefined);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  },
);

server.tool(
  'parse_text',
  'Parse raw document text into normalized JSON',
  { text: z.string(), type: z.string().optional() },
  async ({ text, type }) => {
    try {
      const result = await parseText(text, type ? { type: type as any } : undefined);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  },
);

server.tool(
  'parse_batch',
  'Parse every supported file in a directory; failures degrade to low-confidence envelopes',
  { dir: z.string() },
  async ({ dir }) => {
    try {
      const result = await parseBatch(dir);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
    }
  },
);

server.tool('list_types', 'List registered document parser types', {}, async () => ({
  content: [{ type: 'text', text: JSON.stringify(getRegisteredTypes()) }],
}));

await server.connect(new StdioServerTransport());
console.error('doccrunch MCP server running on stdio');
