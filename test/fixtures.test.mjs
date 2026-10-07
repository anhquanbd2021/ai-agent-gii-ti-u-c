import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScenario } from '../scripts/load-scenario.mjs';
import { SCENARIO } from '../public/data.mjs';

// The browser lab embeds SCENARIO; the CLI loads examples/ from disk.
// These tests prove the two stay identical — a lab that demos one thing
// while the article claims another is worse than no lab.

test('disk fixtures mirror the embedded scenario exactly', () => {
  const disk = loadScenario();
  assert.deepEqual(disk.chatLog, SCENARIO.chatLog);
  assert.deepEqual(disk.wiki, SCENARIO.wiki);
  assert.deepEqual(disk.skillRuns, SCENARIO.skillRuns);
  assert.deepEqual(disk.queries, SCENARIO.queries);
  assert.deepEqual(disk.context, SCENARIO.context);
});

test('examples/repo files match the embedded repo map byte-for-byte', () => {
  const disk = loadScenario();
  assert.deepEqual(disk.repoFiles, SCENARIO.repoFiles);
});
