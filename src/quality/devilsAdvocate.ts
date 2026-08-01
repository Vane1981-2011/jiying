/**
 * 稽影 — 魔鬼代言人模式 (M2 批判性思维)
 *
 * 对标 MAD-THINK M2 思维模态：假设挖掘 + 偏见检测 + 反证法 + 魔鬼代言人 + 信息来源审计
 *
 * 设计原理：「结论过于顺利/团队高度一致/决策涉及高风险/依赖单一信息源」时自动触发。
 *
 * 与 Reviewer 的区别：
 * - Reviewer：质量审查（事实/逻辑/意图匹配度）
 * - Devil's Advocate：系统性 Falsification（假设当前结论为假，寻找能推翻它的证据）
 *
 * 工作流：
 *   输入 → 假设挖掘 → 偏见检测 → 反证搜索 → 反向论证 → 残余风险报告
 */

/** 严重级别 */
type Severity = 'high' | 'medium' | 'low';

/** 认知偏见条目 */
export interface CognitiveBias {
  id: string;
  name: string;
  desc: string;
  severity: Severity;
}

/** 偏见列表 */
export const COGNITIVE_BIASES: CognitiveBias[] = [
  { id: 'confirmation', name: '确认偏误', desc: '倾向于寻找支持已有观点的证据', severity: 'high' },
  { id: 'anchoring', name: '锚定效应', desc: '过度依赖最先接触到的信息', severity: 'high' },
  { id: 'survivorship', name: '幸存者偏差', desc: '只关注成功案例', severity: 'high' },
  { id: 'availability', name: '可得性启发', desc: '容易联想到的例子被高估概率', severity: 'medium' },
  { id: 'halo', name: '光环效应', desc: '单一优点掩盖其他方面', severity: 'medium' },
  { id: 'overconfidence', name: '过度自信', desc: '高估自己判断的准确性', severity: 'high' },
  { id: 'sunk_cost', name: '沉没成本谬误', desc: '已投入的资源影响继续决策', severity: 'medium' },
  { id: 'framing', name: '框架效应', desc: '问题的表述方式影响判断', severity: 'medium' },
  { id: 'groupthink', name: '群体思维', desc: '追求一致而放弃独立思考', severity: 'high' },
  { id: 'dunning_kruger', name: '达克效应', desc: '能力低者高估自己，能力高者低估自己', severity: 'medium' },
];

/** 挑战输入 */
export interface ChallengeInput {
  content: string;
  context?: string;
  assumptions?: string[];
  mode?: 'quick' | 'deep';
}

/** 隐藏假设 */
export interface HiddenAssumption {
  assumption: string;
  challenge: string;
  severity: Severity;
  verifiable: boolean;
  label?: string;
}

/** 偏见检测结果 */
export interface DetectedBias {
  bias?: CognitiveBias;
  evidence: string;
  severity: Severity;
}

/** 反证条目 */
export interface CounterEvidenceItem {
  claim: string;
  counter: string;
  strength: 'strong' | 'medium' | 'weak';
}

/** 残余风险 */
export interface ResidualRisk {
  risk: string;
  probability: string;
  impact: string;
}

/** 挑战输出 */
export interface ChallengeOutput {
  challenged: boolean;
  hiddenAssumptions: HiddenAssumption[];
  biasesDetected: DetectedBias[];
  counterEvidence: CounterEvidenceItem[];
  reverseArgument: string;
  residualRisk: ResidualRisk[];
  overallConfidence: number; // 1-5, 5=高度自信经得起挑战
}

/**
 * 对一段内容或决策执行魔鬼代言人检查
 *
 * @param input.content - 要批判的内容
 * @param input.context - 上下文信息
 * @param input.assumptions - 已知的假设列表
 * @param input.mode - 检查深度
 */
