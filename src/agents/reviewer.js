/**
 * 稽影 — Reviewer Agent
 *
 * 质量审查 Agent。审查 Creator 或其他 Agent 的输出。
 * 根据不舒服模式调整审查严格度——默认检查事实和逻辑，不舒服模式额外检查逻辑谬误和确认偏误。
 *
 * 宪法对齐：不舒服模式默认关闭（老板决定 2026-07-12），用户手动开启后严格度提升。
 */

import { generateText } from 'ai';
import { getModel } from './model';
import { filter } from '../constitution';
import { buildContext } from '../context/builder';

export async function runReviewer({ apiKey, modelProvider, customBaseURL, modelName, content, intent, strictMode = false }) {
  if (!apiKey) throw new Error('Reviewer: API Key 未配置');
  if (!content) throw new Error('Reviewer: 缺少审查内容');

  const { system } = buildContext({ role: 'reviewer', intent, strictMode });

  const userPrompt = `请审查以下内容：\n\n意图：${intent?.goal || '未指定'}\n\n内容：\n${content.slice(0, 4000)}`;

  let rawText = '';
  try {
    const result = await generateText({
      model: getModel({ apiKey, modelProvider, customBaseURL, modelName }),
      system,
      prompt: userPrompt,
      temperature: 0.2,
    });
    rawText = result.text;
  } catch (e) {
    throw new Error(`Reviewer: DeepSeek 调用失败 — ${e.message}`);
  }

  let parsed;
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    // 解析失败时返回保守结果
  }

  const constitution = filter(rawText);

  return {
    scores: parsed?.scores || { accuracy: 3, logic: 3, intentMatch: 3 },
    issues: parsed?.issues || [],
    suggestions: parsed?.suggestions || [],
    overall: parsed?.overall || 3,
    verdict: parsed?.verdict || 'revise',
    strictMode,
    constitution,
  };
}
