# 稽影 (Jiying) · 多Agent信任基础设施

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

> **信任不是功能——信任是产品。**
> 每一次AI执行都可以且必须被证明：有权、受控、可恢复、可验证、可追责。

稽影是一个多Agent知识工作编排系统。核心创新：**宪法即代码**——三条哲学规则（康德/马尔库塞/海德格尔）直接编译为可执行代码，自动阻断或警告AI输出。

> 📖 **新用户？** → [5 分钟上手指南](docs/TUTORIAL.md)

---

## ⚡ 快速开始

```bash
# 通过 ClawHub 安装
npx clawhub install jiying

# 或从源码运行
git clone https://github.com/Vane1981-2011/jiying.git
cd jiying
npm install
npm run dev
```

打开 http://localhost:5173 → 输入意图 → 配置 DeepSeek API Key（设置页面）→ 点"开始"。

**你需要自己的 API Key。** 所有 AI 调用从你的浏览器直连 AI 提供商——零数据经过任何服务器。

---

## 🧬 核心创新

| 创新 | 描述 |
|:-----|:-----|
| ⚖️ **宪法即代码** | 三条可执行规则：尊严（康德，阻断）、自主（马尔库塞，警告）、追问（海德格尔，警告）。违反原则的输出自动阻断或标记。 |
| 🔗 **TEP v1.0** | 可信执行协议——Agent系统间可验证信任的开放标准。Ed25519非对称签名。防篡改。 |
| 🛡️ **7项预检门禁** | 对标Hermes：宪法状态→Agent参与→覆盖率≥60%→占位符检测→评分≥3→假设完整→去重(Jaccard>85%)。 |
| 🧠 **10种偏见交叉验证** | Critic+Defender双prompt架构。检测确认偏误、锚定效应、可得性启发、框架效应、过度自信、群体思维、沉没成本、近期偏差、归因错误、现状偏误。 |
| 📊 **不确定性预算** | 6源加权量化（数据/模型/知识/假设/推理/环境）。3级阈值（LOW/MEDIUM/HIGH）自动行动（验证/复审/拒绝）。 |
| 🔄 **断点恢复+侧效应感知重试** | DomainError 11分类。重试白名单（TIMEOUT/RATE_LIMIT/CONFLICT）。指数退避+jitter。每步Agent状态即时持久化。 |

---

## 🏗️ 架构

```
用户意图 → Planner → Researcher → Creator → Reviewer → 质量门禁 → 导出
                ↑          ↑          ↑          ↑
            宪法系统    守护进程    审计系统    演化引擎
            (block/warn) (5项监控)  (SHA-256)  (观察→学习→适应)
```

6个Agent: Planner(τ=0.3) · Researcher(τ=0.3) · Creator(τ=0.5) · Reviewer(τ=0.2) · Executor(Shell沙箱) · ShellPolicy(4级权限)

```
src/
├── constitution/       # 规则引擎 + 三条宪法 + Shell 权限策略 + 语义验证器(L2)
├── guardian/           # 后台守护进程（5 项监控：尊严/自主/追问/想像力/指标漂移）
├── agents/             # Agent 注册表 + Planner/Creator/Researcher/Reviewer/Executor
├── orchestrator/       # 6-Agent 编排引擎（并行执行 + 完全断点恢复）
├── quality/            # 质量保障层
│   ├── selfReview.js   #   导出前 7 项预检门禁
│   ├── schemas.js      #   4 角色 JSON Schema 类型校验
│   ├── devilsAdvocate.js # M2 批判性思维：10 种偏见检测 + 假设挖掘
│   ├── ethicsCheck.js  #   C8 伦理放大效应：1000× 影响 + 利害关系人分析
│   └── evolution.js    #   C9 系统自演化：Observe→Learn→Adapt→Evolve 闭环
├── tep/                # TEP v1.0 可信执行协议（信封生成+验证+恶意输入检测）
├── context/            # Token 预算控制的 Context Builder
├── knowledge/          # TF-IDF 向量检索 RAG
├── audit/              # 代偿审计收集器 + 减速点 + 周期性报告
├── store/              # Zustand 状态管理（5 个 Store）
├── pages/              # 6 个页面
├── components/         # 布局 + Markdown 渲染 + 错误边界
└── utils/              # Fallback 链 + 重试机制 + Markdown 导出
```

---

## 🏆 质量

- **155+ 测试通过** · A+ 96.45 复核评分
- VirusTotal 64引擎：全部清洁 · SkillSpector: SAFE，0问题
- 91个UZI金牌认证技能
- DomainError 11分类 + 侧效应感知重试

---

## 📦 技术栈

`React 19` `Vite 8` `Zustand` `Vercel AI SDK` `DeepSeek` `Electron` `Express` `@noble/ed25519` `Vitest`

---

## 🔗 链接

| 资源 | URL |
|:-----|:----|
| 🎨 作品展示 | [vane1981-2011.github.io/jiying/portfolio](https://vane1981-2011.github.io/jiying/portfolio/) |
| 🦞 ClawHub | [clawhub.ai/vane1981/skills/jiying](https://clawhub.ai/vane1981/skills/jiying) |
| 📄 复核报告 | [A+ 96.45](https://vane1981-2011.github.io/jiying/portfolio/稽影系列_参赛作品_复核报告.md) |

---

## 为什么叫"稽影"？

**稽** — 稽查、审视。**影** — 痕迹、映照。

> 稽察 AI 留下的每一个痕迹，审视它参与的每一道影子。

本项目基于 [叩鸣·工坊 (Kouming Workshop)](https://github.com/qq12346/kouming)（叩鸣实验室，Apache 2.0）深度架构升级——
保留宪法哲学，新增 14 项能力、40 个额外源文件、66 个额外测试用例。

---

## 📄 许可

Apache 2.0 · © 2026 Vane1981

---

*稽察审视，追影溯源 — Examine and inspect, trace shadows to their source.*