export function challenge(input: ChallengeInput): ChallengeOutput {
  const { content, context = '', assumptions = [], mode = 'quick' } = input;

  if (!content || content.trim().length === 0) {
    return {
      challenged: false,
      hiddenAssumptions: [],
      biasesDetected: [],
      counterEvidence: [],
      reverseArgument: '内容为空，无法挑战',
      residualRisk: [{ risk: '内容缺失', probability: '高', impact: '高' }],
      overallConfidence: 1,
    };
  }

  const isDeep = mode === 'deep';

  // Step 1: 假设挖掘
  const hiddenAssumptions = mineAssumptions(content, context, isDeep);

  // Step 2: 偏见检测
  const biasesDetected = detectBiases(content, context, isDeep);

  // Step 3: 反证搜索
  const counterEvidence = findCounterEvidence(content, assumptions, isDeep);

  // Step 4: 构建反向论证
  const reverseArgument = buildReverseArgument(content, hiddenAssumptions, context);

  // Step 5: 残余风险评估
  const residualRisk = assessResidualRisk(hiddenAssumptions, biasesDetected, counterEvidence);

  // Step 6: 综合置信度
  const overallConfidence = calculateConfidence(hiddenAssumptions, biasesDetected, counterEvidence, isDeep);

  return {
    challenged: true,
    hiddenAssumptions,
    biasesDetected,
    counterEvidence,
    reverseArgument,
    residualRisk,
    overallConfidence,
  };
}

/**
 * 假设挖掘 — 找出内容中所有潜藏的假设
 *
 * 操作方法：列出所有潜藏假设，逐一标记"是否可验证"
 */
function mineAssumptions(content: string, context: string, isDeep: boolean): HiddenAssumption[] {
  const assumptions: HiddenAssumption[] = [];
  const text = content.toLowerCase();

  // 模式匹配假设（基于语言特征）
  const patterns: Array<{ pattern: RegExp; label: string; severity: Severity }> = [
    { pattern: /假设|假定|默认|一般来说|通常|理应/i, label: '前提假设', severity: 'high' },
    { pattern: /用户|客户|受众/i, label: '受众假设', severity: 'high' },
    { pattern: /一定|必然|肯定|绝对|毫无疑问/i, label: '确定性假设', severity: 'high' },
    { pattern: /数据[^。]{0,10}(显示|表明|证明)/i, label: '数据完整性假设', severity: 'medium' },
    { pattern: /市场[^。]{0,10}(预期|预计|将|会)/i, label: '市场预测假设', severity: 'high' },
    { pattern: /所有人都|每个人|任何/i, label: '泛化假设', severity: 'medium' },
    { pattern: /不会|不可能|从不/i, label: '否定假设', severity: 'medium' },
    { pattern: /简单|容易|只需|无非/i, label: '难度假设', severity: 'low' },
  ];

  for (const p of patterns) {
    const matches = text.match(p.pattern);
    if (matches) {
      assumptions.push({
        label: p.label,
        assumption: `内容包含了"${matches[0]}"类的前提判断`,
        challenge: `这个假设是否总是成立？有无反例？`,
        severity: p.severity,
        verifiable: p.severity !== 'low',
      });
    }
  }

  // 深度模式：检查数字/统计数据是否未标注来源
  if (isDeep) {
    const dataClaims = content.match(/\d+[%％]/g);
    if (dataClaims && dataClaims.length > 2) {
      assumptions.push({
        assumption: '引用的统计数据默认可信',
        challenge: '这些数据的来源是什么？采集方法是否可靠？有无利益相关？',
        severity: 'high',
        verifiable: true,
      });
    }
  }

  // 如果有上下文，检查上下文冲突
  if (context) {
    const ctxLower = context.toLowerCase();
    // 检查上下文是否与内容有矛盾
    const contentKeyClaims = text.match(/[^。]{10,30}?是[^。]{5,}?。/g);
    if (contentKeyClaims) {
      for (const claim of contentKeyClaims.slice(0, 3)) {
        const claimWords = claim.split('');
        const overlap = claimWords.filter((w) => ctxLower.includes(w));
        if (overlap.length < claimWords.length * 0.3) {
          assumptions.push({
            assumption: `主张"${claim.slice(0, 20)}..."与上下文无足够支撑`,
            challenge: '这个主张的上下文支撑在哪里？',
            severity: 'medium',
            verifiable: true,
          });
        }
      }
    }
  }

  return assumptions;
}

