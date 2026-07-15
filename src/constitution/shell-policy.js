/**
 * 稽影 — Shell 权限策略引擎
 *
 * 借鉴 OpenAI Codex execpolicy 的四级权限模型：
 *   allow → 自动执行（完全访问 + 白名单）
 *   prompt → 弹窗确认
 *   warn → 弹窗 + 加强提示
 *   forbidden → 宪法拦截，不可绕过
 *
 * 高风险命令（rm/sudo/chmod/kill）永禁——即使在完全访问模式下。
 */

/**
 * @typedef {'allow'|'prompt'|'warn'|'forbidden'} Decision
 * @typedef {'low'|'medium'|'high'} RiskLevel
 */

const POLICIES = [
  // 只读命令
  {
    pattern: ['cat', 'head', 'tail', 'wc', 'grep', 'ls', 'find', 'du', 'df', 'file', 'echo', 'pwd', 'whoami', 'date', 'uname', 'which'],
    decision: 'prompt',
    fullAccessDecision: 'allow',
    risk: 'low',
  },
  // 脚本执行
  {
    pattern: ['python', 'python3', 'node', 'Rscript', 'jq', 'awk', 'sed'],
    decision: 'prompt',
    fullAccessDecision: 'allow',
    risk: 'medium',
  },
  // Git 只读
  {
    pattern: [
      ['git', 'status'],
      ['git', 'diff'],
      ['git', 'log'],
      ['git', 'branch'],
      ['git', 'remote'],
      ['git', 'stash', 'list'],
    ],
    decision: 'prompt',
    fullAccessDecision: 'allow',
    risk: 'low',
  },
  // Git 写入（永远 prompt）
  {
    pattern: [
      ['git', 'add'],
      ['git', 'commit'],
      ['git', 'push'],
      ['git', 'merge'],
      ['git', 'rebase'],
      ['git', 'checkout'],
      ['git', 'reset'],
      ['git', 'stash'],
    ],
    decision: 'prompt',
    fullAccessDecision: 'prompt', // 即使在完全访问模式下也需确认
    risk: 'medium',
  },
  // 文件修改
  {
    pattern: ['mkdir', 'cp', 'mv', 'touch', 'ln', 'chown', 'chmod'],
    decision: 'warn',
    fullAccessDecision: 'prompt',
    risk: 'medium',
  },
  // 网络操作
  {
    pattern: ['curl', 'wget'],
    decision: 'prompt',
    fullAccessDecision: 'prompt',
    risk: 'medium',
    requiresNetwork: true,
  },
  // 破坏性命令（永禁）
  {
    pattern: ['rm', 'sudo', 'kill', 'killall', 'shutdown', 'reboot', 'dd', 'mkfs'],
    decision: 'forbidden',
    fullAccessDecision: 'forbidden',
    risk: 'high',
    justification: '破坏性操作——不可逆的数据损失风险。此命令在稽影中永久禁止。',
  },
];

/** 默认策略：未匹配的命令一律禁止 */
const DEFAULT_POLICY = {
  decision: 'forbidden',
  risk: 'high',
  justification: '未知命令，出于安全考虑已拦截。',
};

/**
 * 检查 shell 命令是否允许执行
 *
 * @param {string} cmd - 完整的 shell 命令字符串
 * @param {object} options
 * @param {boolean} options.fullAccess - 是否开启完全访问模式
 * @param {string[]} [options.whitelist] - 白名单命令
 * @returns {{ decision: Decision, risk: RiskLevel, requiresNetwork?: boolean, justification?: string }}
 */
export function checkCommand(cmd, options = {}) {
  const { fullAccess = false, whitelist = [] } = options;
  const tokens = cmd.trim().split(/\s+/);
  const baseCmd = tokens[0];

  for (const policy of POLICIES) {
    if (matchesPolicy(tokens, policy.pattern)) {
      // 完全访问模式：只有白名单中的命令才能获得 allow 决策
      const canAutoExecute = fullAccess && whitelist.includes(baseCmd);
      const effectiveDecision = canAutoExecute
        ? (policy.fullAccessDecision || policy.decision)
        : policy.decision;

      return {
        decision: effectiveDecision,
        risk: policy.risk,
        requiresNetwork: policy.requiresNetwork || false,
        justification: policy.justification || undefined,
      };
    }
  }

  return { ...DEFAULT_POLICY };
}

/**
 * 检查命令 token 是否匹配策略的 pattern
 */
function matchesPolicy(tokens, pattern) {
  if (!Array.isArray(pattern[0])) {
    // 简单模式：['cat', 'ls', ...]
    return pattern.includes(tokens[0]);
  }

  // 嵌套模式：[['git', 'status'], ['git', 'diff']]
  return pattern.some((p) => {
    if (!Array.isArray(p)) return p === tokens[0];
    return p.every((t, i) => tokens[i] === t);
  });
}
