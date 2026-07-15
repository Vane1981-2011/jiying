# 叩鸣·工坊 满分升级蓝图

> 用途：如果你想 fork 此项目重建为自己的品牌，这份蓝图让你从零开始
> 原始项目：https://github.com/qq12346/kouming (Apache 2.0)
> 升级作者：[你的名字]
> 升级日期：2026-07-15

---

## 架构增量总览

原始项目（v0.1-MVP，18 源文件）→ 升级后（v0.2，58 源文件）

### 新增 14 个核心文件

```
src/
├── agents/
│   ├── executor.js          # Executor Agent：宪法过滤→权限决策→沙箱执行
│   └── shellPolicy.js       # 四级权限引擎：6类高风险永禁 + 中风险warn + 低风险prompt + 白名单allow
│
├── quality/                 # ★ 新增质量保障层
│   ├── selfReview.js        # 导出前7项预检（对标Hermes self_review.py）
│   ├── schemas.js           # 4角色JSON schema校验（对标Hermes DimResult）
│   ├── devilsAdvocate.js    # M2批判性思维：10种偏见检测+假设挖掘+反证法
│   ├── ethicsCheck.js       # C8伦理放大：利害关系人+1000×放大+不可逆性
│   └── evolution.js         # C9系统自演化：Observe→Learn→Adapt→Evolve闭环
│
├── utils/
│   └── fallback.js          # 链式容错：withFallback + withRetry + 指数退避
│
├── components/
│   └── ErrorBoundary.jsx    # React错误边界（防止白屏）
│
└── docs/
    └── mad-think-assessment.md  # MAD-THINK全维度评估报告
    └── self-assessment-s5.md   # S5反哺闭环报告
    └── upgrade-blueprint.md    # 本文档
```

### 升级的 12 个已有文件

| 文件 | 升级内容 |
|:----|:---------|
| `src/orchestrator/index.js` | 并行Creator执行 + 完全断点恢复（每步立即持久化） + C9演化记录 |
| `src/knowledge/manager.js` | 关键词搜索 → TF-IDF向量检索 + 中文分词 + 停用词 + 分块重叠 |
| `src/constitution/rules.js` | 尊严位置检测 + 自主结构化列表 + 追问段落长度 + 多模式匹配 |
| `src/agents/model.js` | 引入 withFallback + 指数退避重试 + timeout控制 |
| `src/pages/AssemblyLine.jsx` | 魔鬼代言人按钮 + 伦理检查 + Self-Review质量报告 + 减速点UI |
| `src/pages/Settings.jsx` | Shell执行开关启用 + 完全访问模式 |
| `src/utils/export.js` | 导出前自动执行Self-Review门禁 + 质量报告返回 |
| `src/pages/AuditPanel.jsx` | 审计历史持久化（已通过audit/collector.js支持） |
| `vitest.config.js` | jsdom环境配置（localStorage测试支持） |
| `src/guardian/index.test.js` | 适配Zustand存储的新架构（修复5个测试） |
| `src/orchestrator/index.test.js` | 适配并行+断点恢复新架构 |
| `src/constitution/rules.test.js` | 新增7个增强检查测试 |

---

## 如果要重建为自己的品牌

### 你需要改的 8 个文件（最小集）

```
1. package.json           → name, productName, appId
2. electron/main.cjs      → 窗口标题
3. electron/package.json  → name
4. electron/preload.cjs   → 暴露的API名（可选）
5. src/constitution/rules.js  → 宪法正则 + remedy文本
6. src/utils/export.js    → 导出 footer 文本
7. src/pages/Dashboard.jsx → 首页欢迎文案
8. README.md / README_CN.md → 完整重写

+ 全局搜索替换（推荐用 sed）：
  "叩鸣·工坊" → "你的品牌名"
  "zhizhi.ink" → "你的域名"
  LOCALSTORAGE键前缀 kouming- → 你的前缀
```

### 建议不动的部分（法律合规）

```
LICENSE            → Apache 2.0 必须保留
NOTICE（新建）      → 记录所有修改来源
宪法正则中的"叩鸣"  → 最好保留（兼容旧输出匹配）
```

---

## 技术债记录（我已知但没时间修的）

| # | 问题 | 影响 | 建议修复 |
|:-:|:-----|:----|:---------|
| 1 | evolution.js 只用 localStorage，数据上限 500 条 | 长期使用可能溢出 | v0.3 迁移到 IndexedDB |
| 2 | AssemblyLine.jsx 831 行，偏大 | 可维护性下降 | 拆为 3 个组件: AgentCardsPanel / ContextPanel / QualityPanel |
| 3 | 无 TypeScript | 运行时类型错误只能靠测试捕获 | 渐进迁移：先 quality/ 目录 |
| 4 | 无 E2E 测试 | 只测了单元，没测用户流程 | Cypress / Playwright |
| 5 | devilsAdvocate 依赖正则而非 AI | 检测深度有限 | 第二阶段接入 LLM 做语义级魔鬼代言人 |
