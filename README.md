# 稽影 (Jiying) · Multi-Agent Trust Infrastructure

<p align="center">
  <img src="docs/banner.png" alt="稽影 Jiying" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.4.1-blue" alt="version">
  <img src="https://img.shields.io/badge/license-Apache%202.0-green" alt="license">
  <img src="https://img.shields.io/badge/tests-178%20passed-brightgreen" alt="tests">
  <a href="https://github.com/Vane1981-2011/jiying/actions"><img src="https://img.shields.io/badge/CI-passing-brightgreen" alt="CI"></a>
  <a href="https://clawhub.ai/vane1981/skills/jiying"><img src="https://img.shields.io/badge/ClawHub-217%20downloads-orange" alt="downloads"></a>
  <img src="https://img.shields.io/badge/review-A%2B%2096.45-gold" alt="review">
</p>

> **Trust is not a feature — trust is the product.**
> Every AI execution must and can be proven: authorized, controlled, recoverable, verifiable, and accountable.

Jiying is a multi-agent knowledge-work orchestration system. Its core innovation: **Constitution-as-Code** — three philosophical rules (Kant / Marcuse / Heidegger) directly compiled into executable code that automatically blocks or warns AI outputs.

> 📖 **新用户？** → [5 分钟上手指南](docs/TUTORIAL.md)

---

## ⚡ Quick Start

```bash
# Install via ClawHub
npx clawhub install jiying

# Start the server
cd jiying && node server/index.js

# Run the audit
python tao/tao_engine.py audit-verify
```

---

## 🧬 Core Innovations

| Innovation | Description |
|:-----------|:------------|
| ⚖️ **Constitution-as-Code** | Three executable rules: Dignity (Kant, block), Autonomy (Marcuse, warn), Questioning (Heidegger, warn). Outputs that violate principles are automatically blocked or flagged. |
| 🔗 **TEP v1.0** | Trusted Execution Protocol — open standard for verifiable trust between agent systems. Ed25519 asymmetric signatures. Tamper-proof. |
| 🛡️ **7 Pre-flight Quality Gates** | Aligned with Hermes: constitution status → agent participation → coverage ≥60% → placeholder detection → reviewer scoring → assumption completeness → deduplication (Jaccard >85%). |
| 🧠 **10 Bias Cross-Validation** | Critic + Defender dual-prompt architecture. Detects confirmation bias, anchoring, availability heuristic, framing effects, overconfidence, groupthink, sunk cost, recency bias, attribution error, status quo bias. |
| 📊 **Uncertainty Budget** | 6-source weighted quantification (data/model/knowledge/assumption/reasoning/environment). 3-level threshold (LOW/MEDIUM/HIGH) with automatic actions (verify/review/refuse). |
| 🔄 **Checkpoint Recovery + Side-effect-aware Retry** | DomainError 11-category taxonomy. Retry whitelist (TIMEOUT/RATE_LIMIT/CONFLICT only). Exponential backoff with jitter. Each Agent step persisted immediately. |

---

## 🏗️ Architecture

```
User Intent → Planner → Researcher → Creator → Reviewer → Quality Gates → Export
                  ↑          ↑          ↑          ↑
              Constitution  Guardian   Audit     Evolution
              (block/warn)  (5 daemons) (SHA-256) (Observe→Learn→Adapt)
```

6 Agents: Planner (τ=0.3) · Researcher (τ=0.3) · Creator (τ=0.5) · Reviewer (τ=0.2) · Executor (Shell Sandbox) · ShellPolicy (4-level permissions)

---

## 📦 Tech Stack

`React 19` `Vite 8` `Zustand` `Vercel AI SDK` `DeepSeek` `Electron` `Express` `@noble/ed25519` `Vitest`

---

## 🏆 Quality

- **155+ tests passing** · A+ 96.45 review score
- VirusTotal 64 engines: all clean · SkillSpector: SAFE, 0 issues
- 91 UZI Gold certified skills in ecosystem
- DomainError 11 categories with side-effect-aware retry

---

## 🔗 Links

| Resource | URL |
|:---------|:----|
| 🎨 Portfolio | [vane1981-2011.github.io/jiying/portfolio](https://vane1981-2011.github.io/jiying/portfolio/) |
| 🦞 ClawHub | [clawhub.ai/vane1981/skills/jiying](https://clawhub.ai/vane1981/skills/jiying) |
| 📄 Review Report | [A+ 96.45](https://vane1981-2011.github.io/jiying/portfolio/稽影系列_参赛作品_复核报告.md) |

---

## 📄 License

Apache 2.0 · © 2026 Vane1981

---

*稽察审视，追影溯源 — Examine and inspect, trace shadows to their source.*
