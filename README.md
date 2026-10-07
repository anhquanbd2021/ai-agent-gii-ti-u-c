# Memory Atlas

A zero-dependency Node 20+ lab that demonstrates why "agent memory" is
not one thing — it is four substrates with different semantics, and a
recall path that treats them identically will eventually serve a stale
fact with full confidence.

Companion to the LinkedIn article *"Your Agent's Memory Is Four Things,
Not One"*.

## What it proves

A fictional **payments** service seeds four memory substrates:

| Substrate | Kind | Truth source for |
|---|---|---|
| Chat Memory | episodic | what was *said* this session |
| Skill | procedural | what repeatedly *worked* (≥3 runs) |
| LLM-Wiki | semantic | curated, citable knowledge |
| Code-Graph | structural | what the code *is* right now |

Five questions are then run through two recall strategies:

- **Flat recall** — rank by recency + confidence. The bug: a recently
  repeated chat habit ("ship to eu-west-1") beats the code-graph fact
  (`region: us-east-1` in `infra/deploy.yaml`); a one-run "skill" is
  recalled like a proven one. Flat scores **2/5**.
- **Governed recall** — route each question kind to its source of
  truth, expire episodic entries by TTL, scope chat to its session, and
  hold skills back until they earn promotion. Governed scores **5/5** —
  and it still answers the standup question from chat, because episodic
  memory is the *right* substrate for episodic questions.

## Run it

```bash
npm start          # serve the lab on $PORT (default 3000)
npm run report     # CLI side-by-side from examples/ disk fixtures
npm test           # node:test suite (33 tests across 5 files)
npm run check      # tests + report (what render.yaml runs)
```

Open the lab and click a question to see both answers side by side,
including which entries governed recall suppressed and why.

## Layout

- `app/server.js` — hardened allowlist static server + `/health` + `/version`
- `public/memory.mjs` — the four substrates, `recall()` flat vs governed
- `public/codegraph.mjs` — structural fact extraction with `file:line` evidence
- `public/atlas.mjs` — scenario builder shared by lab, CLI, and tests
- `public/data.mjs` — embedded scenario (mirrors `examples/` — parity-tested)
- `examples/` — `atlas-scenario.json` + a real `repo/` fixture tree
- `scripts/atlas-report.mjs` — side-by-side report, hard assertions, exit 1 on failure
- `test/` — memory semantics, code-graph extraction, scenario, server, fixtures

## Honest limits

This is a teaching model, not a memory system. Routing is a static
table; code-graph extraction is regexes over four fixture files; "turns"
are integers, not wall-clock time; there is no embedding search, no
compaction, and no persistence. Real systems — e.g.
[TencentDB Agent Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory),
which inspired the scenario — add layered L0→L3 memories, hybrid
retrieval, and symbolized short-term state. What the lab *does* capture
faithfully is the failure mode: any recall path blind to which substrate
a fact came from will eventually serve a confident, stale answer.
