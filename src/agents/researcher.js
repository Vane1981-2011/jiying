/**
 * 稽影 — Researcher Agent
 *
 * 信息调研 Agent。基于 DeepSeek 的训练数据和上下文进行调研，
 * 标注信息来源的信度等级（一手/二手/推断）。
 *
 * 宪法对齐（波兹曼的要求）：每条信息必须标注来源类型。
 */

import { generateText } from 'ai';
import { getModel } from './model';
import { buildContext } from '../context/builder';
import { filter } from '../constitution';

export async function runResearcher({ apiKey, modelProvider, customBaseURL, modelName, intent, trace, values, subtask, plannerReasoning, knowledgeContext }) {
  if (!apiKey) throw new Error('Researcher: API Key 未配置');

  const ctx = buildContext({ role: 'researcher', intent, trace, values, subtask, plannerReasoning });

  if (knowledgeContext) {
    ctx.messages[0].content += `\n\n[知识库检索结果]\n${knowledgeContext}`;
  }

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
    throw new Error(`Researcher: DeepSeek 调用失败 — ${e.message}`);
  }

  const constitution = filter(rawText);

  return {
    content: constitution.remediedOutput,
    constitution,
    rawText,
    sourceStats: countSources(rawText),
  };
}

function countSources(text) {
  return {
    primary: (text.match(/\[一手\]/g) || []).length,
    secondary: (text.match(/\[二手\]/g) || []).length,
    inferred: (text.match(/\[推断\]/g) || []).length,
  };
}
