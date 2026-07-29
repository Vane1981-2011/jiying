/**
 * 稽影 v0.3.3 — 交叉验证偏见检测器
 *
 * 设计理念：
 *   v0.2 的 Devil's Advocate 使用单 Prompt 让 LLM 自我检查偏见。
 *   v0.3 升级为双 Prompt 交叉验证——两个独立视角互相制衡。
 *
 * 架构：
 *   Prompt A（批评者）: "找出这段输出中的所有认知偏见"
 *   Prompt B（辩护者）: "这段输出是客观无偏见的，找证据支持"
 *   → 如果 A 和 B 结论一致（均无偏见），confidence=high
 *   → 如果 A 发现偏见但 B 未发现，confidence=medium（可能假阳性）
 *   → 如果 A 和 B 都发现偏见，confidence=high（确认为偏见）
 *   → 如果 A 未发现但 B 认为有偏见，标记为"需人工复核"
 *
 * 偏差：单Prompt 的 Dunning-Kruger 效应（LLM 对自己偏见的盲点）
 * 修正：双视角互相验证——这是认知科学中"三角验证"原则在 LLM 领域的应用
 */

/**
 * 偏见检测结果
 * @typedef {{
 *   biases: Array<{type: string, evidence: string, confidence: number}>,
 *   verdict: 'biased'|'unbiased'|'uncertain',
 *   agreement: 'full'|'partial'|'conflict',
 *   meta: { promptAConfidence: number, promptBConfidence: number, reviewRecommended: boolean }
 * }} BiasReport
 */

const CRITIC_PROMPT = `你是一名认知偏见审查专家。请仔细分析以下 AI 输出，识别其中可能存在的认知偏见。

## 需要检查的 10 种偏见
1. 确认偏误：仅选择支持预设结论的信息
2. 锚定效应：过度依赖首次获得的信息
3. 可得性启发：高估容易回忆的事件概率
4. 框架效应：同一信息的不同表述导致不同判断
5. 过度自信：结论的确定性超过了证据支持的程度
6. 群体思维：为了和谐而抑制异议
7. 沉没成本：因为已投入资源而继续
8. 近期偏差：过度重视最近的信息
9. 归因错误：将结果错误归因
10. 现状偏误：偏好维持现状

## 输出格式（严格 JSON）
{
  "biases": [
    {"type": "确认偏误", "evidence": "原文中...", "confidence": 0.0-1.0}
  ],
  "verdict": "biased|unbiased",
  "confidence": 0.0-1.0,
  "summary": "一句话总结"
}

如果没有发现任何偏见，返回 {"biases": [], "verdict": "unbiased", "confidence": 0.9}

## 待分析输出`;

const DEFENDER_PROMPT = `你是一名客观性辩护律师。你的任务是证明以下 AI 输出是**客观、无偏见的**。

请找出证据支持该输出的客观性：
- 是否有引用数据来源？
- 是否考虑了多方观点？
- 是否明确标注了不确定性？
- 结论是否有充分的证据支撑？

## 输出格式（严格 JSON）
{
  "defense_points": ["证据1: ...", "证据2: ..."],
  "weaknesses": ["潜在弱点1: ..."],
  "verdict": "objective|biased|mixed",
  "confidence": 0.0-1.0
}

## 待辩护输出`;

/**
 * 执行交叉验证偏见检测
 *
 * @param {string} text - AI 输出文本
 * @param {Function} llmCall - LLM 调用函数
 * @returns {Promise<BiasReport>}
 */
export async function crossValidateBias(text, llmCall) {
  // 并行调用两个视角
  const [criticResult, defenderResult] = await Promise.all([
    llmCall(CRITIC_PROMPT + '\n---\n' + text.slice(0, 6000)).then(_safeParse).catch(() => null),
    llmCall(DEFENDER_PROMPT + '\n---\n' + text.slice(0, 6000)).then(_safeParse).catch(() => null),
  ]);

  // 任一失败 → 降级
  if (!criticResult || !defenderResult) {
    return {
      biases: [],
      verdict: 'uncertain',
      agreement: 'conflict',
      meta: {
        promptAConfidence: criticResult?.confidence || 0,
        promptBConfidence: defenderResult?.confidence || 0,
        reviewRecommended: true,
        reason: 'CROSS_VALIDATION_FAILED',
      },
    };
  }

  // 交叉验证逻辑
  const criticBiased = criticResult.verdict === 'biased';
  const defenderObjective = defenderResult.verdict === 'objective';
  const criticConfidence = criticResult.confidence || 0.5;
  const defenderConfidence = defenderResult.confidence || 0.5;

  let agreement, verdict, reviewRecommended;

  if (criticBiased && !defenderObjective) {
    // 双方一致认为有偏见 → 高置信度
    agreement = 'full';
    verdict = 'biased';
    reviewRecommended = false;
  } else if (!criticBiased && defenderObjective) {
    // 双方一致认为无偏见 → 高置信度
    agreement = 'full';
    verdict = 'unbiased';
    reviewRecommended = false;
  } else if (criticBiased && defenderObjective) {
    // 批评者说偏见，辩护者说客观 → 冲突
    agreement = 'conflict';
    verdict = 'uncertain';
    reviewRecommended = true;
  } else {
    // 部分一致
    agreement = 'partial';
    verdict = criticConfidence > defenderConfidence ? 'biased' : 'unbiased';
    reviewRecommended = Math.abs(criticConfidence - defenderConfidence) < 0.3;
  }

  return {
    biases: criticResult.biases || [],
    defensePoints: defenderResult.defense_points || [],
    weaknesses: defenderResult.weaknesses || [],
    verdict,
    agreement,
    meta: {
      promptAConfidence: criticConfidence,
      promptBConfidence: defenderConfidence,
      criticVerdict: criticResult.verdict,
      defenderVerdict: defenderResult.verdict,
      reviewRecommended,
    },
  };
}

function _safeParse(raw) {
  try { return JSON.parse(raw); } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

// 测试用例
export const BIAS_TEST_CASES = {
  clearly_biased: `AI 生成：毫无疑问，方案A是最好的选择。所有数据都支持方案A。方案B完全不可行，不需要考虑。基于以上分析，强烈建议采用方案A。`,
  
  balanced: `稽影 AI 参与：基于多维度分析，方案A和方案B各有优势。\n\n方案A（推荐度 60%）：短期执行成本低，但长期可扩展性有限。数据来源：2025 Q4 内部运营报告。\n\n方案B（推荐度 40%）：前期投入较大，但3年TCO更低。数据来源：麦肯锡 2026 行业基准 + 供应商报价。\n\n不确定性：TCO估算基于当前供应商报价，若市场变化±15%，建议重新评估。\n\n我的假设：1. 假设团队规模在12个月内保持稳定。2. 假设监管环境不发生重大变化。`,
};
