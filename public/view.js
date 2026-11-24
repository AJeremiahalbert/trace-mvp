// Rendering helpers for the Trace console. No state lives here.
import { SENDER, NIBSS, RECV, naira } from './engine.js';

export const $ = id => document.getElementById(id);
export const formatSecs = s => (s < 0.1 ? 'under 0.1s' : s.toFixed(1) + 's');
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON = {
  ok: '<svg viewBox="0 0 20 20"><path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bad: '<svg viewBox="0 0 20 20"><path d="M6 6l8 8M14 6l-8 8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  idle: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="3" fill="currentColor"/></svg>'
};

const LABEL = {
  search_sender_ledger: 'Searched the Kora Bank ledger',
  query_nibss: 'Looked up the transfer on NIBSS',
  query_receiving_bank: 'Asked the receiving bank',
  check_reversals: 'Checked for a reversal'
};

const HEADLINE = {
  switch: 'Stopped at the NIBSS switch',
  receiving_bank: 'Stopped at the receiving bank',
  none: 'Delivered. The money arrived',
  unknown: 'No matching transfer found'
};

export const ACTION_TEXT = {
  reverse_to_customer: f => `Reverse ${naira(f.amount)} to the customer`,
  request_credit: () => 'Request the credit from the receiving bank',
  send_proof_of_credit: () => 'Send proof of credit. No refund due',
  already_reversed: () => 'Tell the customer the refund has landed',
  escalate: () => 'Escalate to a human investigator'
};
export const actionText = f => (ACTION_TEXT[f.action] || ACTION_TEXT.escalate)(f);

// ---------- Case header ----------
export function renderHead(c) {
  const account = c.account ? `Account ${esc(c.account)}` : 'No account number given';
  $('caseHead').innerHTML = `<p class="meta">${esc(c.id)} · ${esc(c.channel)} · received ${esc(c.received)} · <span class="status ${esc(c.status.toLowerCase())}">${esc(c.status)}</span></p>
    <h2 id="caseTitle">${esc(c.name)}</h2>
    <p class="meta">${account}</p>
    <blockquote class="complaint">${esc(c.text)}</blockquote>`;
}

// ---------- Money trail ----------
function setStop(id, state, text) {
  const el = $(id);
  el.className = 'stop' + (state === 'idle' ? '' : ' ' + state);
  el.querySelector('.icon').innerHTML = ICON[state];
  el.querySelector('.state').textContent = text;
}

export function trailFrom(steps) {
  const t = { send: ['idle', 'Not checked yet'], sw: ['idle', 'Not checked yet'], recv: ['idle', 'Not checked yet'] };
  for (const s of steps) {
    const r = Array.isArray(s.result) ? s.result[0] : null;
    if (s.name === 'search_sender_ledger') t.send = r ? ['ok', `Debited ${naira(r.amount)}`] : ['bad', 'No debit found'];
    if (s.name === 'query_nibss' && r) {
      t.sw = r.code === '00' ? ['ok', 'Delivered'] : ['bad', `Failed, code ${r.code}`];
      if (r.code !== '00') t.recv = ['idle', 'Never reached'];
    }
    if (s.name === 'query_receiving_bank') t.recv = r && r.status === 'POSTED' ? ['ok', 'Credited'] : ['bad', 'Not credited'];
    if (s.name === 'check_reversals' && r) t.send = ['ok', `Debited, then refunded`];
  }
  return t;
}

export function paintTrail(steps) {
  const t = trailFrom(steps);
  setStop('nSend', ...t.send);
  setStop('nSwitch', ...t.sw);
  setStop('nRecv', ...t.recv);
}

// ---------- Steps ----------
function summarize(name, res) {
  if (!Array.isArray(res) || !res.length) return 'No matching record';
  const r = res[0];
  if (name === 'search_sender_ledger') return `${r.ref} · ${naira(r.amount)} to ${r.beneficiary} (${r.bank}) at ${r.time}`;
  if (name === 'query_nibss') return `Session ${r.session} · code ${r.code}, ${r.desc}`;
  if (name === 'query_receiving_bank') return `${r.bank} · ${r.status === 'POSTED' ? 'credit posted' : 'credit failed'}${r.note ? ` (${r.note})` : ''}`;
  return `${r.ref} · ${naira(r.amount)} returned at ${r.time}`;
}

export function stepItem(kind, text, detail, animate = false) {
  const li = document.createElement('li');
  li.className = kind + (animate ? ' enter' : '');
  li.innerHTML = kind === 'pending' ? '<span class="spinner" aria-hidden="true"></span>' : '<span class="dot" aria-hidden="true"></span>';
  const body = document.createElement('span');
  body.textContent = text;
  if (detail) { const sm = document.createElement('small'); sm.textContent = detail; body.append(sm); }
  li.append(body);
  return li;
}

