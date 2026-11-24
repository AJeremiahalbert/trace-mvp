// Run with: npm test
import assert from 'node:assert/strict';
import { SAMPLE_CASES, ruleInvestigate, parseComplaint, parseFinding } from '../public/engine.js';

const expected = {
  'TRC-1042': { action: 'request_credit', stopped_at: 'receiving_bank' },
  'TRC-1043': { action: 'reverse_to_customer', stopped_at: 'switch' },
  'TRC-1044': { action: 'send_proof_of_credit', stopped_at: 'none' },
  'TRC-1045': { action: 'already_reversed', stopped_at: 'switch' }
};

for (const c of SAMPLE_CASES) {
  const { finding, steps } = ruleInvestigate(c);
  assert.equal(finding.action, expected[c.id].action, `${c.id} action`);
  assert.equal(finding.stopped_at, expected[c.id].stopped_at, `${c.id} stopped_at`);
  assert.ok(steps.length >= 2, `${c.id} used tools`);
  console.log(`ok  ${c.id}  ${finding.action}`);
}

assert.deepEqual(parseComplaint('sent 50k yesterday'), { acct: undefined, amt: 50000 });
assert.deepEqual(parseComplaint('N120,000 from 0123459902'), { acct: '0123459902', amt: 120000 });
assert.equal(parseComplaint('₦15,500 to my hairdresser').amt, 15500);
assert.equal(parseComplaint('my 25,000 naira transfer').amt, 25000);
console.log('ok  complaint parsing');

const unknown = ruleInvestigate({ name: 'X', account: '0199999999', text: 'I sent 10k' });
assert.equal(unknown.finding.action, 'escalate');
console.log('ok  unknown account escalates');

const noAcct = ruleInvestigate({ name: 'Walk-in customer', account: '', text: 'I sent 20k to my cousin and he didnt recieve it' });
assert.equal(noAcct.finding.action, 'escalate');
assert.equal(noAcct.steps.length, 0, 'no search without an account number');
const { TOOLS } = await import('../public/engine.js');
assert.deepEqual(TOOLS.search_sender_ledger({ amount: 25000 }), [], 'ledger search needs an account');
console.log('ok  no account means no search');

assert.equal(parseFinding('Here you go: {"action":"escalate","diagnosis":"x"}').action, 'escalate');
assert.throws(() => parseFinding('{"action":"delete_everything"}'));
console.log('ok  agent answer parsing');

// Agent loop with a fake Claude client (no API key needed).
const { runAgent } = await import('../api/investigate.js');
const script = [
  { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'search_sender_ledger', input: { account: '0123456781', amount: 50000 } }] },
  { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'query_nibss', input: { session_id: '000013261116091402558810234411' } }] },
  { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"found":true,"stopped_at":"receiving_bank","action":"request_credit","diagnosis":"d","customer_message":"m"}' }] }
];
let i = 0;
const fake = { messages: { create: async () => script[i++] } };
const out = await runAgent(SAMPLE_CASES[0], fake);
assert.equal(out.steps.length, 2);
assert.equal(out.steps[1].result[0].code, '00');
assert.equal(out.finding.action, 'request_credit');
console.log('ok  agent loop with tools');
// Rate limiter
const { createLimiter } = await import('../lib/rate-limit.js');
const allow = createLimiter({ limit: 2, windowMs: 1000 });
assert.equal(allow('a', 0), true);
assert.equal(allow('a', 10), true);
assert.equal(allow('a', 20), false, 'third request in window is blocked');
assert.equal(allow('b', 20), true, 'other IPs are not affected');
assert.equal(allow('a', 1500), true, 'window resets');
console.log('ok  rate limiter');

// Handler input validation (no API call is made)
const { default: handler } = await import('../api/investigate.js');
const fakeRes = () => ({ code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
process.env.ANTHROPIC_API_KEY = 'test-key';
let r = fakeRes(); await handler({ method: 'GET', headers: {} }, r); assert.equal(r.code, 405);
r = fakeRes(); await handler({ method: 'POST', headers: {}, body: { case: { text: '' } } }, r); assert.equal(r.code, 400);
r = fakeRes(); await handler({ method: 'POST', headers: {}, body: { case: { text: 'x'.repeat(2001) } } }, r); assert.equal(r.code, 400);
r = fakeRes(); await handler({ method: 'POST', headers: {}, body: { case: { text: 'hello', account: '12ab' } } }, r); assert.equal(r.code, 400);
delete process.env.ANTHROPIC_API_KEY;
r = fakeRes(); await handler({ method: 'POST', headers: {}, body: { case: { text: 'hello' } } }, r); assert.equal(r.code, 503);
console.log('ok  API input validation');
console.log('All tests passed');
