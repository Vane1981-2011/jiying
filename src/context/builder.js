/**
 * 稽影 — Context Builder
 *
 * 借鉴 OpenAI Codex 的 context management 规则：
 * - 上下文增量构建，不重写历史
 * - 无边界项设硬上限
 * - 每项不超过 token 预算
 */

import { RULES } from '../constitution/rules';

export const TOKEN_BUDGET = {
  constitution: 500,
  agentRole: 300,
  intent: 1000,
  trace: 300,
  values: 200,
  total: 2300,
};

function estimateTokens(text) {
  return Math.ceil((text || '').length / 2);
}

function truncate(text, maxTokens) {
  if (!text) return '';
  const chars = maxTokens * 2;
  return text.length > chars ? text.slice(0, chars) + '...' : text;
}

function buildConstitutionSection() {
  return RULES.map((r) => `- ${r.type}: ${r.justification}`).join('\n');
}

function buildValuesSection(values) {
  const labels = {
    speed: { speed: '快速', accuracy: '准确', depth: '深度' },
    coverage: { coverage: '全面', focus: '聚焦', key_points: '关键点' },
    novelty: { novelty: '创新', feasibility: '可行', reliability: '可靠' },
  };
  return Object.entries(values)
    .map(([k, v]) => `- ${labels[k]?.[v] || v}`)
    .join('\n');
}

/**
 * 构建 Agent 的 system prompt
 */
export function buildContext({ role, intent, trace, values, subtask, plannerReasoning }) {
  const constitution = buildConstitutionSection();
  const valuesText = buildValuesSection(values || {});

  const rolePrompt = getRolePrompt(role);

  const systemPrompt = [
    rolePrompt,
    '',
    '[宪法约束 — 以下规则不可妥协]',
    constitution,
    '',
    '[用户意图]',
    `目标: ${truncate(intent?.goal || '', 500)}`,
    `背景: ${truncate(intent?.background || '', 200)}`,
    `约束: ${truncate(intent?.constraints || '', 200)}`,
    `成功标准: ${truncate(intent?.successCriteria || '', 200)}`,
  ];

  if (trace && !trace.skipped) {
    systemPrompt.push(
      '',
      '[意图溯源追问]',
      `服务于: ${truncate(trace.serves, 100)}`,
      `"好"的定义: ${truncate(trace.definedGood, 100)}`,
      trace.alternative ? `替代关注: ${truncate(trace.alternative, 100)}` : '',
    );
  }

  systemPrompt.push(
    '',
    '[用户的价值观偏好]',
    valuesText || '(使用默认值)',
  );

  if (subtask && plannerReasoning) {
    systemPrompt.push(
      '',
      '[当前子任务]',
      `标题: ${truncate(subtask.title, 100)}`,
      `目标: ${truncate(subtask.goal, 200)}`,
      '',
      '[Planner 的拆解依据]',
      truncate(plannerReasoning, 300),
    );
  }

  // Token 预算检查
  const systemText = systemPrompt.join('\n');
  const estimatedTokens = estimateTokens(systemText);
  if (estimatedTokens > TOKEN_BUDGET.total + 1000) {
    console.warn(`[Context Builder] Token 预算超限: ${estimatedTokens} > ${TOKEN_BUDGET.total}`);
  }

  return {
    messages: [
      { role: 'system', content: systemText },
      { role: 'user', content: buildUserMessage({ intent, subtask }) },
    ],
    estimatedTokens,
  };
}

function getRolePrompt(role) {
  const prompts = {
    planner: `你是稽影的 Planner Agent。你的任务是拆解用户的意图为 2-5 个可独立执行的子任务。

输出格式（必须严格 JSON）：
{
  "subtasks": [
    {"id": 1, "title": "子任务标题", "goal": "子任务目标描述", "dependsOn": []},
    ...
  ],
  "reasoning": "我为什么这样拆解..."
}

在拆解时：
1. 每个子任务应有明确的目标和产出
2. 子任务之间应有逻辑顺序
3. 考虑用户的价值偏好`,

    researcher: `你是稽影的 Researcher Agent。你的任务是对给定的子任务进行信息调研。

你必须：
1. 提供结构化的调研结果
2. 在每条信息后标注来源类型：
   - [一手]：来自官方文件、原始数据
   - [二手]：来自可信的第三方分析
   - [推断]：基于逻辑推理，未经验证

3. 在末尾附加"我的假设"段落`,

    creator: `你是稽影的 Creator Agent。你的任务是生成高质量的内容。

不要重复：每个观点、段落、标题只说一次。不要在末尾重复输出之前的任何内容。

在输出末尾，你必须附加一个"我的假设"段落。格式：
---
我的假设：
1. 我假设你更关心 [速度/准确性/...]
2. 我假设目标受众是 [...]
3. 我假设你期望 [确定性结论/保留不确定性/...]

如果提供了 Planner 的拆解依据或参考信息，请优先参考它们来生成内容。`,

    reviewer: `你是稽影的 Reviewer Agent。你的任务是审查以下内容的质量。

请检查：
1. 事实准确率：内容中的事实陈述是否有明显错误？
2. 逻辑完整性：论证链条是否完整？有无跳跃？
3. 与原始意图的匹配度：是否回应了用户的意图？

严格模式下还需要检查：
4. 逻辑谬误：是否存在稻草人论证、滑坡谬误、虚假两难等？
5. 确认偏误：是否只呈现了支持某一观点的证据？
6. 替代视角：是否有未被考虑的视角？

输出格式（JSON）：
{
  "scores": { "accuracy": 1-5, "logic": 1-5, "intentMatch": 1-5, "fallacyCheck": 1-5, "biasCheck": 1-5 },
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "overall": 1-5,
  "verdict": "pass" | "revise" | "reject"
}`,
  };
  return prompts[role] || prompts.creator;
}

function buildUserMessage({ intent, subtask }) {
  if (subtask) {
    return `请为以下子任务生成内容：\n\n${subtask.title}\n\n${subtask.goal}`;
  }
  if (intent?.goal) {
    return `请根据 system prompt 中的意图和约束开始工作。\n\n意图简述: ${intent.goal}`;
  }
  return `请处理以上意图。`;
}
