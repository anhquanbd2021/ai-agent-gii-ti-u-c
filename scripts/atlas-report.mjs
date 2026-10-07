// Memory Atlas — CLI side-by-side report.
// Runs the disk fixtures under examples/ through both recall modes and
// prints where flat recall poisons the well. Exits 1 if governed recall
// ever disagrees with the declared source of truth.
import { buildAtlas } from '../public/atlas.mjs';
import { extractFacts } from '../public/codegraph.mjs';
import { SUBSTRATE_INFO } from '../public/memory.mjs';
import { loadScenario } from './load-scenario.mjs';

const scenario = loadScenario();
const atlas = buildAtlas(scenario);
const { turn, sessionId } = scenario.context;

console.log('MEMORY ATLAS — flat vs governed recall');
console.log(`context: session ${sessionId}, turn ${turn}, chat TTL ${scenario.context.chatTtlTurns} turns, skill promotion ${scenario.context.skillMinRuns} runs`);
console.log('');

const facts = extractFacts(scenario.repoFiles);
console.log('Code-Graph facts derived from examples/repo:');
for (const f of facts) console.log(`  ${f.key} = ${f.value}   (${f.evidence})`);
console.log('');

const conflicts = atlas.conflicts();
console.log(`Conflicts across substrates: ${conflicts.length}`);
for (const c of conflicts) console.log(`  ${c.key}: ${c.values.map((v) => JSON.stringify(v)).join(' vs ')}`);
console.log('');

let governedFailures = 0;
let flatFailures = 0;

for (const q of scenario.queries) {
  const flat = atlas.recall(q, { turn, sessionId, mode: 'flat' });
  const governed = atlas.recall(q, { turn, sessionId, mode: 'governed' });
  const flatOk = flat.answer === q.truth;
  const govOk = governed.answer === q.truth;
  if (!flatOk) flatFailures += 1;
  if (!govOk) governedFailures += 1;

  console.log(`Q: ${q.text}`);
  console.log(`   kind: ${q.kind} | truth: ${JSON.stringify(q.truth)}`);
  console.log(`   flat     -> ${JSON.stringify(flat.answer)}  ${flatOk ? 'ok' : 'WRONG'}${flat.winner ? `   [${flat.winner.substrate}: ${flat.winner.provenance}]` : ''}`);
  console.log(`   governed -> ${JSON.stringify(governed.answer)}  ${govOk ? 'ok' : 'WRONG'}${governed.winner ? `   [${governed.winner.substrate}: ${governed.winner.provenance}]` : ''}`);
  for (const s of governed.suppressed) {
    console.log(`      suppressed ${s.entry.substrate} ${JSON.stringify(s.entry.value)} — ${s.reason}`);
  }
  console.log('');
}

console.log(`Result: flat recall ${scenario.queries.length - flatFailures}/${scenario.queries.length} correct; governed ${scenario.queries.length - governedFailures}/${scenario.queries.length} correct.`);

if (governedFailures > 0) {
  console.error('FAIL: governed recall disagreed with the source of truth.');
  process.exit(1);
}
if (flatFailures === 0) {
  console.error('FAIL: scenario no longer demonstrates the flat-recall bug.');
  process.exit(1);
}
console.log('PASS: governed recall routes every question to its source of truth.');
console.log(`Substrate semantics: ${Object.values(SUBSTRATE_INFO).map((i) => i.kind).join(' / ')}`);
