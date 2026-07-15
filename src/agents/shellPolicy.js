/**
 * 稽影 — Shell 权限策略引擎
 *
 * 四级权限模型（借鉴 OpenAI Codex execpolicy 三态决策）：
 *   4 = allow  (完全访问：白名单命令自动执行)
 *   3 = prompt (询问确认：弹窗展示，用户确认后执行)
 *   2 = warn   (加强提示：弹窗 + 风险警告)
 *   1 = forbid (永久禁止：宪法拦截，不可绕过)
 *
 * 宪法/权限分离原则：
 * - 高风险命令由宪法级别硬编码为 forbid（不可被任何开关绕过）
 * - 白名单由用户配置（完全访问模式下跳过 prompt 直接 allow）
 * - 未列入规则的命令默认 forbid（安全默认原则）
 */

/**
 * 命令风险分类表
 *
 * 每条命令的分类规则是独立的、可测试的。
 * 匹配逻辑：命令 + 参数匹配最具体的规则，否则使用通配规则。
 */
const COMMAND_RULES = [
  // ——— 高风险（永禁） ———
  { pattern: /^rm\b/, level: 1, category: '高风险', reason: '永久禁止：删除操作不可逆' },
  { pattern: /^sudo\b/, level: 1, category: '高风险', reason: '永久禁止：权限提升' },
  { pattern: /^chmod\b/, level: 1, category: '高风险', reason: '永久禁止：权限修改' },
  { pattern: /^chown\b/, level: 1, category: '高风险', reason: '永久禁止：所有权变更' },
  { pattern: /^kill\b/, level: 1, category: '高风险', reason: '永久禁止：进程终止' },
  { pattern: /^dd\b/, level: 1, category: '高风险', reason: '永久禁止：块设备写入' },
  { pattern: /^mkfs\b/, level: 1, category: '高风险', reason: '永久禁止：格式化' },
  { pattern: /\|.*sh\b/, level: 1, category: '高风险', reason: '永久禁止：管道执行 shell' },
  { pattern: /^curl\b.*\||^wget\b.*\|/, level: 1, category: '高风险', reason: '永久禁止：远程执行管道' },

  // ——— 中风险（warn） ———
  { pattern: /^git (commit|push|add|merge|rebase)\b/, level: 2, category: '修改操作', reason: 'Git 写入操作，确认后再执行' },
  { pattern: /^mkdir\b/, level: 2, category: '修改操作', reason: '创建目录' },
  { pattern: /^(cp|mv)\b/, level: 2, category: '修改操作', reason: '文件操作' },
  { pattern: /^(curl|wget)\b/, level: 2, category: '网络访问', reason: '外网请求，确认 URL 可信' },
  { pattern: /^(pip|npm|brew|apt|yum)\b/, level: 2, category: '包管理', reason: '安装外部包' },
  { pattern: /^python\b.*\-m\s+(pip|venv)/, level: 2, category: '包管理', reason: 'Python 包/环境操作' },
  { pattern: /^>/, level: 2, category: '写入操作', reason: '输出重定向到文件' },

  // ——— 低风险（prompt） ———
  { pattern: /^cat\b/, level: 3, category: '读取', reason: '查看文件内容' },
  { pattern: /^(head|tail|less|more)\b/, level: 3, category: '读取', reason: '查看文件' },
  { pattern: /^wc\b/, level: 3, category: '统计', reason: '统计' },
  { pattern: /^grep\b/, level: 3, category: '搜索', reason: '文本搜索' },
  { pattern: /^(ls|find|du|df)\b/, level: 3, category: '文件系统', reason: '文件系统浏览' },
  { pattern: /^echo\b/, level: 3, category: '输出', reason: '输出文本' },
  { pattern: /^sort\b/, level: 3, category: '处理', reason: '排序' },
  { pattern: /^uniq\b/, level: 3, category: '处理', reason: '去重' },
  { pattern: /^cut\b/, level: 3, category: '处理', reason: '列提取' },
  { pattern: /^jq\b/, level: 3, category: '处理', reason: 'JSON 处理' },
  { pattern: /^python\b/, level: 3, category: '脚本', reason: 'Python 执行' },
  { pattern: /^node\b/, level: 3, category: '脚本', reason: 'Node 执行' },
  { pattern: /^Rscript\b/, level: 3, category: '脚本', reason: 'R 执行' },
  { pattern: /^git (status|diff|log)\b/, level: 3, category: '读取', reason: 'Git 只读操作' },
  { pattern: /^pwd\b/, level: 3, category: '读取', reason: '当前路径' },
  { pattern: /^which\b/, level: 3, category: '读取', reason: '查找命令路径' },
];

