import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAtlas, runQueries } from '../public/atlas.mjs';
import { SCENARIO } from '../public/data.mjs';

const results = runQueries();
const byId = Object.fromEntries(results.map((r) => [r.query.id, r]));

test('governed recall answers all five questions correctly', () => {
  for (const r of results) {
    assert.equal(r.governed.answer, r.query.truth, `governed failed on ${r.query.id}`);
  }
});

test('flat recall gets the structural questions wrong — the poisoned well', () => {
  assert.equal(byId.region.flat.answer, 'eu-west-1');
  assert.equal(byId.region.flat.winner.substrate, 'chat');
  assert.equal(byId.datastore.flat.answer, 'postgres');
  assert.equal(byId.datastore.flat.winner.substrate, 'chat');
});

test('flat recall adopts the one-run habit as if it were a skill', () => {
  assert.equal(byId.prestep.flat.answer, 'restart the queue before deploying');
  assert.equal(byId.prestep.flat.winner.substrate, 'skill');
  assert.equal(byId.prestep.flat.winner.runs, 1);
});

test('governed recall suppresses the unproven skill and uses the runbook', () => {
  assert.equal(byId.prestep.governed.answer, 'run migrations first');
  assert.equal(byId.prestep.governed.winner.substrate, 'wiki');
  const reasons = byId.prestep.governed.suppressed.map((s) => s.reason).join(' ');
  assert.match(reasons, /unpromoted: 1\/3/);
});

test('the earned skill survives promotion and wins in both modes', () => {
  assert.equal(byId.rollback.governed.answer, 're-deploy the previous image tag');
  assert.equal(byId.rollback.governed.winner.runs, 4);
  assert.equal(byId.rollback.flat.answer, 're-deploy the previous image tag');
});

test('episodic questions are answered by chat — memory is not the enemy', () => {
  assert.equal(byId.standup.governed.answer, '10:30');
  assert.equal(byId.standup.governed.winner.substrate, 'chat');
  assert.match(
    byId.standup.governed.suppressed.map((s) => s.reason).join(' '),
    /out of scope/,
  );
});

test('governed winner for structural questions carries file:line provenance', () => {
  assert.match(byId.region.governed.winner.provenance, /infra\/deploy\.yaml:\d+/);
  assert.match(byId.datastore.governed.winner.provenance, /src\/db\.js:\d+/);
});

test('scenario surfaces at least three cross-substrate conflicts', () => {
  const atlas = buildAtlas();
  assert.ok(atlas.conflicts().length >= 3);
});
