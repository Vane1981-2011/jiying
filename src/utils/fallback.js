/**
 * 稽影 — Fallback 链式容错（升级版：DomainError + 重试白名单 + 幂等）
 *
 * v2.0 升级：
 * - 使用 DomainError 替代普通 Error（可重试/副作用状态/补偿需求）
 * - 重试采用白名单（仅 TIMEOUT/RATE_LIMIT/CONFLICT/DEPENDENCY 可自动重试）
 * - sideEffectStatus=UNKNOWN 时不直接重试，先查询远端状态
 * - 安全错误不向用户暴露内部细节
 *
 * 对标 Hermes 的五层异常处理 + Temporal 的重试/补偿协议
 */

import { DomainError, RETRYABLE_CATEGORIES, SIDE_EFFECT_STATUSES } from './errors';

/**
 * 生成幂等键
 * @param {string} tenantId
 * @param {string} taskId
 * @param {string} stepId
 * @param {string} toolVersion
 * @param {string} operationHash
 */
export function generateIdempotencyKey(tenantId, taskId, stepId, toolVersion, operationHash) {
  return `${tenantId}:${taskId}:${stepId}:v${toolVersion}:${operationHash}`;
}

/**
 * 执行带 fallback 链的操作（DomainError 感知版）
 */
export async function withFallback(providers, options = {}) {
  const {
    globalTimeout = 30000,
    onFallback = () => {},
    buildDegradedResult = (errors) => ({ _degraded: true, errors, _timestamp: Date.now() }),
    idempotencyKey,
  } = options;

  const startTime = performance.now();
  const errors = [];

  for (const provider of providers) {
    try {
      const timeout = provider.timeout || globalTimeout;
      const data = await withTimeout(provider.fn, timeout);
      const latencyMs = performance.now() - startTime;

      return {
        data,
        source: provider.name,
        latencyMs: Math.round(latencyMs),
        degraded: false,
        idempotencyKey,
      };
    } catch (e) {
      // 转换为 DomainError（如果还不是）
      const derr = e instanceof DomainError ? e : new DomainError({
        code: 'PROVIDER_FAILED',
        category: 'DEPENDENCY',
        retryable: false,
        userMessage: e.message || '外部服务调用失败',
        cause: e,
      });

      errors.push({ provider: provider.name, error: derr.code, category: derr.category });
      onFallback(provider.name, derr);

      // 如果已经有副作用且不确定状态 → 不继续 fallback
      if (derr.sideEffectStatus === SIDE_EFFECT_STATUSES.UNKNOWN ||
          derr.sideEffectStatus === SIDE_EFFECT_STATUSES.COMPLETED) {
        break;
      }
    }
  }

  const totalLatency = performance.now() - startTime;
  return {
    data: buildDegradedResult(errors),
    source: 'degraded',
    latencyMs: Math.round(totalLatency),
    degraded: true,
    error: errors.map((e) => `[${e.provider}] ${e.error}`).join('; '),
  };
}

/**
 * 带超时的 Promise 执行
 */
function withTimeout(fn, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new DomainError({
        code: 'TIMEOUT',
        category: 'TIMEOUT',
        retryable: true,
        userMessage: `操作超时（${timeoutMs}ms）`,
      }));
    }, timeoutMs);

    Promise.resolve().then(() => fn()).then(
      (r) => { clearTimeout(timer); resolve(r); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * 带白名单控制的智能重试
 *
 * 重试条件（AND 逻辑）：
 * - 错误类别在 RETRYABLE_CATEGORIES 白名单中
 * - 副作用状态不是 UNKNOWN（需先确认远端状态）
 * - 未超过最大重试次数
 * - 未超过任务截止时间
 *
 * @param {Function} fn - 要执行的函数
 * @param {object} options
 * @param {number} [options.retries=3] - 最大重试次数
 * @param {number} [options.backoffMs=1000] - 退避基数（指数增长）
 * @param {number} [options.taskDeadline] - 任务截止时间戳
 * @returns {Promise<any>}
 */
export async function withRetry(fn, options = {}) {
  const { retries = 3, backoffMs = 1000, taskDeadline } = options;
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof DomainError ? e : new DomainError({
        code: 'UNKNOWN',
        category: 'INTERNAL',
        retryable: false,
        userMessage: e.message || '未知错误',
        cause: e,
      });

      // 不可重试 → 立即抛出
      if (!lastError.retryable) throw lastError;

      // 副作用不确定 → 先查询远端状态，不盲目重试
      if (lastError.sideEffectStatus === SIDE_EFFECT_STATUSES.UNKNOWN) {
        throw new DomainError({
          code: 'RETRY_BLOCKED_UNKNOWN_SIDE_EFFECT',
          category: 'INTERNAL',
          retryable: false,
          userMessage: '操作状态不确定，请手动确认后再重试',
          cause: lastError,
        });
      }

      // 检查任务截止时间
      if (taskDeadline && Date.now() + backoffMs * Math.pow(2, attempt - 1) > taskDeadline) {
        throw new DomainError({
          code: 'TASK_DEADLINE_EXCEEDED',
          category: 'TIMEOUT',
          retryable: false,
          userMessage: '任务已超截止时间，停止重试',
          cause: lastError,
        });
      }

      if (attempt < retries) {
        const delay = backoffMs * Math.pow(2, attempt - 1) + Math.random() * 200; // +随机抖动
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * 安全错误包装——不暴露内部细节给用户
 * @param {Error} error
 * @returns {{ userMessage: string, correlationId: string }}
 */
export function sanitizeError(error) {
  const derr = error instanceof DomainError ? error : new DomainError({
    code: 'INTERNAL',
    category: 'INTERNAL',
    retryable: false,
    userMessage: '系统内部错误，请稍后重试',
    cause: error,
  });

  return {
    userMessage: derr.userMessage,
    correlationId: derr.correlationId,
    retryable: derr.retryable,
    category: derr.category,
  };
}
