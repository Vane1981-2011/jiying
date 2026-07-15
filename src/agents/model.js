/**
 * 稽影 — AI 模型工厂
 *
 * 从 userStore 读取模型配置，返回兼容的 Vercel AI SDK model 对象。
 * 支持 DeepSeek 和自定义 OpenAI 兼容端点。
 *
 * 增强：引入 Fallback 链式容错（withRetry + 指数退避）
 */
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAI } from '@ai-sdk/openai';
import { withRetry } from '../utils/fallback';

/**
 * @param {object} config
 * @param {string} config.apiKey
 * @param {string} [config.modelProvider='deepseek']
 * @param {string} [config.customBaseURL]
 * @param {string} [config.modelName]
 * @returns {import('ai').LanguageModel}
 */
export function getModel({ apiKey, modelProvider = 'deepseek', customBaseURL, modelName }) {
  if (modelProvider === 'deepseek') {
    return createDeepSeek({ apiKey })(modelName || 'deepseek-v4-pro');
  }
  return createOpenAI({ apiKey, baseURL: customBaseURL || undefined })(modelName || 'gpt-4o');
}

/**
 * 带 fallback 重试的 AI 生成调用
 *
 * 包装 generateText 调用，自动重试 + 指数退避。
 * 对标 Hermes 的 Level 1-2 异常处理。
 *
 * @param {Function} generateFn - () => Promise<result> 生成函数
 * @param {object} options
 * @param {number} [options.retries=3] - 最大重试次数
 * @param {number} [options.timeout=30000] - 单次超时 ms
 * @returns {Promise<{text: string}>}
 */
export async function generateWithFallback(generateFn, options = {}) {
  const { retries = 3, timeout = 30000 } = options;
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const result = await generateFn({ signal: controller.signal });
      clearTimeout(timeoutId);
      return result;
    } catch (e) {
      lastError = e;
      if (e.name === 'AbortError') {
        console.warn(`[Model] 第 ${attempt}/${retries} 次调用超时 (${timeout}ms)`);
      } else {
        console.warn(`[Model] 第 ${attempt}/${retries} 次调用失败: ${e.message}`);
      }
      if (attempt < retries) {
        const delay = 1000 * Math.pow(2, attempt - 1); // 指数退避: 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`AI 调用在 ${retries} 次重试后仍然失败: ${lastError?.message}`);
}
