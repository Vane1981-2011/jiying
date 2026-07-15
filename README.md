# 稽影 (Jiying)

[中文版](./README_CN.md)

> **稽察审视，追影溯源。**
> You define the intent. Four AI agents collaborate on knowledge work.
> One question runs under everything: **"Is this intent worth it?"**

---

## What is this?

稽影 is a **multi-Agent orchestration workshop with embedded value constitution**. You input one intent, and four AI agents work in sequence — while three constitutional rules ensure you remain the decision-maker, not the optimized-away human.

```
Planner → Researcher → Creator → Reviewer
 Decompose    Investigate    Generate    Review
```

**Every agent output is filtered through three constitutional rules:**

| Rule | Origin | Enforcement |
|:----|:-------|:-----------|
| 🔴 **Dignity** | Kant — "Humanity is an end, not a means" | AI must declare its identity. Block + auto-remedy if missing. |
| 🟡 **Autonomy** | Marcuse — "Eliminating alternatives = eliminating freedom" | Every output must offer ≥2 alternatives. Warn + auto-append if missing. |
| 🟢 **Inquiry** | Heidegger — "Questioning is itself resistance" | Every output must state its assumptions. Warn + auto-append if missing. |

It is **not** a code assistant (like Cursor/Codex), **not** a developer framework (like CrewAI/AutoGen), **not** a chatbot (like ChatGPT). It is a **knowledge workbench where AI does the work, and the value constitution ensures you don't get worked over.**

---

## Quick Start

```bash
git clone https://github.com/Vane1981-2011/jiying.git
cd jiying
npm install
npm run dev
```

Open http://localhost:5173 → enter an intent → configure your DeepSeek API Key (Settings) → press Start.

**You need your own API Key.** All AI calls go directly from your browser to the AI provider — zero data passes through any server.

---

## Architecture

```
src/
├── constitution/       # Rules engine + 3 constitutional rules + Shell policy
├── guardian/           # Background daemon (5 monitors: dignity/agency/imagination/questioning/drift)
├── agents/             # Agent registry + Planner/Creator/Researcher/Reviewer/Executor
├── orchestrator/       # 4-Agent orchestration engine (parallel execution + full resume)
├── quality/            # ★ Quality assurance layer (new in v0.2)
│   ├── selfReview.js   #   7 pre-flight checks before export
│   ├── schemas.js      #   Schema-first JSON validation for all agent output
│   ├── devilsAdvocate.js #  M2 critical thinking: 10 bias detectors + assumption mining
│   ├── ethicsCheck.js  #   C8 ethics amplification: 1000× impact + stakeholder analysis
│   └── evolution.js    #   C9 anti-fragility: system self-evolution from usage data
├── context/            # Token-budget-controlled context builder
├── knowledge/          # TF-IDF vector search RAG (upgraded from keyword search)
├── audit/              # Compensatory audit collector + speed bumps + periodic reports
├── store/              # Zustand state (user/intent/agent/skills/guardian)
├── pages/              # 6 pages (Dashboard / Assembly Line / Reflection / Skills / Audit / Settings)
├── components/         # Layout + Markdown renderer + ErrorBoundary
└── utils/              # Fallback chain + retry + markdown export
```

Tests: **18 test files / 155 test cases** — all passing. v0.1-MVP had 89 tests.

---

## Key Features (v0.2)

| Feature | Status | Description |
|:--------|:------:|:------------|
| 4-Agent Pipeline (P→R→C→C→R→V) | ✅ | Planner → Researcher → Creator → Reviewer |
| 3 Constitutional Rules | ✅ ✅ | Dignity block + Autonomy warn + Inquiry warn (enhanced position/structure/length detection) |
| Guardian Daemon | ✅ | 5 background monitors + metric drift tracking |
| Compensatory Audit | ✅ | AI dependency score / agency retention / questioning frequency |
| TF-IDF Vector RAG | ✅ | Tokenization + stopword filtering + overlapping chunks |
| Skill System | ✅ | Import Codex-format SKILL.md from openai/skills, LobeHub, etc. |
| Reflexion Loop | ✅ | Up to 5 improvement cycles based on Reviewer feedback |
| **Parallel Execution** | ✅ | Independent subtasks run concurrently |
| **Full Breakpoint Recovery** | ✅ | State persisted after every step; refresh-safe |
| **Shell 4-Level Sandbox** | ✅ | 6 categories of permanently forbidden commands + whitelist + full-access mode |
| **Devil's Advocate (M2)** | ✅ | 10 cognitive biases detected + assumption mining + counter-evidence |
| **Ethics Amplification (C8)** | ✅ | 1000× scaling + stakeholder analysis + irreversibility assessment |
| **System Evolution (C9)** | ✅ | Observe→Learn→Adapt→Evolve cycle from usage data |
| **Self-Review Quality Gate** | ✅ | 7 pre-flight checks before markdown export |
| **Schema-First Validation** | ✅ | JSON schema for all 4 agent roles |
| **Fallback Chain** | ✅ | withFallback + withRetry + exponential backoff |
| **Error Boundary** | ✅ | React error boundary prevents white screen |
| **Speed Bump UI** | ✅ | Task pace warning when efficiency improves too fast |
| Markdown Export | ✅ | One-click download, programming-agent ready |

---

## Why "稽影"?

**稽 (jī)** — to examine, to investigate, to audit.  
**影 (yǐng)** — shadow, trace, reflection.

> Examine every trace the AI leaves behind. Audit every shadow of its participation.

The original project was [叩鸣·工坊 (Kouming Workshop)](https://github.com/qq12346/kouming) by 叩鸣实验室 (zhizhi.ink), Apache 2.0 licensed. 稽影 is a deep architectural upgrade — retaining the constitutional philosophy while adding 14 new capabilities, 66 additional source files, and 66 more tests.

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

Copyright 2026 Vane1981-2011.  
Original work © 2026 叩鸣实验室 (zhizhi.ink).
