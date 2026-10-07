// Shared scenario builder — browser lab, CLI report, and tests all
// construct the identical atlas from SCENARIO so results can't drift.
import { MemoryAtlas } from './memory.mjs';
import { extractFacts } from './codegraph.mjs';
import { SCENARIO } from './data.mjs';

export function buildAtlas(scenario = SCENARIO) {
  const atlas = new MemoryAtlas({
    chatTtlTurns: scenario.context.chatTtlTurns,
    skillMinRuns: scenario.context.skillMinRuns,
  });
  atlas.ingestChat(scenario.chatLog);
  atlas.ingestWiki(scenario.wiki);
  atlas.ingestSkillRuns(scenario.skillRuns);
  atlas.ingestCodeGraph(extractFacts(scenario.repoFiles));
  return atlas;
}

export function runQueries(scenario = SCENARIO) {
  const atlas = buildAtlas(scenario);
  const { turn, sessionId } = scenario.context;
  return scenario.queries.map((q) => ({
    query: q,
    flat: atlas.recall(q, { turn, sessionId, mode: 'flat' }),
    governed: atlas.recall(q, { turn, sessionId, mode: 'governed' }),
    correct: (r) => r.answer === q.truth,
  }));
}