/**
 * 偏见检测 — 对照认知偏见清单检查
 */
function detectBiases(content: string, context: string, isDeep: boolean): DetectedBias[] {
  const detected: DetectedBias[] = [];
  const text = content.toLowerCase();

  // 确认偏误：是否只呈现了支持性证据？
  const hasCounterpoints = /然而|但是|另一方面|不过|反之|不足|局限|风险|挑战/i.test(text);
  if (!hasCounterpoints) {
    detected.push({
      bias: COGNITIVE_BIASES.find((b) => b.id === 'confirmation'),
      evidence: '内容未呈现任何反方观点或局限性',
      severity: 'high',
    });
  }

  // 成功者偏差：是否只举了成功案例？
  const successRatio = (text.match(/成功|增长|提升|突破|领先/g) || []).length;
  const failRatio = (text.match(/失败|下降|亏损|问题|困难/g) || []).length;
  if (successRatio > failRatio * 3 && successRatio > 3) {
    detected.push({
      bias: COGNITIVE_BIASES.find((b) => b.id === 'survivorship'),
      evidence: `成功描述(${successRatio}次)显著多于失败描述(${failRatio}次)`,
      severity: 'high',
    });
  }

  // 过度自信：是否使用了过高的确定性语言？
  const certaintyWords = (text.match(/一定|必然|绝对|百分之百|毫无疑问|完全确定/g) || []).length;
  if (certaintyWords > 2) {
    detected.push({
      bias: COGNITIVE_BIASES.find((b) => b.id === 'overconfidence'),
      evidence: `使用了 ${certaintyWords} 个过度确定性词汇`,
      severity: 'high',
    });
  }

  // 可得性启发：是否依赖了容易想到但未必典型的例子？
  const recentExamples = /最近|近期|最新|当下|当前/i.test(text);
  if (recentExamples && !hasCounterpoints) {
    detected.push({
      bias: COGNITIVE_BIASES.find((b) => b.id === 'availability'),
      evidence: '引用了近期案例但未说明其典型性',
      severity: 'medium',
    });
  }

  // 深度模式下额外检查
  if (isDeep) {
    // 群体思维：是否太一致？
    // 注意：精确保留"没有争议"等否定表达不应触发豁免
    const explicitlyDeniesControversy = /没有争议|无争议|没有分歧|无分歧|一致同意/i.test(text);
    const mentionsControversy = /存在争议|有分歧|不同观点|争议[^。]{0,5}存在/i.test(text);
    if (!hasCounterpoints && !mentionsControversy) {
      detected.push({
        bias: COGNITIVE_BIASES.find((b) => b.id === 'groupthink'),
        evidence: explicitlyDeniesControversy
          ? '内容明确否认存在争议或分歧，这是群体思维的典型信号'
          : '内容呈现高度一致，无任何分歧或争议',
        severity: 'high',
      });
    }

    // 沉没成本：是否在已投入的方向上过度坚持？
    if (/继续|坚持|不放弃|已经在[^。]{0,20}投入/i.test(text)) {
      detected.push({
        bias: COGNITIVE_BIASES.find((b) => b.id === 'sunk_cost'),
        evidence: '暗示继续投入已开始的事项',
        severity: 'medium',
      });
    }
  }

  return detected;
}

/**
 * 反证搜索 — 假设当前结论为假，寻找能推翻它的证据
 *
 * 操作方法：假设当前结论为假，寻找能推翻它的证据
 */