/**
 * 检查命令权限级别
 *
 * @param {string} command - 完整的 shell 命令
 * @param {string[]} whitelist - 用户配置的白名单命令列表
 * @returns {{ level: 1|2|3|4, category: string, reason: string, matchedRule: string }}
 */
export function checkCommand(command, whitelist = []) {
  if (!command || typeof command !== 'string') {
    return { level: 1, category: '无效命令', reason: '命令为空' };
  }

  const trimmed = command.trim();
  if (!trimmed) {
    return { level: 1, category: '无效命令', reason: '命令为空' };
  }

  // 白名单检查（level 4 = allow）
  const baseCmd = trimmed.split(/\s+/)[0];
  if (whitelist.includes(baseCmd)) {
    return { level: 4, category: '白名单', reason: '用户已信任此命令' };
  }

  // 逐规则匹配（顺序优先）
  for (const rule of COMMAND_RULES) {
    if (rule.pattern.test(trimmed)) {
      return {
        level: rule.level,
        category: rule.category,
        reason: rule.reason,
        matchedRule: rule.pattern.toString(),
      };
    }
  }

  // 默认：forbidden（安全默认）
  return { level: 1, category: '未识别', reason: '不在安全列表中的命令' };
}

/**
 * 获取命令的决策结果
 *
 * @param {string} command - shell 命令
 * @param {object} options
 * @param {boolean} options.fullAccess - 是否开启完全访问模式
 * @param {string[]} options.whitelist - 用户白名单
 * @returns {{ decision: 'allow'|'prompt'|'prompt_warn'|'forbidden', category: string, reason: string }}
 *
 * 决策逻辑：
 * - level 1 (forbid) → 永远 forbidden
 * - level 4 (allow) → 已白名单的 allow
 * - level 2-3 + fullAccess=false → prompt / prompt_warn
 * - level 2-3 + fullAccess=true → 根据是否在白名单决定
 */
export function decide(command, { fullAccess = false, whitelist = [] } = {}) {
  const result = checkCommand(command, whitelist);

  if (result.level === 1) {
    return { decision: 'forbidden', category: result.category, reason: result.reason };
  }

  if (result.level === 4) {
    return { decision: 'allow', category: result.category, reason: '白名单自动执行' };
  }

  if (fullAccess && whitelist.length > 0) {
    // 完全访问模式下，检查是否接近白名单
    const baseCmd = command.trim().split(/\s+/)[0];
    if (whitelist.includes(baseCmd)) {
      return { decision: 'allow', category: result.category, reason: '完全访问模式' };
    }
  }

  if (result.level === 2) {
    return { decision: 'prompt_warn', category: result.category, reason: result.reason };
  }

  return { decision: 'prompt', category: result.category, reason: result.reason };
}

/**
 * 沙箱配置
 */
export const SANDBOX_DEFAULTS = {
  timeout: 30_000,          // 命令超时（毫秒）
  maxOutputSize: 100_000,   // 最大输出大小（字符）
  allowedPaths: ['.'],       // 允许的文件系统路径（相对于项目根目录）
  networkAllowed: false,     // 默认禁止网络出站
};

/**
 * 验证沙箱路径是否安全
 *
 * @param {string} path - 请求的路径
 * @param {string[]} allowedPaths - 允许的路径列表
 * @returns {boolean}
 */
export function isPathSafe(path, allowedPaths = SANDBOX_DEFAULTS.allowedPaths) {
  try {
    const resolved = path.replace(/^~/, process?.env?.HOME || '');
    // 禁止访问 /etc, /usr, /bin, /dev, /proc, /sys
    const forbidden = [/^\/etc\b/, /^\/usr\b/, /^\/bin\b/, /^\/dev\b/, /^\/proc\b/, /^\/sys\b/];
    for (const pat of forbidden) {
      if (pat.test(resolved)) return false;
    }
    // 检查是否在允许路径内
    for (const allowed of allowedPaths) {
      if (resolved.startsWith(allowed) || resolved.startsWith('/' + allowed)) return true;
    }
    return false;
  } catch {
    return false; // 解析失败 → 保守返回
  }
}

export { COMMAND_RULES };
