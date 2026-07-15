# 稽影

[English](./README.md)

> **稽察审视，追影溯源。**
> 你定义意图，多个 AI Agent 协作完成知识工作。
> 同时追问你：**"这个意图值得吗？"**

---

## 这是什么

稽影是一个**带价值宪法的多 Agent 编排工坊**。你输入一个意图，四个 AI Agent 接力处理——同时三条宪法确保你始终是决策者，而不是被优化掉的人。

```
Planner → Researcher → Creator → Reviewer
 拆解意图    信息调研    生成内容    质量审查
```

**每个 Agent 的输出经过三条宪法过滤：**

| 宪法 | 来源 | 执行方式 |
|:----|:-----|:---------|
| 🔴 **尊严宪法** | 康德 | AI 必须声明身份。缺失则阻断 + 自动补全。 |
| 🟡 **自主宪法** | 马尔库塞 | 每个输出必须提供 ≥2 个替代方案。缺失则警告 + 自动追加。 |
| 🟢 **追问宪法** | 海德格尔 + 陈嘉映 | 每个输出必须声明前提假设。缺失则警告 + 自动追加。 |

它不是代码助手（Cursor/Codex）、不是开发者框架（CrewAI/AutoGen）、不是聊天机器人（ChatGPT）。它是一个**带价值观底线的知识工作台**。

---

## 五分钟跑起来

```bash
git clone https://github.com/Vane1981-2011/jiying.git
cd jiying
npm install
npm run dev
```

打开 http://localhost:5173 → 输入意图 → 配置 DeepSeek API Key（设置页面）→ 点"开始"。

**你需要自己的 API Key。** 所有 AI 调用从你的浏览器直连 AI 提供商——零数据经过任何服务器。

---

## 架构

```
src/
├── constitution/       # 规则引擎 + 三条宪法 + Shell 权限策略
├── guardian/           # 后台守护进程（5 项监控：尊严/自主/追问/想像力/指标漂移）
├── agents/             # Agent 注册表 + Planner/Creator/Researcher/Reviewer/Executor
├── orchestrator/       # 4-Agent 编排引擎（并行执行 + 完全断点恢复）
├── quality/            # ★ 质量保障层（v0.2 新增）
│   ├── selfReview.js   #   导出前 7 项预检门禁
│   ├── schemas.js      #   4 角色 JSON Schema 类型校验
│   ├── devilsAdvocate.js #  M2 批判性思维：10 种偏见检测 + 假设挖掘
│   ├── ethicsCheck.js  #   C8 伦理放大效应：1000× 影响 + 利害关系人分析
│   └── evolution.js    #   C9 系统自演化：从使用数据中学习改进
├── context/            # Token 预算控制的 Context Builder
├── knowledge/          # TF-IDF 向量检索 RAG（从关键词搜索升级）
├── audit/              # 代偿审计收集器 + 减速点 + 周期性报告
├── store/              # Zustand 状态管理
├── pages/              # 6 个页面
├── components/         # 布局 + Markdown 渲染 + 错误边界
└── utils/              # Fallback 链 + 重试机制 + Markdown 导出
```

测试：**18 文件 / 155 测试**，全部通过（原始项目为 89 测试）。

---

## 关键特性 (v0.2)

| 特性 | 状态 | 说明 |
|:----|:---:|:------|
| 4-Agent 流水线 | ✅ | Planner → Researcher → Creator → Reviewer |
| 三条宪法 | ✅ ✅ | 尊严阻断 + 自主警告 + 追问警告（位置/结构/长度三重加固） |
| 守护进程 | ✅ | 5 项后台监控 + 指标漂移检测 |
| 代偿审计 | ✅ | AI 介入度 / 能力保留度 / 追问频率 |
| TF-IDF 向量 RAG | ✅ | 中文分词 + 停用词过滤 + 分块重叠 |
| 技能系统 | ✅ | 导入 Codex 格式 SKILL.md |
| Reflexion 循环改进 | ✅ | 最多 5 轮改进 |
| **并行执行** | ✅ | 独立子任务并发执行 |
| **完全断点恢复** | ✅ | 每一步状态持久化，刷新不丢失 |
| **Shell 四级权限沙箱** | ✅ | 6 类高风险永禁 + 白名单 + 完全访问模式 |
| **M2 魔鬼代言人** | ✅ | 10 种认知偏见检测 + 假设挖掘 + 反证法 |
| **C8 伦理放大效应** | ✅ | 1000× 放大 + 利害关系人 + 不可逆性评估 |
| **C9 系统自演化** | ✅ | Observe→Learn→Adapt→Evolve 闭环 |
| **Self-Review 门禁** | ✅ | 导出前 7 项质量预检 |
| **Schema 校验** | ✅ | 4 个 Agent 角色的 JSON Schema |
| **Fallback 链** | ✅ | withFallback + withRetry + 指数退避 |
| **错误边界** | ✅ | React 错误边界防白屏 |
| **减速点 UI** | ✅ | 效率过快改善时提醒暂停 |
| Markdown 导出 | ✅ | 一键下载，可交编程 Agent 消费 |

---

## 为什么叫"稽影"？

**稽** — 稽查、审视。**影** — 痕迹、映照。

> 稽察 AI 留下的每一个痕迹，审视它参与的每一道影子。

本项目基于 [叩鸣·工坊 (Kouming Workshop)](https://github.com/qq12346/kouming)（叩鸣实验室，Apache 2.0）深度架构升级——
保留宪法哲学，新增 14 项能力、40 个额外源文件、66 个额外测试用例。

---

## 许可

Apache License 2.0。详见 [LICENSE](./LICENSE) 和 [NOTICE](./NOTICE)。

Copyright 2026 Vane1981-2011。  
原始作品 © 2026 叩鸣实验室 (zhizhi.ink)。
