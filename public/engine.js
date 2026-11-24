// Trace engine: sample data, the agent's tools, and the rule-based fallback.
// Shared by the browser (public/app.js) and the server (api/investigate.js).
// All names, accounts and banks below are made up for the prototype.

export const TODAY = '2026-11-23';

export const SENDER = [
  { ref: 'KB-88120', account: '0123456781', name: 'Tolu Adebayo', type: 'DEBIT', amount: 50000, time: '2026-11-16 09:14:02', beneficiary: '2045551203', bank: 'Meridian Bank', session: '000013261116091402558810234411', narration: 'Rent Nov' },
  { ref: 'KB-88131', account: '0123456781', name: 'Tolu Adebayo', type: 'DEBIT', amount: 2500, time: '2026-11-16 12:40:11', beneficiary: '3011220091', bank: 'Palm MFB', session: '000013261116124011558810299102', narration: 'Lunch' },
  { ref: 'KB-88457', account: '0123459902', name: 'Ibrahim Musa', type: 'DEBIT', amount: 120000, time: '2026-11-18 14:02:37', beneficiary: '3011223344', bank: 'Palm MFB', session: '000013261118140237558810377120', narration: 'Stock payment' },
  { ref: 'KB-88460', account: '0123459902', name: 'Ibrahim Musa', type: 'DEBIT', amount: 6000, time: '2026-11-18 16:20:05', beneficiary: '2045559012', bank: 'Meridian Bank', session: '000013261118162005558810377199', narration: 'Fuel' },
  { ref: 'KB-88702', account: '0123467715', name: 'Grace Eze', type: 'DEBIT', amount: 15500, time: '2026-11-20 19:45:03', beneficiary: '4099887766', bank: 'Harbour Bank', session: '000013261120194503558810455015', narration: 'Hair' },
  { ref: 'KB-88851', account: '0123471120', name: 'Femi Johnson', type: 'DEBIT', amount: 25000, time: '2026-11-21 11:30:44', beneficiary: '2045553310', bank: 'Meridian Bank', session: '000013261121113044558810521025', narration: 'Contribution' },
  { ref: 'KB-88852', account: '0123471120', name: 'Femi Johnson', type: 'REVERSAL', amount: 25000, time: '2026-11-21 11:31:20', beneficiary: '2045553310', bank: 'Meridian Bank', session: '000013261121113044558810521025', narration: 'RVSL failed NIP' }
];

export const NIBSS = [
  { session: '000013261116091402558810234411', from: 'Kora Bank', to: 'Meridian Bank', beneficiary: '2045551203', amount: 50000, time: '2026-11-16 09:14:03', code: '00', desc: 'Approved' },
  { session: '000013261116124011558810299102', from: 'Kora Bank', to: 'Palm MFB', beneficiary: '3011220091', amount: 2500, time: '2026-11-16 12:40:12', code: '00', desc: 'Approved' },
  { session: '000013261118140237558810377120', from: 'Kora Bank', to: 'Palm MFB', beneficiary: '3011223344', amount: 120000, time: '2026-11-18 14:02:39', code: '91', desc: 'Beneficiary bank not available' },
  { session: '000013261118162005558810377199', from: 'Kora Bank', to: 'Meridian Bank', beneficiary: '2045559012', amount: 6000, time: '2026-11-18 16:20:06', code: '00', desc: 'Approved' },
  { session: '000013261120194503558810455015', from: 'Kora Bank', to: 'Harbour Bank', beneficiary: '4099887766', amount: 15500, time: '2026-11-20 19:45:04', code: '00', desc: 'Approved' },
  { session: '000013261121113044558810521025', from: 'Kora Bank', to: 'Meridian Bank', beneficiary: '2045553310', amount: 25000, time: '2026-11-21 11:30:46', code: '91', desc: 'Beneficiary bank not available' }
];

export const RECV = [
  { bank: 'Meridian Bank', account: '2045551203', name: 'Chinedu Okafor', amount: 50000, time: '2026-11-16 09:14:03', session: '000013261116091402558810234411', status: 'FAILED', note: 'Core banking timeout, credit not posted' },
  { bank: 'Palm MFB', account: '3011220091', name: 'Mama Put Kitchen', amount: 2500, time: '2026-11-16 12:40:12', session: '000013261116124011558810299102', status: 'POSTED', note: '' },
  { bank: 'Meridian Bank', account: '2045559012', name: 'Total Fuel Stn', amount: 6000, time: '2026-11-18 16:20:07', session: '000013261118162005558810377199', status: 'POSTED', note: '' },
  { bank: 'Harbour Bank', account: '4099887766', name: 'Ada Beauty Place', amount: 15500, time: '2026-11-20 19:45:08', session: '000013261120194503558810455015', status: 'POSTED', note: '' }
];

