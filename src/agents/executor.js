/**
 * 稽影 — Executor Agent
 *
 * 执行 Agent。负责在沙箱中执行 shell 命令。
 * 每个命令必须经过宪法过滤 + Shell 权限策略决策。
 *
 * 架构设计（借鉴 OpenAI Codex 的沙箱执行模式）：
 * - 命令先过 shellPolicy.checkCommand() → 四级权限决策
 * - 决策结果决定是否需要用户确认
 * - 确认后沙箱执行（浏览器环境需 Electron shell 或 mock 沙箱）
 * - 输出返回 Creator，继续编排
 *
 * 在纯浏览器环境中（v0.1 Web 模式），Executor 运行在模拟沙箱中：
 * - 命令不实际执行，只返回模拟输出
 * - 用户可在 UI 中"手动执行"并将结果返回
 * - Electron 版本（v0.3）启用真实 child_process 沙箱
 */

import { decide, isPathSafe, SANDBOX_DEFAULTS } from './shellPolicy';
import { filter } from '../constitution';

/**
 * 提议执行一个 Shell 命令
 *
 * @param {object} deps
 * @param {string} deps.command - 完整 shell 命令
 * @param {string} deps.purpose - 执行目的（供用户判断）
 * @param {object} deps.sandbox - 沙箱配置 (override)
 * @param {object} deps.userConfig - 用户权限配置
 * @returns {Promise<{
 *   decision: 'allow'|'prompt'|'prompt_warn'|'forbidden',
 *   command: string,
 *   purpose: string,
 *   risk: string,
 *   reason: string,
 *   safeToExecute: boolean,
 * }>}
 */
export async function proposeExecution({ command, purpose, sandbox = {}, userConfig = {} }) {
  if (!command || typeof command !== 'string') {
    return {
      decision: 'forbidden',
      command: command || '',
      purpose: purpose || '',
      risk: 'invalid',
      reason: '命令不能为空',
      safeToExecute: false,
    };
  }

  // Step 1: 宪法检查
  const constitutionResult = filter(command);
  if (constitutionResult.status === 'block') {
    return {
      decision: 'forbidden',
      command,
      purpose,
      risk: 'constitution_block',
      reason: '宪法阻断：' + constitutionResult.violations.map((v) => v.justification).join('; '),
      safeToExecute: false,
    };
  }

  // Step 2: Shell 权限策略决策
  const policyResult = decide(command, {
    fullAccess: userConfig.fullAccess || false,
    whitelist: userConfig.whitelist || [],
  });

  // Step 3: 沙箱路径安全检查（如果命令涉及文件路径）
  const pathCheck = checkCommandPaths(command);
  if (!pathCheck.safe) {
    return {
      decision: 'forbidden',
      command,
      purpose,
      risk: 'path_violation',
      reason: `沙箱路径禁止：${pathCheck.reason}`,
      safeToExecute: false,
    };
  }

  const timeout = sandbox.timeout || SANDBOX_DEFAULTS.timeout;
  const result = {
    decision: policyResult.decision,
    command,
    purpose: purpose || '',
    risk: policyResult.category,
    reason: policyResult.reason,
    safeToExecute: policyResult.decision !== 'forbidden',
    timeout,
  };

  return result;
}

/**
 * 执行命令（在现有环境中运行）
 *
 * 纯浏览器环境：通过父页面 postMessage 通信
 * Electron 环境：通过 preload 暴露的 execInSandbox API
 *
 * @param {string} command
 * @param {object} options
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, duration: number}>}
 */
export async function executeCommand(command, options = {}) {
  const timeout = options.timeout || SANDBOX_DEFAULTS.timeout;
  const startTime = performance.now();

  // 浏览器环境：尝试通过 Electron preload 执行
  if (typeof window !== 'undefined' && window.__sibian) {
    try {
      const result = await window.__sibian.executeCommand(command, { timeout });
      return {
        ...result,
        duration: performance.now() - startTime,
      };
    } catch (e) {
      return {
        stdout: '',
        stderr: `执行失败: ${e.message}`,
        exitCode: 1,
        duration: performance.now() - startTime,
      };
    }
  }

  // 纯浏览器 Mock 沙箱：不实际执行，返回模拟结果
  console.warn(`[Executor Sandbox] 浏览器环境模拟沙箱。命令未实际执行: ${command}`);
  return {
    stdout: `[模拟沙箱] 命令 "${command}" 已提交。\n在浏览器环境中，请手动执行此命令或将结果粘贴到下方。\n\nElectron 版本 (v0.3) 将自动执行沙箱命令。`,
    stderr: '',
    exitCode: 0,
    duration: performance.now() - startTime,
    simulated: true,
  };
}

/**
 * 检查命令中的路径是否在沙箱允许范围内
 */
function checkCommandPaths(command) {
  const pathMatches = command.match(/(?:\s|^)([\/~][^\s"'|;&]+)/g);
  if (!pathMatches) return { safe: true };

  for (const match of pathMatches) {
    const path = match.trim();
    if (!isPathSafe(path)) {
      return { safe: false, reason: `禁止路径: ${path}` };
    }
  }
  return { safe: true };
}

/**
 * 注入 Electron preload 暴露的 exec API
 * （v0.3 Electron 打包时由 preload 脚本调用）
 *
 * @param {Function} execFn - (command, options) => Promise<{stdout, stderr, exitCode}>
 */
export function injectExecutor(execFn) {
  if (typeof window !== 'undefined') {
    window.__sibian = window.__sibian || {};
    window.__sibian.executeCommand = execFn;
  }
}