function findCounterEvidence(content: string, knownAssumptions: string[], isDeep: boolean): CounterEvidenceItem[] {
  const evidence: CounterEvidenceItem[] = [];
  const text = content.toLowerCase();

  // 检查是否有未考虑的反面因素
  const positiveWords = /推荐|建议|有利|优势|机会|增长/i.test(text);
  const negativeWords = /风险|问题|挑战|威胁|不足|局限/i.test(text);

  if (positiveWords && !negativeWords) {
    evidence.push({
      claim: '内容呈现了正面结论',
      counter: '未充分讨论反面因素，可能导致片面决策',
      strength: 'strong',
    });
  }

  // 如果有已知假设，尝试反证每个假设
  for (const assumption of knownAssumptions) {
    if (typeof assumption === 'string') {
      evidence.push({
        claim: `假设: ${assumption}`,
        counter: `如果这个假设不成立，结论是否还成立？`,
        strength: 'medium',
      });
    }
  }

  // 深度模式：检查确定性结论的反面
  if (isDeep) {
    const conclusions = text.match(/因此|所以|综上|结论|建议[：:]/g);
    if (conclusions) {
      evidence.push({
        claim: '内容包含明确结论',
        counter: '如果存在未考虑的第三方因素，结论可能完全相反',
        strength: 'medium',
      });
    }
  }

  return evidence;
}

/**
 * 构建反向论证 — 为相反的立场构建最强论证
 */
function buildReverseArgument(content: string, assumptions: HiddenAssumption[], _context: string): string {
  if (!content || content.length < 20) return '内容太短，无法构建有意义的反向论证。';

  const lines: string[] = [];

  // 根据内容特征构建反向论点
  const hasRecommendation = /建议|推荐|应该|需要|必须/i.test(content);
  if (hasRecommendation) {
    lines.push('反方立场：不采纳建议可能同样是合理的选择。理由如下：');
    lines.push('1. 建议基于的假设可能不成立或正在变化');
    lines.push('2. 采纳建议的机会成本（把资源投入其他方向可能更好）');
    lines.push('3. 建议的长期副作用未被充分评估');
  } else {
    lines.push('反方立场：当前结论存在被推翻的可能性。理由如下：');
    lines.push('1. 分析依赖的数据可能过时、有偏或不够全面');
    lines.push('2. 推理链中的关键环节未被实证检验');
    lines.push('3. 替代解释未被充分排除');
  }

  if (assumptions.length > 0) {
    lines.push('');
    lines.push('最脆弱的假设：');
    assumptions.slice(0, 3).forEach((a, i) => {
      lines.push(`${i + 1}. ${typeof a === 'string' ? a : a.assumption}`);
    });
  }

  return lines.join('\n');
}

/**
 * 残余风险评估
 */
function assessResidualRisk(
  assumptions: HiddenAssumption[],
  biases: DetectedBias[],
  counterEvidence: CounterEvidenceItem[],
): ResidualRisk[] {
  const risks: ResidualRisk[] = [];

  const highSeverityAssumptions = assumptions.filter((a) => a.severity === 'high');
  const highSeverityBiases = biases.filter((b) => b.severity === 'high');

  if (highSeverityAssumptions.length > 2) {
    risks.push({
      risk: '多个高强度假设未被验证',
      probability: '中',
      impact: '高',
    });
  }

  if (highSeverityBiases.length > 1) {
    risks.push({
      risk: '存在多种认知偏见，结论可能系统性偏差',
      probability: '高',
      impact: '高',
    });
  }

  if (counterEvidence.some((e) => e.strength === 'strong')) {
    risks.push({
      risk: '存在强有力的反证未被充分考虑',
      probability: '中',
      impact: '中',
    });
  }

  if (risks.length === 0) {
    risks.push({
      risk: '当前未识别出明显残余风险',
      probability: '低',
      impact: '低',
    });
  }

  return risks;
}

/**
 * 计算综合置信度
 */
function calculateConfidence(
  assumptions: HiddenAssumption[],
  biases: DetectedBias[],
  counterEvidence: CounterEvidenceItem[],
  isDeep: boolean,
): number {
  let score = 5;

  // 每个 high severity 假设减分
  score -= highSeverityCount(assumptions) * 0.5;
  score -= highSeverityCount(biases) * 0.5;
  score -= counterEvidence.filter((e) => e.strength === 'strong').length * 0.5;
  score -= counterEvidence.filter((e) => e.strength === 'medium').length * 0.2;

  // 深度模式下更严格
  if (isDeep) score -= 0.3;

  return Math.max(1, Math.round(score * 10) / 10);
}

function highSeverityCount(items: Array<{ severity: Severity }>): number {
  return items.filter((i) => i.severity === 'high').length;
}