export const SAMPLE_CASES = [
  { id: 'TRC-1042', name: 'Tolu Adebayo', account: '0123456781', channel: 'WhatsApp', received: '2026-11-23 08:10', text: 'Good morning. I sent 50k to my landlord Chinedu last Monday morning. My account was debited but he says he never got the money. Please help, I still owe rent.' },
  { id: 'TRC-1043', name: 'Ibrahim Musa', account: '0123459902', channel: 'Branch', received: '2026-11-23 09:32', text: 'I transferred N120,000 to my supplier at Palm MFB on Tuesday afternoon. It left my account and it is not with him. Nobody has reversed it.' },
  { id: 'TRC-1044', name: 'Grace Eze', account: '0123467715', channel: 'App', received: '2026-11-23 10:05', text: 'Paid ₦15,500 to my hairdresser on Friday evening, she says it did not come. I want my money back.' },
  { id: 'TRC-1045', name: 'Femi Johnson', account: '0123471120', channel: 'Call centre', received: '2026-11-23 11:47', text: 'My 25,000 naira transfer on Saturday failed. Where is my money?' }
];

export const naira = n => '₦' + Number(n).toLocaleString('en-NG');

// ---------- Tools: the agent's view of each system ----------
export const TOOLS = {
  search_sender_ledger: ({ account, amount, date } = {}) => SENDER.filter(r =>
    r.type === 'DEBIT' &&
    (!account || r.account === String(account)) &&
    (!amount || r.amount === Number(amount)) &&
    (!date || r.time.startsWith(String(date)))),
  query_nibss: ({ session_id } = {}) => NIBSS.filter(r => r.session === String(session_id)),
  query_receiving_bank: ({ session_id } = {}) => RECV.filter(r => r.session === String(session_id)),
  check_reversals: ({ session_id } = {}) => SENDER.filter(r => r.type === 'REVERSAL' && r.session === String(session_id))
};

export function runTool(name, input) {
  const fn = TOOLS[name];
  if (!fn) return { error: `Unknown tool ${name}` };
  return fn(input || {});
}

// Tool definitions in Anthropic Messages API format.
export const TOOL_DEFS = [
  { name: 'search_sender_ledger', description: 'Search Kora Bank debits. Filter by account (10 digits), amount (naira, number) and/or date (YYYY-MM-DD). Returns matching debits with their NIBSS session IDs.', input_schema: { type: 'object', properties: { account: { type: 'string' }, amount: { type: 'number' }, date: { type: 'string' } } } },
  { name: 'query_nibss', description: 'Look up a transfer on the NIBSS switch by session ID. code "00" means delivered to the receiving bank; any other code means it failed at the switch.', input_schema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] } },
  { name: 'query_receiving_bank', description: 'Ask the receiving bank whether it credited the beneficiary for a session ID. status POSTED means credited; FAILED or no record means not credited.', input_schema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] } },
  { name: 'check_reversals', description: 'Check whether Kora Bank already reversed a transfer back to the customer, by session ID.', input_schema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] } }
];

export const ACTIONS = ['reverse_to_customer', 'request_credit', 'send_proof_of_credit', 'already_reversed', 'escalate'];

// ---------- AI prompt and answer parsing ----------
export function buildPrompt(c) {
  return `You are Trace, an AI agent that investigates "debited but not credited" transfer disputes for Kora Bank in Nigeria. Today is ${TODAY}.
Use the tools to: find the customer's debit (relative dates like "last Monday" are relative to today; 50k means 50000), look up its session on NIBSS, check the receiving bank if NIBSS delivered it, and check for reversals. Work only from tool results; never guess.
Customer: ${c.name || 'unknown'}. Account on file: ${c.account || 'unknown'}.
Complaint: """${c.text}"""
When finished, reply with ONLY one JSON object, no other text:
{"found":boolean,"debit_ref":string|null,"session_id":string|null,"amount":number|null,"beneficiary":string|null,"stopped_at":"switch"|"receiving_bank"|"none"|"unknown","reversed":boolean,"action":"reverse_to_customer"|"request_credit"|"send_proof_of_credit"|"already_reversed"|"escalate","diagnosis":"one or two plain sentences","customer_message":"short, warm, plain English message to the customer with the amount and the next step"}`;
}

