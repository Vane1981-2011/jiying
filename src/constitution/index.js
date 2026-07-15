/**
 * 稽影 — 宪法规则引擎
 *
 * 借鉴 OpenAI Codex execpolicy 的三态决策模式
 * Codex: command → execpolicy.check() → allow/prompt/forbidden
 * 稽影: agent_output → constitution.filter() → pass/warn/block
 *
 * 这是产品第0层的物理实现。三条宪法（尊严/自主/追问）是不可拔插的系统底座，
 * 任何 Agent 的输出都必须经过此过滤器。
 */

import { RULES } from './rules';

/**
 * 过滤 Agent 输出，逐个规则检查
 *
 * @param {string} output - Agent 生成的原始文本
 * @returns {{
 *   status: 'pass' | 'warn' | 'block',
 *   violations: Array<{rule: string, decision: string, justification: string}>,
 *   remediedOutput: string,
 *   originalOutput: string,
 * }}
 *
 * 决策逻辑（借鉴 execpolicy 的 severity 取最高原则）：
 * - 任一规则 decision='block' → 整体 status='block'
 * - 任一规则 decision='warn' 且无 block → 整体 status='warn'
 * - 全部通过 → status='pass'
 */
export function filter(output) {
  let maxSeverity = 0; // 0=pass, 1=warn, 2=block
  const violations = [];
  let remedied = output;

  for (const rule of RULES) {
    if (rule.condition(output)) {
      const severity = rule.decision === 'block' ? 2 : 1;
      if (severity > maxSeverity) maxSeverity = severity;

      violations.push({
        rule: rule.type,
        decision: rule.decision,
        justification: rule.justification,
      });

      remedied = rule.remedy(remedied);
    }
  }

  const status = maxSeverity === 2 ? 'block' : maxSeverity === 1 ? 'warn' : 'pass';

  // 二次检查：补救文本可能引入新问题
  if (remedied !== output) {
    for (const rule of RULES) {
      if (rule.condition(remedied)) {
        remedied = rule.remedy(remedied);
      }
    }
  }

  return { status, violations, remediedOutput: remedied, originalOutput: output };
}

/**
 * 检查 Agent 输出是否通过宪法
 * 便捷方法——只返回 boolean
 */
export function passes(output) {
  return filter(output).status !== 'block';
}
