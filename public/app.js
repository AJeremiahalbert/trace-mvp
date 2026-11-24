import { SAMPLE_CASES, SENDER, ruleInvestigate, parseComplaint } from './engine.js';
import { $, formatSecs, actionText, renderHead, paintTrail, stepItem, toolStep, renderSteps, renderResult, renderQueue, renderTables, renderAudit } from './view.js';

const STEP_DELAY_MS = 320;
const UNDO_MS = 6000;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, reduceMotion ? 0 : ms));

const state = {
  cases: SAMPLE_CASES.map(c => ({ ...c, status: 'Open', result: null })),
  currentId: SAMPLE_CASES[0].id,
  running: false,
  aiAvailable: false,
  useAi: true,
  audit: [],
  nextId: 1046,
  undo: null
};
const current = () => state.cases.find(c => c.id === state.currentId);

// ---------- Summary ----------
function renderSummary() {
  const closed = state.cases.filter(c => c.status !== 'Open');
  $('stOpen').textContent = state.cases.length - closed.length;
  $('stResolved').textContent = closed.length;
  const secs = state.audit.map(a => a.secs);
  $('stAvg').textContent = secs.length ? formatSecs(secs.reduce((a, b) => a + b, 0) / secs.length) : '–';
}

// ---------- Action bar: one primary action at a time ----------
function renderActionbar() {
  const c = current();
  const bar = $('actionbar');
  if (state.running) {
    bar.innerHTML = '<button class="btn btn-primary" type="button" disabled aria-busy="true"><span class="spinner" aria-hidden="true"></span>Investigating…</button><span class="note">Checking the bank, NIBSS and the receiving bank</span>';
    return;
  }
  if (c.status !== 'Open') {
    const next = state.cases.find(x => x.status === 'Open');
    bar.innerHTML = `<span class="note">${c.status === 'Resolved' ? 'Closed and logged in the audit log.' : 'Escalated and logged in the audit log.'}</span>` +
      (next ? '<button class="btn btn-primary" type="button" data-act="next">Open next complaint</button>' : '<span class="note">Every complaint in the queue is handled.</span>');
    return;
  }
  if (c.result) {
    bar.innerHTML = '<button class="btn btn-primary" type="button" data-act="approve">Approve and close</button><button class="btn btn-secondary" type="button" data-act="escalate">Escalate</button><button class="btn btn-tertiary" type="button" data-act="run">Run again</button>';
    return;
  }
  const toggle = state.aiAvailable
    ? `<label class="toggle"><input type="checkbox" id="useAi" ${state.useAi ? 'checked' : ''}> Use the AI agent (Claude)</label>`
    : '<span class="toggle off">AI agent not set up on this server, so the rule engine will run</span>';
  bar.innerHTML = `<button class="btn btn-primary" type="button" data-act="run">Investigate complaint</button>${toggle}`;
}

function showCase({ focus = false } = {}) {
  const c = current();
  renderHead(c);
  renderQueue(state.cases, c.id);
  renderActionbar();
  const steps = c.result ? c.result.steps : [];
  paintTrail(steps);
  renderSteps(c.result ? [...(c.result.notes || []).map(n => stepItem('note', n)), ...steps.map(toolStep)] : []);
  $('timer').innerHTML = c.result ? `Investigated in <b>${formatSecs(c.result.secs)}</b>` : '';
  renderResult(c.result);
  renderSummary();
  if (focus) {
    $('case').focus({ preventScroll: true });
    $('case').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
}

// ---------- Investigation ----------
async function askAgent(c) {
  const res = await fetch('/api/investigate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ case: { name: c.name, account: c.account || undefined, text: c.text } })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Server answered ${res.status}`);
  return body;
}

async function investigate() {
  const c = current();
  if (state.running || c.status !== 'Open') return;
  state.running = true;
  c.result = null;
  showCase();
  const useAi = state.aiAvailable && state.useAi;
  const pending = stepItem('pending', useAi ? 'Claude is reading the complaint and choosing what to check' : 'Reading the complaint', '', true);
  renderSteps([pending]);
  const notes = [];
  const t0 = performance.now();
  let out, mode;
  if (useAi) {
    try { out = await askAgent(c); mode = 'AI agent'; } catch (err) {
      notes.push(`The AI agent did not answer (${err.message}), so the rule engine ran instead`);
    }
  }
  if (!out) { out = ruleInvestigate(c); mode = 'Rule engine'; }
  const secs = (performance.now() - t0) / 1000;
  $('timer').innerHTML = `Investigated in <b>${formatSecs(secs)}</b>`;
  pending.remove();
  notes.forEach(n => $('steps').append(stepItem('note', n, '', true)));
  for (let i = 0; i < out.steps.length; i++) {
    await wait(STEP_DELAY_MS);
    $('steps').append(toolStep(out.steps[i], true));
    paintTrail(out.steps.slice(0, i + 1));
  }
  c.result = { ...out, mode, secs, notes };
  state.running = false;
  showCase();
}

// ---------- Decisions with undo ----------
function decide(status) {
  const c = current();
  const decision = status === 'Resolved' ? actionText(c.result.finding) : 'Escalated to a human investigator';
  const entry = { time: new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }), id: c.id, name: c.name, decision, mode: c.result.mode, secs: c.result.secs };
  c.status = status;
  state.audit = [entry, ...state.audit];
  renderAudit(state.audit);
  showCase();
  showToast(`${c.id} ${status === 'Resolved' ? 'closed' : 'escalated'} and logged.`, () => {
    c.status = 'Open';
    state.audit = state.audit.filter(a => a !== entry);
    renderAudit(state.audit);
    if (state.currentId === c.id) showCase(); else { renderQueue(state.cases, state.currentId); renderSummary(); }
  });
}

