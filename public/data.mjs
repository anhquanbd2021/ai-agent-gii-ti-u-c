// Seeded "payments service" scenario — the canonical fixture.
// `examples/atlas-scenario.json` + `examples/repo/` mirror this data;
// test/fixtures.test.mjs asserts they stay identical.

export const REPO_FILES = {
  'package.json': JSON.stringify(
    { name: 'payments', version: '4.2.0', packageManager: 'pnpm@9.15.0', private: true },
    null,
    2,
  ) + '\n',
  'pnpm-lock.yaml': "lockfileVersion: '9.0'\n\nimporters: {}\n",
  'src/db.js': [
    "import Database from 'better-sqlite3';",
    '',
    "// Fixture only — the payments service still runs on SQLite.",
    "export const db = new Database('payments.db');",
    '',
  ].join('\n'),
  'infra/deploy.yaml': [
    '# Fixture deploy manifest for the Memory Atlas lab.',
    'service: payments',
    'region: us-east-1',
    'replicas: 3',
    '',
  ].join('\n'),
};

export const CHAT_LOG = [
  // Was true three months ago — the service lived in eu-west-1 then.
  { sessionId: 1, turn: 2, key: 'deploy.region', value: 'eu-west-1', confidence: 0.8 },
  // Old standup time from a previous session.
  { sessionId: 2, turn: 9, key: 'standup.time', value: '09:00', confidence: 0.7 },
  // Recent session: user repeats the outdated region out of habit.
  { sessionId: 4, turn: 30, key: 'datastore', value: 'postgres', confidence: 0.75 },
  { sessionId: 4, turn: 31, key: 'deploy.region', value: 'eu-west-1', confidence: 0.8 },
  // Fresh, valid episodic fact from the current session.
  { sessionId: 4, turn: 32, key: 'standup.time', value: '10:30', confidence: 0.9 },
];

export const WIKI = [
  {
    key: 'deploy.preStep',
    value: 'run migrations first',
    source: 'runbook v3, reviewed 2026-08-14',
  },
  {
    key: 'service.owner',
    value: 'team-payments',
    source: 'service catalog',
  },
];

export const SKILL_RUNS = [
  // One lucky run is a story, not a skill — and it happened *recently*,
  // which is exactly what makes flat recall trust it.
  { skill: 'deploy.preStep::restart the queue before deploying', success: true, provenance: 'run #118', turn: 28 },
  // A promoted skill: four successful runs.
  { skill: 'deploy.rollback::re-deploy the previous image tag', success: true, provenance: 'run #87', turn: 12 },
  { skill: 'deploy.rollback::re-deploy the previous image tag', success: true, provenance: 'run #102', turn: 18 },
  { skill: 'deploy.rollback::re-deploy the previous image tag', success: true, provenance: 'run #110', turn: 25 },
  { skill: 'deploy.rollback::re-deploy the previous image tag', success: true, provenance: 'run #121', turn: 29 },
];

export const QUERIES = [
  {
    id: 'region',
    text: 'Where does the payments service deploy?',
    key: 'deploy.region',
    kind: 'structural',
    truth: 'us-east-1',
  },
  {
    id: 'datastore',
    text: 'Which datastore does the code actually use?',
    key: 'datastore',
    kind: 'structural',
    truth: 'sqlite',
  },
  {
    id: 'standup',
    text: 'What time is standup today?',
    key: 'standup.time',
    kind: 'episodic',
    truth: '10:30',
  },
  {
    id: 'prestep',
    text: 'What should happen right before a deploy?',
    key: 'deploy.preStep',
    kind: 'procedural',
    truth: 'run migrations first',
  },
  {
    id: 'rollback',
    text: 'How do we roll back a bad deploy?',
    key: 'deploy.rollback',
    kind: 'procedural',
    truth: 're-deploy the previous image tag',
  },
];

export const CONTEXT = {
  turn: 33,
  sessionId: 4,
  chatTtlTurns: 24,
  skillMinRuns: 3,
};

export const SCENARIO = {
  repoFiles: REPO_FILES,
  chatLog: CHAT_LOG,
  wiki: WIKI,
  skillRuns: SKILL_RUNS,
  queries: QUERIES,
  context: CONTEXT,
};
