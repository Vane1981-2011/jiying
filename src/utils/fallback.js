/**
 * 稽影 — Fallback 链式容错
 *
 * 对标 Hermes 的五层异常处理策略：
 *   Level 1: try/catch 单体函数
 *   Level 2: timeout 控制
 *   Level 3: fallback 链依次尝试
 *   Level 4: Playwright 浏览器兜底
 *   Level 5: "数据不可用"透明标注
 *
 * 设计模式：Chain of Responsibility + Circuit Breaker
 * - 主源失败 → 自动切到备用源
 * - 所有源都失败 → 返回降级结果（不崩溃）
 * - 可配置 timeout / 重试次数 / 降级策略
 */

/**
 * 执行带 fallback 链的操作
 *
 * @param {Array<{ name: string, fn: Function, timeout?: number }>} providers
 *   按优先级排列的 provider 列表，每个有 name 和执行函数
 * @param {object} options
 * @param {number} [options.globalTimeout=30000] - 全局超时 ms
 * @param {Function} [options.onFallback] - 每次 fallback 时的回调 (providerName, error)
 * @param {Function} [options.buildDegradedResult] - 所有都失败时构造降级结果
 * @returns {Promise<{ data: any, source: string, latencyMs: number, degraded: boolean, error?: string }>}
 */
export async function withFallback(providers, options = {}) {
  const {
    globalTimeout = 30000,
    onFallback = () => {},
    buildDegradedResult = () => null,
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
      };
    } catch (e) {
      const errorMsg = e.message || String(e);
      errors.push({ provider: provider.name, error: errorMsg });
      onFallback(provider.name, errorMsg);
      // 继续尝试下一个 provider
    }
  }

  // 所有 provider 都失败 → 返回降级结果
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
      reject(new Error(`超时 ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve().then(() => fn()).then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * 重试装饰器（自动重试失败的操作）
 *
 * @param {Function} fn - 要执行的函数
 * @param {object} options
 * @param {number} [options.retries=3] - 最多重试次数
 * @param {number} [options.backoffMs=1000] - 退避基数 ms
 * @param {Function} [options.shouldRetry] - 判断是否应该重试 (error) => boolean
 * @returns {Promise<any>}
 */
export async function withRetry(fn, options = {}) {
  const { retries = 3, backoffMs = 1000, shouldRetry = () => true } = options;
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < retries && shouldRetry(e)) {
        const delay = backoffMs * Math.pow(2, attempt - 1); // 指数退避
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  throw lastError;
}

/**
 * 安全的 API 调用（配合 withFallback + withRetry 使用）
 *
 * @param {object} config
 * @param {string} config.name - provider 名称
 * @param {Function} config.fetch - 实际的 fetch 函数
 * @param {number} config.timeout - 超时 ms
 * @returns {{ name: string, fn: Function, timeout: number }}
 */
export function apiProvider({ name, fetch, timeout = 15000 }) {
  const fn = async () => {
    const result = await withRetry(fetch, { retries: 2, backoffMs: 500 });
    return result;
  };
  return { name, fn, timeout };
}

/**
 * 构建降级结果（用于所有 provider 失败时的兜底）
 */
export function degradedResult(message) {
  return {
    _degraded: true,
    _message: message,
    _timestamp: Date.now(),
  };
}
