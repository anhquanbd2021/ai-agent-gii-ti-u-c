// Memory Atlas — four substrates, one recall contract.
//
// The bug this lab reproduces: treating "memory" as one flat pile.
// Flat recall ranks every stored claim by recency, so a stale episodic
// note ("ship to eu-west-1", repeated yesterday out of habit) outranks
// the structural fact that the code deploys to us-east-1.
//
// Governed recall adds the discipline real systems need:
//   - substrate authority by question kind (structural Q -> code-graph)
//   - TTL on episodic entries (chat memory decays)
//   - session scope (chat from other sessions doesn't leak)
//   - promotion threshold (a skill is recallable only after N successes)
//   - provenance on every entry (you can drill down to the evidence)

export const SUBSTRATES = ['chat', 'skill', 'wiki', 'codegraph'];

export const SUBSTRATE_INFO = {
  chat: {
    kind: 'episodic',
    label: 'Chat Memory',
    scope: 'session',
    decays: true,
    authority: 1,
    blurb: 'What was said in dialogue. Session-local by default; decays.',
  },
  skill: {
    kind: 'procedural',
    label: 'Skill',
    scope: 'global',
    decays: false,
    authority: 2,
    blurb: 'Reusable procedures distilled from successful runs.',
  },
  wiki: {
    kind: 'semantic',
    label: 'LLM-Wiki',
    scope: 'global',
    decays: false,
    authority: 3,
    blurb: 'Curated, citable knowledge. Written deliberately, not logged.',
  },
  codegraph: {
    kind: 'structural',
    label: 'Code-Graph',
    scope: 'repo',
    decays: false,
    authority: 4,
    blurb: 'What the codebase IS — derived from source, not from chat.',
  },
};

// Which substrate is the source of truth for each question kind.
export const QUESTION_ROUTING = {
  structural: ['codegraph', 'wiki', 'chat'],
  semantic: ['wiki', 'codegraph', 'chat'],
  procedural: ['skill', 'wiki', 'chat'],
  episodic: ['chat', 'wiki'],
};

export const DEFAULTS = {
  chatTtlTurns: 24, // episodic entries expire unless re-confirmed
  skillMinRuns: 3, // a skill is recallable only after this many successes
};

let nextId = 1;

export class MemoryAtlas {
  constructor({ chatTtlTurns = DEFAULTS.chatTtlTurns, skillMinRuns = DEFAULTS.skillMinRuns } = {}) {
    this.chatTtlTurns = chatTtlTurns;
    this.skillMinRuns = skillMinRuns;
    this.entries = [];
  }

  write(substrate, { key, value, sessionId = null, turn = 0, confidence = 0.7, provenance = 'unknown', runs = 0 }) {
    if (!SUBSTRATES.includes(substrate)) throw new Error(`unknown substrate: ${substrate}`);
    const entry = {
      id: `m${nextId++}`,
      substrate,
      key,
      value,
      sessionId,
      turn,
      confidence,
      provenance,
      runs,
    };
    this.entries.push(entry);
    return entry;
  }

  ingestChat(events) {
    for (const e of events) {
      this.write('chat', {
        key: e.key,
        value: e.value,
        sessionId: e.sessionId,
        turn: e.turn,
        confidence: e.confidence ?? 0.7,
        provenance: `chat session ${e.sessionId}, turn ${e.turn}`,
      });
    }
  }

  ingestWiki(facts) {
    for (const f of facts) {
      this.write('wiki', {
        key: f.key,
        value: f.value,
        confidence: 0.9,
        provenance: f.source,
      });
    }
  }

  ingestSkillRuns(runs) {
    // Group recorded runs by skill; one candidate entry per skill.
    // The candidate keeps the most recent run's turn, so flat recall can
    // mistake a fresh-but-unproven habit for a real skill.
    const bySkill = new Map();
    for (const r of runs) {
      const cur = bySkill.get(r.skill) || { successes: 0, provenance: [], lastTurn: 0 };
      if (r.success) cur.successes += 1;
      cur.provenance.push(r.provenance);
      cur.lastTurn = Math.max(cur.lastTurn, r.turn || 0);
      bySkill.set(r.skill, cur);
    }
    for (const [skillKey, agg] of bySkill) {
      const [key, value] = skillKey.split('::');
      this.write('skill', {
        key,
        value,
        turn: agg.lastTurn,
        runs: agg.successes,
        confidence: Math.min(0.95, 0.5 + agg.successes * 0.15),
        provenance: `distilled from ${agg.successes} run(s): ${agg.provenance.join(', ')}`,
      });
    }
  }

  ingestCodeGraph(facts) {
    for (const f of facts) {
      this.write('codegraph', {
        key: f.key,
        value: f.value,
        confidence: 1.0,
        provenance: f.evidence,
      });
    }
  }

  candidates(key) {
    return this.entries.filter((e) => e.key === key);
  }

  // Why a single entry is excluded under governed recall. Returns a
  // reason string, or null if the entry is eligible.
  suppressionReason(entry, { turn, sessionId }) {
    const info = SUBSTRATE_INFO[entry.substrate];
    if (entry.substrate === 'chat') {
      if (info.decays && turn - entry.turn > this.chatTtlTurns) {
        return `expired: episodic TTL is ${this.chatTtlTurns} turns (idle ${turn - entry.turn})`;
      }
      if (entry.sessionId !== sessionId) {
        return `out of scope: session-${entry.sessionId} chat does not leak into session ${sessionId}`;
      }
    }
    if (entry.substrate === 'skill' && entry.runs < this.skillMinRuns) {
      return `unpromoted: ${entry.runs}/${this.skillMinRuns} successful runs — not yet a skill`;
    }
    return null;
  }

  /**
   * recall(question, opts)
   *   question = { key, kind } where kind in QUESTION_ROUTING
   *   mode 'flat':     rank by recency then confidence — no TTL, no
   *                    scope, no authority. The bug.
   *   mode 'governed': filter suppressed entries, then prefer the
   *                    routed substrate for the question kind.
   */
  recall(question, { turn, sessionId, mode = 'governed' }) {
    const all = this.candidates(question.key);
    const considered = [];
    const suppressed = [];

    for (const entry of all) {
      const reason = mode === 'governed' ? this.suppressionReason(entry, { turn, sessionId }) : null;
      (reason ? suppressed : considered).push(reason ? { entry, reason } : entry);
    }

    let ranked;
    if (mode === 'flat') {
      ranked = [...considered].sort(
        (a, b) => b.turn - a.turn || b.confidence - a.confidence,
      );
    } else {
      const routing = QUESTION_ROUTING[question.kind] || SUBSTRATES;
      const rankOf = (e) => {
        const idx = routing.indexOf(e.substrate);
        return idx === -1 ? routing.length : idx;
      };
      ranked = [...considered].sort(
        (a, b) => rankOf(a) - rankOf(b) || b.confidence - a.confidence || b.turn - a.turn,
      );
    }

    const winner = ranked[0] || null;
    return {
      question,
      mode,
      answer: winner ? winner.value : null,
      winner,
      runnerUps: ranked.slice(1),
      suppressed,
    };
  }

  // All keys where substrates disagree — the conflict surface that flat
  // recall hides.
  conflicts() {
    const byKey = new Map();
    for (const e of this.entries) {
      if (!byKey.has(e.key)) byKey.set(e.key, new Map());
      byKey.get(e.key).set(e.value, (byKey.get(e.key).get(e.value) || 0) + 1);
    }
    return [...byKey.entries()]
      .filter(([, values]) => values.size > 1)
      .map(([key, values]) => ({ key, values: [...values.keys()] }));
  }
}
