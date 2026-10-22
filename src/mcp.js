import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { api } from './client.js';

const server = new McpServer({ name: 'qeuli', version: '0.1.0' });
const text = (value) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });

server.tool(
  'suggest_for_wait',
  'Get something worth doing during a wait: a queued read that fits, or a short break. Call it when starting a task that will take a few minutes.',
  { minutes: z.number().min(1).max(60).describe('Estimated minutes until you finish') },
  async ({ minutes }) => text(await api(`/suggest?minutes=${minutes}`)),
);

server.tool(
  'queue_reading',
  'Save an article or link to the developer reading queue for a later wait.',
  { url: z.string().url(), title: z.string().optional(), minutes: z.number().optional().describe('Estimated read time') },
  async (item) => text(await api('/queue', item)),
);

server.tool(
  'log_learning',
  'Record something the developer learned from this session, for their weekly reflection or blog notes.',
  { topic: z.string(), note: z.string().optional() },
  async (entry) => text(await api('/learned', entry)),
);

server.tool(
  'session_status',
  "Show running agent sessions and today's accumulated wait time.",
  {},
  async () => text(await api('/state')),
);

await server.connect(new StdioServerTransport());
