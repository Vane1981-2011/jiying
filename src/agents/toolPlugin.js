/**
 * 稽影 v0.4.3 — 工具插件系统
 *
 * v0.2 局限：仅支持 Shell 执行（Executor + ShellPolicy 四级权限）
 * v0.4 扩展：可插拔工具生态 — Web Search · Database · REST API · File System
 *
 * 架构模式：Plugin Manifest + Capability Gateway
 *
 *   工具声明 (ToolManifest)         权限决策 (Policy Decision)
 *   ┌─────────────────────┐        ┌──────────────────────┐
 *   │ name, version,       │        │ 基于：                 │
 *   │ capabilities,        │  ──→  │ - 风险级别 (1-5)      │
 *   │ riskLevel,           │        │ - 用户授权状态         │
 *   │ inputSchema,         │        │ - 宪法合规状态         │
 *   │ sideEffectProfile    │        │ → allow/prompt/deny    │
 *   └─────────────────────┘        └──────────────────────┘
 *
 * 原则（来自 ARCHITECTURE_PHILOSOPHY.md P2）:
 *   "Capability ≠ Authority — Agent 能做什么 ≠ Agent 被允许做什么"
 */

// ── 工具清单注册 ──

/**
 * @typedef {{
 *   name: string,
 *   version: string,
 *   description: string,
 *   capabilities: string[],
 *   riskLevel: 1|2|3|4|5,
 *   inputSchema: object,
 *   sideEffectProfile: 'none'|'readonly'|'mutable'|'destructive',
 *   requiresUserConsent: boolean,
 * }} ToolManifest
 */

const RISK_LEVELS = {
  1: 'safe',       // 纯计算·无副作用（宪法检查、Jaccard计算）
  2: 'low',        // 只读访问（文件读取、搜索查询）
  3: 'medium',     // 有限写入（文件创建、缓存更新）
  4: 'high',       // 系统级操作（Shell执行、数据库写入）
  5: 'critical',   // 不可逆操作（删除、权限变更、外部支付）
};

/**
 * 内置工具清单
 */
export const BUILTIN_TOOLS = {
  /** Web 搜索 */
  web_search: {
    name: 'web_search',
    version: '0.1.0',
    description: '搜索引擎查询——获取实时网页信息',
    capabilities: ['search', 'fetch_snippets'],
    riskLevel: 2,
    inputSchema: {
      required: ['query'],
      properties: {
        query: { type: 'string', maxLength: 500 },
        num_results: { type: 'number', default: 5, max: 20 },
      },
    },
    sideEffectProfile: 'readonly',
    requiresUserConsent: false,
  },

  /** 数据库查询 */
  database_query: {
    name: 'database_query',
    version: '0.1.0',
    description: 'SQL 数据库查询——仅支持 SELECT（只读）',
    capabilities: ['sql_select', 'schema_introspect'],
    riskLevel: 3,
    inputSchema: {
      required: ['sql'],
      properties: {
        sql: { type: 'string', maxLength: 2000 },
        params: { type: 'array' },
      },
    },
    sideEffectProfile: 'readonly',
    requiresUserConsent: true,
  },

  /** REST API 调用 */
  api_call: {
    name: 'api_call',
    version: '0.1.0',
    description: '外部 REST API 调用——GET/POST 请求',
    capabilities: ['http_get', 'http_post'],
    riskLevel: 3,
    inputSchema: {
      required: ['url'],
      properties: {
        url: { type: 'string', format: 'uri' },
        method: { type: 'string', enum: ['GET', 'POST'] },
        headers: { type: 'object' },
        body: { type: 'object' },
      },
    },
    sideEffectProfile: 'mutable',
    requiresUserConsent: true,
  },

  /** 文件系统 */
  file_system: {
    name: 'file_system',
    version: '0.1.0',
    description: '本地文件读写——受限于工作目录',
    capabilities: ['read_file', 'write_file', 'list_dir'],
    riskLevel: 4,
    inputSchema: {
      required: ['operation', 'path'],
      properties: {
        operation: { type: 'string', enum: ['read', 'write', 'list'] },
        path: { type: 'string' },
        content: { type: 'string' },
      },
    },
    sideEffectProfile: 'mutable',
    requiresUserConsent: true,
  },

  /** Shell 执行（已有，v0.2） */
  shell_exec: {
    name: 'shell_exec',
    version: '0.2.0',
    description: '命令行执行——四级权限沙箱（allow/prompt/prompt_warn/forbidden）',
    capabilities: ['execute', 'stdio'],
    riskLevel: 4,
    inputSchema: {
      required: ['command'],
      properties: {
        command: { type: 'string' },
        cwd: { type: 'string' },
        timeout: { type: 'number', default: 30000 },
      },
    },
    sideEffectProfile: 'mutable',
    requiresUserConsent: true,
  },
};

/**
 * 8类永禁命令（在任何风险级别下都不可执行）
 */
export const FORBIDDEN_COMMANDS = [
  'rm -rf /', 'sudo rm', 'chmod 777', 'mkfs', 'dd if=', ':(){ :|:& };:', // fork bomb
  'shutdown', 'reboot', 'halt', 'poweroff',
  'curl ... | sh', 'wget ... | sh', // pipe to shell
];

// ── 工具注册表 ──

export class ToolRegistry {
  constructor() {
    /** @type {Map<string, ToolManifest>} */
    this.tools = new Map();
    // 注册内置工具
    for (const [name, manifest] of Object.entries(BUILTIN_TOOLS)) {
      this.register(name, manifest);
    }
  }

  /**
   * 注册工具
   * @param {string} name
   * @param {ToolManifest} manifest
   */
  register(name, manifest) {
    if (this.tools.has(name)) {
      console.warn(`[ToolRegistry] 工具 "${name}" 已存在，覆盖注册`);
    }
    this.tools.set(name, { ...manifest, registered_at: Date.now() });
  }

  /**
   * 获取工具清单
   * @param {string} name
   * @returns {ToolManifest|undefined}
   */
  get(name) {
    return this.tools.get(name);
  }

  /**
   * 列出所有已注册工具
   */
  list() {
    return Array.from(this.tools.entries()).map(([name, manifest]) => ({
      name,
      version: manifest.version,
      description: manifest.description,
      riskLevel: manifest.riskLevel,
      capabilities: manifest.capabilities,
    }));
  }

  /**
   * 检查用户是否有权使用某工具
   *
   * @param {string} toolName
   * @param {'allow'|'prompt'|'deny'} userConsent - 用户授权状态
   * @param {boolean} constitutionPassed - 宪法是否通过
   * @returns {{ allowed: boolean, reason: string }}
   */
  checkPermission(toolName, userConsent, constitutionPassed) {
    const tool = this.tools.get(toolName);
    if (!tool) return { allowed: false, reason: `未注册的工具: ${toolName}` };

    // 宪法未通过 → 拒绝所有工具
    if (!constitutionPassed && tool.riskLevel >= 3) {
      return { allowed: false, reason: '宪法未通过，拒绝中高风险工具' };
    }

    // 需用户授权但未授权
    if (tool.requiresUserConsent && userConsent === 'deny') {
      return { allowed: false, reason: `用户拒绝了 "${toolName}" 的授权请求` };
    }

    // 风险 5 级操作 → 总是需要显式确认
    if (tool.riskLevel === 5 && userConsent !== 'allow') {
      return { allowed: false, reason: '5级风险操作需要显式用户授权' };
    }

    return { allowed: true, reason: 'ok' };
  }
}

// 全局单例
export const toolRegistry = new ToolRegistry();