export function parseFinding(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON in agent answer');
  const f = JSON.parse(m[0]);
  if (!ACTIONS.includes(f.action)) throw new Error('Unknown action in agent answer');
  return f;
}

// ---------- Rule engine (no AI needed) ----------
export function parseComplaint(text) {
  const acct = (String(text).match(/\b01\d{8}\b/) || [])[0];
  let amt = null, m;
  if ((m = text.match(/(?:₦|\bNGN\s?|\bN)\s?(\d[\d,]*(?:\.\d+)?)(\s?k\b)?/i))) amt = parseFloat(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1);
  else if ((m = text.match(/\b(\d+(?:\.\d+)?)\s?k\b/i))) amt = parseFloat(m[1]) * 1000;
  else if ((m = text.match(/(\d[\d,]*)\s*naira/i))) amt = parseFloat(m[1].replace(/,/g, ''));
  return { acct, amt };
}

export function decide({ d, sw, rc, rv } = {}) {
  if (!d) return { found: false, stopped_at: 'unknown', reversed: false, action: 'escalate', diagnosis: 'No matching debit on this account. A human investigator should confirm the details with the customer.', customer_message: 'Thank you for reaching out. We could not find this transfer on your account yet. An investigator will call you within 24 hours to confirm the details.' };
  const base = { found: true, debit_ref: d.ref, session_id: d.session, amount: d.amount, beneficiary: `${d.beneficiary} (${d.bank})` };
  const amt = naira(d.amount);
  if (sw && sw.code !== '00') {
    if (rv) return { ...base, stopped_at: 'switch', reversed: true, action: 'already_reversed', diagnosis: `NIBSS rejected the transfer (code ${sw.code}: ${sw.desc}). Kora Bank already reversed ${amt} at ${rv.time}.`, customer_message: `Hello, your ${amt} transfer on ${d.time.slice(0, 10)} did not go through, and the money was returned to your account at ${rv.time.slice(11, 16)} the same day (reference ${rv.ref}). Please check your balance. Sorry for the worry.` };
    return { ...base, stopped_at: 'switch', reversed: false, action: 'reverse_to_customer', diagnosis: `NIBSS rejected the transfer (code ${sw.code}: ${sw.desc}), so the money never left the switch. No reversal was ever posted to the customer.`, customer_message: `Hello, we found the problem. Your ${amt} transfer on ${d.time.slice(0, 10)} failed at the payment switch and was never delivered. We are returning ${amt} to your account now. You can safely try the transfer again.` };
  }
  if (rc && rc.status === 'POSTED') return { ...base, stopped_at: 'none', reversed: false, action: 'send_proof_of_credit', diagnosis: `The transfer went through. ${rc.bank} credited ${rc.name} with ${amt} at ${rc.time}.`, customer_message: `Hello, we traced your ${amt} transfer. It was delivered to ${rc.name} at ${rc.bank} on ${rc.time.slice(0, 16)}. Session ID: ${d.session}. Please share this with the recipient so their bank can confirm it.` };
  return { ...base, stopped_at: 'receiving_bank', reversed: false, action: 'request_credit', diagnosis: `NIBSS delivered the transfer, but ${d.bank} did not post the credit${rc && rc.note ? ' (' + rc.note.toLowerCase() + ')' : ''}. The money is sitting with the receiving bank.`, customer_message: `Hello, we found your ${amt}. It reached ${d.bank} but they did not credit the account. We have sent them a formal credit request with the transaction evidence. We will update you as soon as it lands, and we will chase it if it is not resolved within 24 hours.` };
}

export function ruleInvestigate(c) {
  const steps = [];
  const call = (name, input) => { const result = runTool(name, input); steps.push({ name, input, result }); return result; };
  const p = parseComplaint(c.text);
  const account = p.acct || c.account;
  let debits = call('search_sender_ledger', { account, amount: p.amt });
  if (!debits.length && p.amt) debits = call('search_sender_ledger', { account });
  if (!debits.length) return { steps, finding: decide({}) };
  const d = debits[debits.length - 1];
  const sw = call('query_nibss', { session_id: d.session })[0];
  const rc = sw && sw.code === '00' ? call('query_receiving_bank', { session_id: d.session })[0] : undefined;
  const rv = call('check_reversals', { session_id: d.session })[0];
  return { steps, finding: decide({ d, sw, rc, rv }) };
}
