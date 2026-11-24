// POST /api/investigate — runs the Trace agent with Claude and the bank tools.
// Body: { "case": { "name": "...", "account": "0123456781", "text": "complaint in plain English" } }
import Anthropic from '@anthropic-ai/sdk';
import { TOOL_DEFS, runTool, buildPrompt, parseFinding } from '../public/engine.js';
import { createLimiter, clientIp } from '../lib/rate-limit.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const MAX_TURNS = 8;
const allow = createLimiter();

export async function runAgent(c, client = new Anthropic()) { // reads ANTHROPIC_API_KEY from the environment
  const messages = [{ role: 'user', content: buildPrompt(c) }];
  const steps = [];
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const reply = await client.messages.create({ model: MODEL, max_tokens: 1500, tools: TOOL_DEFS, messages });
    messages.push({ role: 'assistant', content: reply.content });
    if (reply.stop_reason !== 'tool_use') {
      const text = reply.content.filter(b => b.type === 'text').map(b => b.text).join('');
      return { steps, finding: parseFinding(text) };
    }
    const results = reply.content.filter(b => b.type === 'tool_use').map(b => {
      const result = runTool(b.name, b.input);
      steps.push({ name: b.name, input: b.input, result });
      return { type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(result) };
    });
    messages.push({ role: 'user', content: results });
  }
  throw new Error('Agent took too many steps');
}

function validCase(c) {
  return c && typeof c.text === 'string' && c.text.trim().length > 0 && c.text.length <= 2000 &&
    (!c.account || /^\d{10}$/.test(String(c.account))) &&
    (!c.name || (typeof c.name === 'string' && c.name.length <= 80));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI agent not configured' });
  if (!allow(clientIp(req))) return res.status(429).json({ error: 'Too many investigations. Wait a minute and try again' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const c = body && body.case;
  if (!validCase(c)) return res.status(400).json({ error: 'Send { case: { text, account?, name? } }' });
  const t0 = Date.now();
  try {
    const out = await runAgent({ name: c.name, account: c.account, text: c.text });
    return res.status(200).json({ ...out, ms: Date.now() - t0, model: MODEL });
  } catch (err) {
    console.error('Agent error:', err && err.message);
    return res.status(502).json({ error: 'Agent failed' });
  }
}
