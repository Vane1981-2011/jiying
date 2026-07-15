/**
 * 稽影 — C9 系统自演化机制（抗脆弱性）
 *
 * 对标 MAD-THINK C9（演化维度）的本质层要求：
 * 「系统是否具备自演化能力？能否从使用中学习并自我改进？」
 * 「如果底层技术换了，这套设计还能用吗？」
 *
 * 设计模式：Observe → Learn → Adapt → Evolve
 * - Observe: 收集宪法违反、用户行为、性能指标
 * - Learn: 分析模式，识别瓶颈和机会
 * - Adapt: 调整提示词/参数/配置
 * - Evolve: 将改进沉淀为知识资产
 */

const EVOLUTION_KEY = "jiying-evolution-metrics";

/**
 * 系统健康快照
 * @typedef {{ timestamp: number, constitutionViolations: number, userEdits: number, avgConfidence: number, avgReviewScore: number, skillUsage: Array<{skill, count}> }} Snapshot
 */

/**
 * 记录一次执行快照
 *
 * @param {object} metrics
 */
export function recordSnapshot(metrics) {
  try {
    const history = loadHistory();
    const snapshot = {
      timestamp: Date.now(),
      constitutionViolations: metrics.constitutionViolations || 0,
      userEdits: metrics.userEdits || 0,
      avgConfidence: metrics.avgConfidence || 3,
      avgReviewScore: metrics.avgReviewScore || 3,
      taskCount: metrics.taskCount || 1,
      skillUsage: metrics.skillUsage || [],
    };
    history.push(snapshot);
    // 保留最近 500 条
    localStorage.setItem(EVOLUTION_KEY, JSON.stringify(history.slice(-500)));
  } catch {
    // 静默失败
  }
}

