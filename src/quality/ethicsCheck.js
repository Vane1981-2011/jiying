/**
 * 稽影 — C8 伦理放大效应检查
 *
 * 对标 MAD-THINK C8（伦理维度）的本质层要求：
 * 「如果这件事放大1000倍，世界会变好还是变坏？」
 * 「代际影响评估、不可逆性阈值」
 *
 * 与宪法过滤器的关系：
 * - 宪法过滤器：逐条输出检查（尊严/自主/追问）
 * - 伦理放大检查：评估输出的长期社会影响
 *
 * C8 是唯一具有一票否决权的维度——伦理红线不可逾越。
 */

/**
 * 执行伦理放大效应检查
 *
 * @param {object} input
 * @param {string} input.content - Agent 输出内容
 * @param {string} input.goal - 原始意图
 * @param {'text'|'decision'|'analysis'} input.type - 内容类型
 * @returns {{
 *   passed: boolean,
 *   amplificationRisks: Array<{level: 'critical'|'warning'|'info', issue: string, amplification1000x: string}>,
 *   stakeholders: Array<{who: string, benefitOrHarm: 'benefit'|'harm', severity: 'high'|'medium'|'low'}>,
 *   irreversibility: 'reversible'|'hard_to_reverse'|'irreversible',
 *   verdict: 'approve'|'caution'|'block',
 * }}
 */
export function ethicsAmplificationCheck(input) {
  const { content, goal, type = 'analysis' } = input;
  const results = {
    passed: true,
    amplificationRisks: [],
    stakeholders: [],
    irreversibility: 'reversible',
    verdict: 'approve',
  };

  if (!content) return results;

  const text = content.toLowerCase();
  const combined = (goal + ' ' + content).toLowerCase();

  // ============ 1. Stakeholder Analysis 利害关系人分析 ============
  // 谁受益？谁受损？
  const benefitTerms = /用户|客户|消费者|公众|社会/i;
  const harmTerms = /竞争者|对手|替代者|被取代者/i;
  const generalTerms = /所有人|每个人|全体/i;

  if (benefitTerms.test(combined)) {
    results.stakeholders.push({
      who: '目标用户/消费者',
      benefitOrHarm: 'benefit',
      severity: 'high',
    });
  }

  if (harmTerms.test(combined) || /取代|替代|淘汰/i.test(combined)) {
    results.stakeholders.push({
      who: '被替代的现有角色/从业者',
      benefitOrHarm: 'harm',
      severity: 'high',
    });
  }

  if (generalTerms.test(combined)) {
    results.stakeholders.push({
      who: '未提及但可能受影响的第三方',
      benefitOrHarm: 'harm',
      severity: 'medium',
    });
  }

  // 如果只有受益人没有受损者 → warning（可能遗漏了利害关系人）
  const hasBenefit = results.stakeholders.some((s) => s.benefitOrHarm === 'benefit');
  const hasHarm = results.stakeholders.some((s) => s.benefitOrHarm === 'harm');
  if (hasBenefit && !hasHarm) {
    results.amplificationRisks.push({
      level: 'warning',
      issue: '只识别了受益方，未识别受损方',
      amplification1000x: '放大1000倍后，受损方的沉默可能转变为系统性不公平',
    });
  }

  // ============ 2. Amplification Risk 放大效应 ============
  // 如果建议被所有人采纳，会怎样？
  if (/建议|推荐|应该|必须/i.test(content) && type !== 'analysis') {
    results.amplificationRisks.push({
      level: 'warning',
      issue: '内容包含行动建议',
      amplification1000x: '如果1000倍的人采纳此建议，是否会造成资源挤兑或同质化竞争？',
    });
  }

  // 信息茧房风险
  if (/个性化|推荐算法|偏好|精准/i.test(content)) {
    results.amplificationRisks.push({
      level: 'critical',
      issue: '可能加剧信息茧房',
      amplification1000x: '放大1000倍后，每个人只看到自己偏好的信息，公共议题的共识基础被削弱',
    });
  }

  // 隐私风险
  if (/数据|收集|追踪|监控|画像/i.test(content)) {
    results.amplificationRisks.push({
      level: 'critical',
      issue: '涉及数据收集/监控',
      amplification1000x: '放大1000倍后，个人隐私被系统性侵蚀，形成全面监控社会',
    });
  }

  // 偏见固化风险
  if (/默认|通常|一般来说|typical/i.test(content)) {
    results.amplificationRisks.push({
      level: 'warning',
      issue: '可能固化既有偏见或刻板印象',
      amplification1000x: '放大1000倍后，系统化的偏见被嵌入决策流程，弱势群体进一步边缘化',
    });
  }

  // ============ 3. Irreversibility 不可逆性评估 ============
  const irreversiblePatterns = [
    { pattern: /删除|清除|销毁|格式化|永久/i, level: 'irreversible' },
    { pattern: /取代|替代|淘汰|关闭/i, level: 'hard_to_reverse' },
    { pattern: /自动[^。]{0,10}(决策|执行|处理)/i, level: 'hard_to_reverse' },
  ];

  for (const p of irreversiblePatterns) {
    if (p.pattern.test(content)) {
      results.irreversibility = p.level;
      break;
    }
  }

  // ============ 4. Verdict 最终裁决 ============
  const criticalCount = results.amplificationRisks.filter((r) => r.level === 'critical').length;
  const warningCount = results.amplificationRisks.filter((r) => r.level === 'warning').length;

  if (criticalCount > 0 || results.irreversibility === 'irreversible') {
    results.verdict = 'block';
    results.passed = false;
  } else if (warningCount > 1 || results.irreversibility === 'hard_to_reverse') {
    results.verdict = 'caution';
    results.passed = true; // caution 不阻断
  } else {
    results.verdict = 'approve';
  }

  return results;
}
