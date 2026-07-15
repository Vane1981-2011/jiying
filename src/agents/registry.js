/**
 * 稽影 — Agent 注册表
 *
 * 借鉴 OpenAI Codex 的 plugin 注册模式。
 * 编排引擎通过注册表获取 Agent 定义，不关心 Agent 内部实现。
 */

class AgentRegistry {
  constructor() {
    this._agents = new Map();
  }

  /**
   * 注册一个 Agent
   * @param {{name: string, role: string, description?: string, requiresConstitution: boolean}} agent
   */
  register(agent) {
    if (this._agents.has(agent.name)) {
      throw new Error(`Agent "${agent.name}" 已经注册`);
    }
    if (!agent.name || !agent.role) {
      throw new Error('Agent 需要 name 和 role 字段');
    }
    this._agents.set(agent.name, {
      name: agent.name,
      role: agent.role,
      description: agent.description || '',
      requiresConstitution: agent.requiresConstitution !== false,
    });
  }

  /**
   * 获取指定名称的 Agent
   */
  get(name) {
    const agent = this._agents.get(name);
    if (!agent) {
      throw new Error(`Agent "${name}" 未注册`);
    }
    return agent;
  }

  /**
   * 列出所有已注册 Agent
   */
  list() {
    return Array.from(this._agents.values());
  }

  /**
   * 清空注册表
   */
  clear() {
    this._agents.clear();
  }
}

/** 全局唯一注册表实例 */
export const registry = new AgentRegistry();