/**
 * 加载历史快照
 */
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(EVOLUTION_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * 分析演化趋势，生成改进建议
 *
 * 对标 MAD-THINK L6 反馈闭环的"校准"阶段
 *
 * @returns {{
 *   health: 'healthy'|'needs_attention'|'declining',
 *   trends: {
 *     constitutionTrend: 'improving'|'stable'|'declining',
 *     userEngagementTrend: 'increasing'|'stable'|'decreasing',
 *     qualityTrend: 'improving'|'stable'|'declining',
 *   },
 *   suggestions: Array<{type: 'prompt_tuning'|'skill_recommendation'|'constitution_tuning'|'architecture_note', priority: 'high'|'medium'|'low', message: string}>,
 *   antiFragilityScore: number, // 1-10
 * }}
 */
export function analyzeEvolution() {
  const history = loadHistory();
  const suggestions = [];

  if (history.length < 3) {
    return {
      health: 'healthy',
      trends: { constitutionTrend: 'stable', userEngagementTrend: 'stable', qualityTrend: 'stable' },
      suggestions: [{ type: 'architecture_note', priority: 'low', message: '数据不足，需要至少 3 次任务记录才能分析演化趋势' }],
      antiFragilityScore: 5,
    };
  }

  const recent = history.slice(-10);
  const older = history.slice(-20, -10);

  // 1. 宪法违反趋势
  const recentViolations = recent.reduce((sum, s) => sum + s.constitutionViolations, 0) / recent.length;
  const olderViolations = older.length > 0 ? older.reduce((sum, s) => sum + s.constitutionViolations, 0) / older.length : recentViolations;
  const constitutionTrend = recentViolations < olderViolations * 0.8 ? 'improving' :
    recentViolations > olderViolations * 1.2 ? 'declining' : 'stable';

  // 2. 用户参与趋势（自己做 + 反驳）
  const recentEdits = recent.reduce((sum, s) => sum + (s.userEdits || 0), 0) / recent.length;
  const olderEdits = older.length > 0 ? older.reduce((sum, s) => sum + (s.userEdits || 0), 0) / older.length : recentEdits;
  const userEngagementTrend = recentEdits > olderEdits * 1.2 ? 'increasing' :
    recentEdits < olderEdits * 0.8 ? 'decreasing' : 'stable';

  // 3. 质量趋势
  const recentQuality = recent.reduce((sum, s) => sum + s.avgReviewScore, 0) / recent.length;
  const olderQuality = older.length > 0 ? older.reduce((sum, s) => sum + s.avgReviewScore, 0) / older.length : recentQuality;
  const qualityTrend = recentQuality > olderQuality * 1.1 ? 'improving' :
    recentQuality < olderQuality * 0.9 ? 'declining' : 'stable';

  // === 生成改进建议 ===

  // 宪法提高频率过高 → 建议调优 prompt
  if (constitutionTrend === 'declining') {
    suggestions.push({
      type: 'constitution_tuning',
      priority: 'high',
      message: `宪法违反率上升中（${(recentViolations).toFixed(1)}/任务）。建议检查最近变更是否降低了输出质量，或需要调整 Agent prompt`,
    });
  } else if (constitutionTrend === 'improving') {
    suggestions.push({
      type: 'prompt_tuning',
      priority: 'low',
      message: '宪法合规率持续提升，当前提示词配置有效',
    });
  }

  // 用户参与度下降 → 建议提醒用户"自己做"
  if (userEngagementTrend === 'decreasing') {
    suggestions.push({
      type: 'architecture_note',
      priority: 'medium',
      message: `用户自己做步骤在减少（${(recentEdits).toFixed(1)}/任务 → 之前 ${(olderEdits).toFixed(1)}/任务）。建议在审计面板提醒"自己做"的价值`,
    });
  }

  // 质量趋势分析
  if (qualityTrend === 'declining') {
    suggestions.push({
      type: 'prompt_tuning',
      priority: 'high',
      message: `平均审查评分下降中（${recentQuality.toFixed(1)}/5 → 之前 ${olderQuality.toFixed(1)}/5）。建议检查 Agent 是否偏离了预期输出格式`,
    });
  }

  // 技能使用分析
  const skillUsageMap = {};
  for (const snap of recent) {
    if (snap.skillUsage) {
      for (const su of snap.skillUsage) {
        skillUsageMap[su.skill] = (skillUsageMap[su.skill] || 0) + su.count;
      }
    }
  }
  const unusedSkills = Object.entries(skillUsageMap)
    .filter(([_, count]) => count === 0)
    .map(([skill]) => skill);
  if (unusedSkills.length > 2) {
    suggestions.push({
      type: 'skill_recommendation',
      priority: 'low',
      message: `${unusedSkills.length} 个技能未被使用。考虑是否需要优化其描述或移除`,
    });
  }

  // 整体健康度
  const health = constitutionTrend === 'declining' || qualityTrend === 'declining' ? 'needs_attention' :
    recentViolations > 3 ? 'needs_attention' : 'healthy';

  // 抗脆弱性评分
  let antiFragilityScore = 7;
  if (health === 'needs_attention') antiFragilityScore -= 2;
  if (history.length >= 20) antiFragilityScore += 1;  // 有足够历史数据
  if (userEngagementTrend === 'increasing') antiFragilityScore += 1;  // 用户参与度提升
  if (recentQuality >= 4) antiFragilityScore += 1;

  return {
    health,
    trends: { constitutionTrend, userEngagementTrend, qualityTrend },
    suggestions,
    antiFragilityScore: Math.min(10, Math.max(1, antiFragilityScore)),
  };
}

/**
 * 获取演化历史摘要（用于审计面板）
 */
export function getEvolutionSummary() {
  const history = loadHistory();
  if (history.length === 0) return null;

  const first = history[0];
  const last = history[history.length - 1];
  const timeSpan = Math.round((last.timestamp - first.timestamp) / (24 * 3600 * 1000));

  return {
    snapshots: history.length,
    timeSpanDays: timeSpan,
    firstDate: new Date(first.timestamp).toISOString().slice(0, 10),
    lastDate: new Date(last.timestamp).toISOString().slice(0, 10),
    avgViolationsPerTask: (history.reduce((s, h) => s + h.constitutionViolations, 0) / history.length).toFixed(2),
    avgQualityScore: (history.reduce((s, h) => s + (h.avgReviewScore || 0), 0) / history.length).toFixed(1),
    antiFragilityScore: analyzeEvolution().antiFragilityScore,
  };
}
