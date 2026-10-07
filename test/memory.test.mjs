import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAtlas, SUBSTRATE_INFO, QUESTION_ROUTING } from '../public/memory.mjs';

test('four substrates exist with distinct semantics', () => {
  const kinds = Object.values(SUBSTRATE_INFO).map((i) => i.kind);
  assert.deepEqual(kinds.sort(), ['episodic', 'procedural', 'semantic', 'structural']);
  assert.equal(SUBSTRATE_INFO.chat.decays, true);
  assert.equal(SUBSTRATE_INFO.codegraph.authority, 4);
  assert.equal(SUBSTRATE_INFO.chat.authority, 1);
});

test('chat entries expire after chatTtlTurns idle turns', () => {
  const atlas = new MemoryAtlas({ chatTtlTurns: 10 });
  atlas.write('chat', { key: 'k', value: 'old', sessionId: 1, turn: 0 });
  const r = atlas.recall({ key: 'k', kind: 'episodic' }, { turn: 20, sessionId: 1, mode: 'governed' });
  assert.equal(r.answer, null);
  assert.equal(r.suppressed.length, 1);
  assert.match(r.suppressed[0].reason, /expired/);
});

test('chat entries inside TTL remain recallable', () => {
  const atlas = new MemoryAtlas({ chatTtlTurns: 10 });
  atlas.write('chat', { key: 'k', value: 'fresh', sessionId: 1, turn: 8 });
  const r = atlas.recall({ key: 'k', kind: 'episodic' }, { turn: 12, sessionId: 1, mode: 'governed' });
  assert.equal(r.answer, 'fresh');
});

test('chat from another session is out of scope', () => {
  const atlas = new MemoryAtlas({ chatTtlTurns: 100 });
  atlas.write('chat', { key: 'k', value: 'theirs', sessionId: 7, turn: 49 });
  const r = atlas.recall({ key: 'k', kind: 'episodic' }, { turn: 50, sessionId: 4, mode: 'governed' });
  assert.equal(r.answer, null);
  assert.match(r.suppressed[0].reason, /out of scope/);
});

test('flat recall ignores TTL and scope — the bug', () => {
  const atlas = new MemoryAtlas({ chatTtlTurns: 10 });
  atlas.write('chat', { key: 'k', value: 'stale', sessionId: 1, turn: 0 });
  const r = atlas.recall({ key: 'k', kind: 'episodic' }, { turn: 99, sessionId: 9, mode: 'flat' });
  assert.equal(r.answer, 'stale');
});

test('a skill is suppressed until skillMinRuns successes', () => {
  const atlas = new MemoryAtlas({ skillMinRuns: 3 });
  atlas.ingestSkillRuns([
    { skill: 'deploy.preStep::do the thing', success: true, provenance: 'run #1', turn: 5 },
    { skill: 'deploy.preStep::do the thing', success: true, provenance: 'run #2', turn: 6 },
  ]);
  const r = atlas.recall({ key: 'deploy.preStep', kind: 'procedural' }, { turn: 10, sessionId: 1, mode: 'governed' });
  assert.equal(r.answer, null);
  assert.match(r.suppressed[0].reason, /unpromoted: 2\/3/);
});

test('a promoted skill becomes recallable', () => {
  const atlas = new MemoryAtlas({ skillMinRuns: 3 });
  atlas.ingestSkillRuns([
    { skill: 'x::y', success: true, provenance: 'a', turn: 1 },
    { skill: 'x::y', success: true, provenance: 'b', turn: 2 },
    { skill: 'x::y', success: true, provenance: 'c', turn: 3 },
  ]);
  const r = atlas.recall({ key: 'x', kind: 'procedural' }, { turn: 4, sessionId: 1, mode: 'governed' });
  assert.equal(r.answer, 'y');
});

test('governed recall routes structural questions to code-graph over fresher chat', () => {
  const atlas = new MemoryAtlas();
  atlas.write('chat', { key: 'deploy.region', value: 'eu-west-1', sessionId: 4, turn: 31 });
  atlas.write('codegraph', { key: 'deploy.region', value: 'us-east-1', turn: 0, provenance: 'infra/deploy.yaml:3' });
  const r = atlas.recall({ key: 'deploy.region', kind: 'structural' }, { turn: 33, sessionId: 4, mode: 'governed' });
  assert.equal(r.answer, 'us-east-1');
  assert.equal(r.winner.substrate, 'codegraph');
});

test('flat recall does the opposite — freshest claim wins', () => {
  const atlas = new MemoryAtlas();
  atlas.write('codegraph', { key: 'deploy.region', value: 'us-east-1', turn: 0 });
  atlas.write('chat', { key: 'deploy.region', value: 'eu-west-1', sessionId: 4, turn: 31 });
  const r = atlas.recall({ key: 'deploy.region', kind: 'structural' }, { turn: 33, sessionId: 4, mode: 'flat' });
  assert.equal(r.answer, 'eu-west-1');
  assert.equal(r.winner.substrate, 'chat');
});

test('episodic questions still route to chat under governed recall', () => {
  const atlas = new MemoryAtlas();
  atlas.write('chat', { key: 'standup.time', value: '10:30', sessionId: 4, turn: 32 });
  atlas.write('wiki', { key: 'standup.time', value: '09:00', turn: 0, provenance: 'old page' });
  const r = atlas.recall({ key: 'standup.time', kind: 'episodic' }, { turn: 33, sessionId: 4, mode: 'governed' });
  assert.equal(r.answer, '10:30');
  assert.equal(r.winner.substrate, 'chat');
});

test('conflicts() reports keys where substrates disagree', () => {
  const atlas = new MemoryAtlas();
  atlas.write('chat', { key: 'a', value: 'x', sessionId: 1, turn: 1 });
  atlas.write('wiki', { key: 'a', value: 'y', turn: 0, provenance: 'p' });
  atlas.write('wiki', { key: 'b', value: 'same', turn: 0, provenance: 'p' });
  atlas.write('codegraph', { key: 'b', value: 'same', turn: 0, provenance: 'f:1' });
  const keys = atlas.conflicts().map((c) => c.key);
  assert.deepEqual(keys, ['a']);
});

test('every question kind has a routing table', () => {
  for (const kind of ['structural', 'semantic', 'procedural', 'episodic']) {
    assert.ok(Array.isArray(QUESTION_ROUTING[kind]));
    assert.ok(QUESTION_ROUTING[kind].length > 0);
  }
});

test('unknown substrate throws', () => {
  const atlas = new MemoryAtlas();
  assert.throws(() => atlas.write('dreams', { key: 'k', value: 'v' }), /unknown substrate/);
});