function showToast(text, onUndo) {
  clearTimeout(state.undo?.timer);
  $('toastText').textContent = text;
  $('toast').hidden = false;
  state.undo = { onUndo, timer: setTimeout(hideToast, UNDO_MS) };
}
function hideToast() { $('toast').hidden = true; state.undo = null; }

// ---------- New complaint form ----------
function setFormError(msg) {
  const box = $('newText');
  $('newError').textContent = msg;
  $('newError').hidden = !msg;
  box.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

function addComplaint(e) {
  e.preventDefault();
  const text = $('newText').value.trim();
  if (text.length < 10) { setFormError('Write the complaint first. A sentence or two is enough.'); $('newText').focus(); return; }
  const { acct } = parseComplaint(text);
  const known = SENDER.find(r => r.account === acct);
  const c = {
    id: 'TRC-' + state.nextId++, name: known ? known.name : 'Walk-in customer', account: acct || '', channel: 'Desk',
    received: new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }), text, status: 'Open', result: null
  };
  state.cases = [c, ...state.cases];
  state.currentId = c.id;
  $('newText').value = '';
  setFormError('');
  showCase({ focus: true });
}

// ---------- Tabs ----------
function selectTab(name) {
  document.querySelectorAll('[role=tab]').forEach(t => {
    const on = t.dataset.tab === name;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== name; });
}

// ---------- Events ----------
$('actionbar').addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'run') investigate();
  if (act === 'approve') decide('Resolved');
  if (act === 'escalate') decide('Escalated');
  if (act === 'next') { state.currentId = state.cases.find(c => c.status === 'Open').id; showCase({ focus: true }); }
});
$('actionbar').addEventListener('change', e => { if (e.target.id === 'useAi') state.useAi = e.target.checked; });
$('queue').addEventListener('click', e => {
  const btn = e.target.closest('.queue-item');
  if (!btn || state.running) return;
  state.currentId = btn.dataset.id;
  showCase({ focus: window.matchMedia('(max-width: 860px)').matches });
});
$('result').addEventListener('click', async e => {
  if (e.target.id !== 'copy') return;
  try { await navigator.clipboard.writeText($('message').textContent); e.target.textContent = 'Copied'; }
  catch { e.target.textContent = 'Select the text to copy it'; }
});
$('newForm').addEventListener('submit', addComplaint);
$('newText').addEventListener('input', () => { if (!$('newError').hidden) setFormError(''); });
$('undo').addEventListener('click', () => { state.undo?.onUndo(); clearTimeout(state.undo?.timer); hideToast(); });
document.querySelector('.tabs').addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t) selectTab(t.dataset.tab); });
document.querySelector('.tabs').addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const tabs = [...document.querySelectorAll('[role=tab]')];
  const i = tabs.indexOf(document.activeElement);
  const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
  next.focus(); selectTab(next.dataset.tab);
});
$('auditBody').addEventListener('click', e => { if (e.target.dataset.goto) selectTab(e.target.dataset.goto); });

// ---------- Start ----------
renderTables();
renderAudit(state.audit);
selectTab('investigate');
showCase();
fetch('/api/health').then(r => r.json()).then(h => {
  state.aiAvailable = Boolean(h.ai);
  if (!state.running) renderActionbar();
}).catch(() => { /* No server API (for example opened as a static file): the rule engine still works. */ });
