/**
 * 稽影 — Planner Agent
 *
 * 接收用户意图，调用 AI API 拆解为子任务列表。
 * 支持 DeepSeek 和自定义 OpenAI 兼容端点。
 * 输出必须经过宪法过滤器检查。
 */

import { generateText } from 'ai';
import { getModel } from './model';
import { buildContext } from '../context/builder';
import { filter } from '../constitution';

/**
 * 执行 Planner Agent —— 拆解用户意图
 *
 * @param {object} deps
 * @param {string} deps.apiKey - 用户的 API Key
 * @param {string} deps.modelProvider - 'deepseek' | 'custom'
 * @param {string} deps.customBaseURL - 自定义端点 URL
 * @param {string} deps.modelName - 模型名称
 * @param {object} deps.intent - 意图规格书
 * @param {object} deps.trace - 溯源追问结果
 * @param {object} deps.values - 价值观映射
 * @returns {Promise<{subtasks: Array, reasoning: string, constitution: object}>}
 */
export async function runPlanner({ apiKey, modelProvider, customBaseURL, modelName, intent, trace, values }) {
  if (!apiKey) throw new Error('Planner: API Key 未配置');

  const ctx = buildContext({ role: 'planner', intent, trace, values });

  let rawText = '';
  try {
    const result = await generateText({
      model: getModel({ apiKey, modelProvider, customBaseURL, modelName }),
      system: ctx.messages[0].content,
      prompt: ctx.messages[1].content,
      temperature: 0.3,
    });
    rawText = result.text;
  } catch (e) {
    throw new Error(`Planner: DeepSeek 调用失败 — ${e.message}`);
  }

  // 解析 JSON 响应
  let parsed;
  try {
    const jsonText = extractJSON(rawText);
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Planner: 无法解析 Agent 输出为 JSON — ${e.message}`);
  }

  if (!parsed.subtasks || !Array.isArray(parsed.subtasks)) {
    throw new Error('Planner: Agent 输出缺少 subtasks 字段');
  }

  // 宪法过滤
  const constitution = filter(rawText);

  return {
    subtasks: parsed.subtasks.map((t, i) => ({
      id: t.id || i + 1,
      title: t.title || '未命名子任务',
      goal: t.goal || '',
      dependsOn: t.dependsOn || [],
    })),
    reasoning: parsed.reasoning || '',
    constitution,
    rawText,
  };
}

function extractJSON(text) {
  // 尝试从 markdown code block 中提取
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match) return match[1].trim();

  // 尝试找第一个 { 和最后一个 }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }

  return text;
}