export const toolStep = (s, animate = false) => stepItem('done', LABEL[s.name] || s.name, summarize(s.name, s.result), animate);

export function renderSteps(items) {
  const list = $('steps');
  list.replaceChildren(...items);
  if (!items.length) list.innerHTML = '<li class="empty">Press Investigate complaint and Trace will check each system here.</li>';
}

// ---------- Result ----------
export function renderResult(r) {
  const box = $('result');
  if (!r) { box.hidden = true; box.innerHTML = ''; return; }
  const f = r.finding;
  const headline = f.action === 'already_reversed' ? 'Failed at the switch, already refunded' : (HEADLINE[f.stopped_at] || HEADLINE.unknown);
  const fact = (label, value, cls = '') => value ? `<div><dt>${label}</dt><dd class="${cls}">${esc(value)}</dd></div>` : '';
  box.hidden = false;
  box.innerHTML = `<span class="tag">Finding · ${esc(r.mode)}</span>
    <h3 class="finding">${esc(headline)}</h3>
    <p class="diagnosis">${esc(f.diagnosis)}</p>
    <dl class="facts">
      ${fact('Recommended action', actionText(f), 'action')}
      ${fact('Amount', f.amount ? naira(f.amount) : '')}
      ${fact('Debit reference', f.debit_ref)}
      ${fact('Beneficiary', f.beneficiary)}
      ${fact('NIBSS session ID', f.session_id)}
    </dl>
    <div class="message-head"><h4>Reply to the customer (draft)</h4><button class="btn btn-tertiary" type="button" id="copy">Copy reply</button></div>
    <p class="message" id="message">${esc(f.customer_message)}</p>`;
}

// ---------- Queue ----------
export function renderQueue(cases, currentId) {
  $('queue').innerHTML = cases.map(c => `<li><button type="button" class="queue-item" data-id="${esc(c.id)}" aria-current="${c.id === currentId}">
    <span class="row"><strong>${esc(c.name)}</strong><span class="status ${esc(c.status.toLowerCase())}">${esc(c.status)}</span></span>
    <span class="excerpt">${esc(c.text)}</span>
    <span class="row"><span>${esc(c.id)} · ${esc(c.channel)}</span></span></button></li>`).join('');
}

// ---------- Data and audit ----------
function table(title, cols, rows) {
  const head = cols.map(([label, , money]) => `<th${money ? ' class="num"' : ''} scope="col">${esc(label)}</th>`).join('');
  const body = rows.map(r => `<tr>${cols.map(([, key, money]) => `<td${money ? ' class="num"' : ''}>${esc(money ? naira(r[key]) : r[key])}</td>`).join('')}</tr>`).join('');
  return `<section class="table-wrap"><h2>${esc(title)}</h2><div class="scroll" tabindex="0" role="region" aria-label="${esc(title)}"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></section>`;
}

export function renderTables() {
  $('tables').innerHTML =
    table('Kora Bank ledger (sender)', [['Ref', 'ref'], ['Account', 'account'], ['Name', 'name'], ['Type', 'type'], ['Amount', 'amount', 1], ['Time', 'time'], ['To account', 'beneficiary'], ['To bank', 'bank'], ['Session ID', 'session']], SENDER) +
    table('NIBSS switch log', [['Session ID', 'session'], ['From', 'from'], ['To', 'to'], ['Beneficiary', 'beneficiary'], ['Amount', 'amount', 1], ['Time', 'time'], ['Code', 'code'], ['Result', 'desc']], NIBSS) +
    table('Receiving banks (credit postings)', [['Bank', 'bank'], ['Account', 'account'], ['Name', 'name'], ['Amount', 'amount', 1], ['Time', 'time'], ['Session ID', 'session'], ['Status', 'status'], ['Note', 'note']], RECV);
}

export function renderAudit(audit) {
  if (!audit.length) {
    $('auditBody').innerHTML = '<div class="empty-state"><h2>No decisions yet</h2><p>When you approve or escalate a case, it is logged here with the time and how long Trace took.</p><button class="btn btn-secondary" type="button" data-goto="investigate">Go to cases</button></div>';
    return;
  }
  const rows = audit.map(a => `<tr><td class="num">${esc(a.time)}</td><td>${esc(a.id)}</td><td>${esc(a.name)}</td><td>${esc(a.decision)}</td><td>${esc(a.mode)}</td><td class="num">${formatSecs(a.secs)}</td></tr>`).join('');
  $('auditBody').innerHTML = `<div class="scroll" tabindex="0" role="region" aria-label="Audit log"><table><thead><tr><th scope="col">Time</th><th scope="col">Case</th><th scope="col">Customer</th><th scope="col">Decision</th><th scope="col">Mode</th><th scope="col" class="num">Investigated in</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
