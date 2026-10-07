import { SUBSTRATE_INFO, SUBSTRATES } from './memory.mjs';
import { buildAtlas } from './atlas.mjs';
import { SCENARIO } from './data.mjs';
import { extractFacts } from './codegraph.mjs';

const atlas = buildAtlas();
const { turn, sessionId } = SCENARIO.context;

document.getElementById('context-line').textContent =
  `Now: session ${sessionId}, turn ${turn} — chat TTL ${SCENARIO.context.chatTtlTurns} turns, ` +
  `skill promotion after ${SCENARIO.context.skillMinRuns} successful runs.`;

function entryLine(e) {
  const meta = {
    chat: `s${e.sessionId} · turn ${e.turn} · conf ${e.confidence}`,
    skill: `${e.runs}/${SCENARIO.context.skillMinRuns} runs · conf ${e.confidence.toFixed(2)}`,
    wiki: e.provenance,
    codegraph: e.provenance,
  }[e.substrate];
  return `<li><code>${e.key}</code> = <strong>${e.value}</strong><span class="entry-meta">${meta}</span></li>`;
}

const substratesEl = document.getElementById('substrates');
for (const s of SUBSTRATES) {
  const info = SUBSTRATE_INFO[s];
  const entries = atlas.entries.filter((e) => e.substrate === s);
  const div = document.createElement('div');
  div.className = `substrate ${s}`;
  div.innerHTML = `
    <div class="kind">${info.kind} · authority ${info.authority}</div>
    <h3>${info.label}</h3>
    <p class="blurb">${info.blurb}</p>
    <ul>${entries.map(entryLine).join('') || '<li><em>empty</em></li>'}</ul>`;
  substratesEl.appendChild(div);
}

const codegraphCount = extractFacts(SCENARIO.repoFiles).length;
console.info(`code-graph derived ${codegraphCount} structural facts`);

const resultEl = document.getElementById('result');
const queriesEl = document.getElementById('queries');

function card(e) {
  return `<div class="card"><code>${e.key}</code> = <strong>${e.value}</strong>
    <span class="entry-meta">${e.substrate} · ${e.provenance}</span></div>`;
}

function show(q) {
  const flat = atlas.recall(q, { turn, sessionId, mode: 'flat' });
  const governed = atlas.recall(q, { turn, sessionId, mode: 'governed' });

  document.getElementById('result-question').textContent = q.text;
  document.getElementById('result-truth').innerHTML =
    `question kind: <code>${q.kind}</code> — source of truth: <code>${q.truth}</code>`;

  const flatOk = flat.answer === q.truth;
  const govOk = governed.answer === q.truth;

  const flatAns = document.getElementById('flat-answer');
  flatAns.className = `answer ${flatOk ? 'correct' : 'wrong'}`;
  flatAns.textContent = flat.answer === null ? '∅ no answer' : JSON.stringify(flat.answer);
  document.getElementById('flat-winner').innerHTML = flat.winner
    ? `winner: ${card(flat.winner)}` : '';

  const govAns = document.getElementById('governed-answer');
  govAns.className = `answer ${govOk ? 'correct' : 'wrong'}`;
  govAns.textContent = governed.answer === null ? '∅ no answer' : JSON.stringify(governed.answer);
  document.getElementById('governed-winner').innerHTML = governed.winner
    ? `winner: ${card(governed.winner)}` : '';
  document.getElementById('governed-suppressed').innerHTML = governed.suppressed.length
    ? `suppressed:${governed.suppressed.map((s) =>
        `<div class="card"><code>${s.entry.key}</code> = <strong>${s.entry.value}</strong>
         <span class="entry-meta">${s.entry.substrate} — ${s.reason}</span></div>`).join('')}`
    : '';

  resultEl.classList.remove('hidden');
}

for (const q of SCENARIO.queries) {
  const btn = document.createElement('button');
  btn.textContent = q.text;
  btn.addEventListener('click', () => {
    queriesEl.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    show(q);
  });
  queriesEl.appendChild(btn);
}

const conflictsEl = document.getElementById('conflicts');
for (const c of atlas.conflicts()) {
  const li = document.createElement('li');
  li.innerHTML = `<code>${c.key}</code>: ${c.values.map((v) => `<strong>${v}</strong>`).join(' vs ')}`;
  conflictsEl.appendChild(li);
}
