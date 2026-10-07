import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFacts } from '../public/codegraph.mjs';
import { REPO_FILES } from '../public/data.mjs';

test('extracts deploy region and replicas from the manifest', () => {
  const facts = extractFacts(REPO_FILES);
  const region = facts.find((f) => f.key === 'deploy.region');
  assert.equal(region.value, 'us-east-1');
  assert.match(region.evidence, /deploy\.yaml:\d+/);
  const replicas = facts.find((f) => f.key === 'deploy.replicas');
  assert.equal(replicas.value, '3');
});

test('extracts datastore from source imports', () => {
  const facts = extractFacts(REPO_FILES);
  const ds = facts.find((f) => f.key === 'datastore');
  assert.equal(ds.value, 'sqlite');
  assert.match(ds.evidence, /src\/db\.js:1/);
});

test('lockfile + packageManager agree on pnpm (deduped to one fact)', () => {
  const facts = extractFacts(REPO_FILES);
  const mgr = facts.filter((f) => f.key === 'pkg.manager' && f.value === 'pnpm');
  assert.equal(mgr.length, 1);
});

test('postgres import would surface as postgres', () => {
  const facts = extractFacts({ 'db.js': "import pg from 'pg';\nconst c = new pg.Client();\n" });
  assert.equal(facts.find((f) => f.key === 'datastore').value, 'postgres');
});

test('every fact carries evidence — provenance is not optional', () => {
  for (const f of extractFacts(REPO_FILES)) {
    assert.ok(f.evidence && f.evidence.length > 0, `fact ${f.key} missing evidence`);
  }
});

test('empty repo yields no facts', () => {
  assert.deepEqual(extractFacts({}), []);
});
