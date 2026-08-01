/**
 * 稽影 — Self-Review 质量门禁
 *
 * 对标 Hermes self_review.py 的设计模式：
 * 在导出/提交之前做一组机械检查，critical 级别阻断操作。
 *
 * 与宪法过滤器的区别：
 * - 宪法过滤器：每个 Agent 输出即时检查（尊严/自主/追问）
 * - Self-Review：最终输出整体检查（质量/完整性/一致性）
 *
 * 设计模式：Pre-flight Check（先检后出）
 * 每条检查项独立、可测试，含 evidence 和 suggested_fix。
 */

/** 严重级别 */
export const SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
} as const;

export type SeverityLevel = (typeof SEVERITY)[keyof typeof SEVERITY];

/** 检查结果 */
export interface CheckResult {
  severity: SeverityLevel;
  category: string;
  issue: string;
  evidence: string;
  suggestedFix: string;
}

/** 宪法状态 */
interface ConstitutionStatus {
  status: 'pass' | 'block' | 'warn';
  violations?: Array<{ rule: string }>;
}

/** 子任务 */
interface Subtask {
  id: number;
  title?: string;
  goal?: string;
  dependsOn?: number[];
}

/** Creator 子任务结果 */
export interface CreatorResult {
  content?: string;
  assumptions?: string;
  assessment?: string;
  constitution?: ConstitutionStatus;
  skipped?: boolean;
  userEdited?: boolean;
  subtask?: Subtask;
}

/** Review 审查结果 */
export interface ReviewResult {
  overall: number;
  issues?: string[];
  suggestions?: string[];
  scores?: {
    accuracy?: number;
    logic?: number;
    intentMatch?: number;
  };
  verdict?: string;
}

/** runSelfReview 选项 */
export interface SelfReviewOptions {
  intent: { goal: string };
  plan?: { subtasks: Subtask[] };
  creatorResults: CreatorResult[];
  review?: ReviewResult | null;
}

/** runSelfReview 返回结果 */
export interface SelfReviewOutput {
  passed: boolean;
  results: CheckResult[];
  criticalCount: number;
  warningCount: number;
}

/**
 * 执行全部 7 项质量检查
 *
 * @param options.intent - 任务意图
 * @param options.plan - Planner 输出
 * @param options.creatorResults - Creator 各子任务结果
 * @param options.review - Reviewer 输出
 */
export function runSelfReview({ intent: _intent, plan: _plan, creatorResults, review }: SelfReviewOptions): SelfReviewOutput {
  const results: CheckResult[] = [];
  const checks: Array<() => CheckResult | null> = [
    () => checkConstitutionStatus(creatorResults),
    () => checkAgentAllParticipated(creatorResults),
    () => checkContentCoverage(creatorResults),
    () => checkPlaceholderStrings(creatorResults),
    () => checkReviewerScoring(review ?? null),
    () => checkAssumptionsDeclared(creatorResults),
    () => checkContentDeduplication(creatorResults),
  ];

  for (const check of checks) {
    const result = check();
    if (result) results.push(result);
  }

  const criticalCount = results.filter((r) => r.severity === SEVERITY.CRITICAL).length;
  const warningCount = results.filter((r) => r.severity === SEVERITY.WARNING).length;

  return {
    passed: criticalCount === 0,
    results,
    criticalCount,
    warningCount,
  };
}

/**
 * 检查 1: 宪法状态 — 是否有任何 Agent 输出被宪法阻断？
 * 对标 Hermes check_empty_dims
 *
 * 🔴 Critical: 有 block 状态
 * 🟡 Warning: 有 warn 状态
 */
function checkConstitutionStatus(creatorResults: CreatorResult[]): CheckResult | null {
  if (!creatorResults?.length) return null;

  const blocked = creatorResults.filter((r) => r.constitution?.status === 'block');
  const warned = creatorResults.filter((r) => r.constitution?.status === 'warn');

  if (blocked.length > 0) {
    return {
      severity: SEVERITY.CRITICAL,
      category: '宪法检查',
      issue: `${blocked.length} 个子任务的输出被宪法阻断`,
      evidence: `阻断子任务: ${blocked.map((r) => r.subtask?.title || r.subtask?.id).join(', ')}`,
      suggestedFix: '检查被阻断的子任务内容，手动编辑或重新生成',
    };
  }

  if (warned.length > 0) {
    return {
      severity: SEVERITY.WARNING,
      category: '宪法检查',
      issue: `${warned.length} 个子任务有宪法警告（替代方案/假设段落）`,
      evidence: `警告子任务: ${warned.map((r) => r.subtask?.title || r.subtask?.id).join(', ')}`,
      suggestedFix: '建议检查被警告的内容是否需要手动补充',
    };
  }

  return null;
}

/**
 * 检查 2: Agent 参与度 — 是否所有子任务都有输出？
 * 对标 Hermes check_agent_analysis_exists
 *
 * 🟡 Warning: 有子任务被跳过或无内容
 */
function checkAgentAllParticipated(creatorResults: CreatorResult[]): CheckResult | null {
  if (!creatorResults?.length) return {
    severity: SEVERITY.CRITICAL,
    category: '完成度',
    issue: '没有 Creator 输出结果',
    evidence: 'creatorResults 为空',
    suggestedFix: '重新运行编排以确保所有 Agent 参与',
  };

  const skipped = creatorResults.filter((r) => r.skipped || r.userEdited);
  const emptyContent = creatorResults.filter((r) => !r.content || r.content.trim().length === 0);

  if (emptyContent.length > 0) {
    return {
      severity: SEVERITY.CRITICAL,
      category: '完成度',
      issue: `${emptyContent.length} 个子任务内容为空`,
      evidence: `空内容子任务: ${emptyContent.map((r) => r.subtask?.title).join(', ')}`,
      suggestedFix: '重新生成空内容的子任务，或手动填写',
    };
  }

  if (skipped.length > 0) {
    return {
      severity: SEVERITY.WARNING,
      category: '完成度',
      issue: `${skipped.length} 个子任务由用户手动完成`,
      evidence: `手动完成: ${skipped.map((r) => r.subtask?.title).join(', ')}`,
      suggestedFix: '确认手动完成的内容质量符合预期',
    };
  }

  return null;
}

/**
 * 检查 3: 内容覆盖率 — 有效内容占比是否足够？
 * 对标 Hermes check_coverage_threshold
 *
 * 🔴 Critical: 覆盖率 < 60%
 * 🟡 Warning: 覆盖率 < 80%
 */
function checkContentCoverage(creatorResults: CreatorResult[]): CheckResult | null {
  if (!creatorResults?.length) return null;

  const nonEmpty = creatorResults.filter((r) => r.content && r.content.trim().length > 50);
  const coveragePct = Math.round((nonEmpty.length / creatorResults.length) * 100);

  if (coveragePct < 60) {
    return {
      severity: SEVERITY.CRITICAL,
      category: '覆盖率',
      issue: `内容覆盖率仅 ${coveragePct}%（阈值 60%）`,
      evidence: `${nonEmpty.length}/${creatorResults.length} 个子任务有充足内容`,
      suggestedFix: '重新生成内容不足的子任务，考虑调整 Prompt 或价值观偏好',
    };
  }

  if (coveragePct < 80) {
    return {
      severity: SEVERITY.WARNING,
      category: '覆盖率',
      issue: `内容覆盖率 ${coveragePct}%（建议 80%+）`,
      evidence: `${nonEmpty.length}/${creatorResults.length} 个子任务有充足内容`,
      suggestedFix: '考虑补充内容较少的子任务',
    };
  }

  return null;
}

/**
 * 检查 4: 占位符残留 — Agent 是否留下了未填充的占位词？
 * 对标 Hermes check_placeholder_strings
 *
 * 🔴 Critical: 检测到占位符
 */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\[请.*?\]/g,
  /\[待.*?\]/g,
  /等待.*?(生成|补充|完善)/g,
  /TODO/i,
  /FIXME/i,
  /\[placeholder\]/gi,
  /\[系统补全\]/g,
  /\[用户补充\]/g,
];

interface PlaceholderIssue {
  subtask: string | number | undefined;
  placeholders: string[];
}

function checkPlaceholderStrings(creatorResults: CreatorResult[]): CheckResult | null {
  if (!creatorResults?.length) return null;

  const issues: PlaceholderIssue[] = [];

  for (const result of creatorResults) {
    if (!result.content) continue;
    for (const pattern of PLACEHOLDER_PATTERNS) {
      const matches = result.content.match(pattern);
      if (matches) {
        issues.push({
          subtask: result.subtask?.title || result.subtask?.id,
          placeholders: matches.slice(0, 3),
        });
        break;
      }
    }
  }

  if (issues.length > 0) {
    return {
      severity: SEVERITY.CRITICAL,
      category: '占位符',
      issue: `${issues.length} 个子任务包含未填充的占位符`,
      evidence: `受影响的子任务: ${issues.map((i) => `${i.subtask}(${i.placeholders.join(',')})`).join('; ')}`,
      suggestedFix: '手动编辑替换占位符内容，或使用"自己做"模式填写',
    };
  }

  return null;
}

/**
 * 检查 5: Review 评分 — Reviewer 对整体质量的评分
 * 对标 Hermes check_valuation_sanity
 *
 * 🟡 Warning: 评分 < 3/5
 * 🟢 Info: 评分 >= 4/5
 */
function checkReviewerScoring(review: ReviewResult | null): CheckResult | null {
  if (!review) return {
    severity: SEVERITY.WARNING,
    category: '审查评分',
    issue: '未执行 Reviewer 审查',
    evidence: 'review 为空',
    suggestedFix: '建议启用 Reviewer 进行质量审查',
  };

  if (review.overall < 3) {
    return {
      severity: SEVERITY.WARNING,
      category: '审查评分',
      issue: `Review 综合评分仅 ${review.overall}/5`,
      evidence: review.issues?.slice(0, 2).join('; ') || '无具体问题',
      suggestedFix: '使用 Reflexion 循环根据反馈改进内容',
    };
  }

  if (review.overall >= 4) {
    return {
      severity: SEVERITY.INFO,
      category: '审查评分',
      issue: `Review 综合评分 ${review.overall}/5 —— 优秀 ✅`,
      evidence: '',
      suggestedFix: '',
    };
  }

  return null;
}

/**
 * 检查 6: 假设声明 — 每个子任务是否都有假设段落？
 * 对标 Hermes 的可审计性要求
 *
 * 🟡 Warning: 部分子任务缺少假设
 */
function checkAssumptionsDeclared(creatorResults: CreatorResult[]): CheckResult | null {
  if (!creatorResults?.length) return null;

  const missing = creatorResults.filter((r) => !r.assumptions || r.assumptions.trim().length < 10);

  if (missing.length > 0) {
    return {
      severity: SEVERITY.WARNING,
      category: '假设声明',
      issue: `${missing.length} 个子任务缺少假设段落`,
      evidence: `缺少假设: ${missing.map((r) => r.subtask?.title).join(', ')}`,
      suggestedFix: '追问宪法会自动追加假设段落，如仍未生成请手动补充',
    };
  }

  return null;
}

/**
 * 检查 7: 内容去重 — 是否有大量重复内容？
 * 稽影特有的检查（AI 生成内容有时会重复自身）
 *
 * 🟡 Warning: 检测到内容重复
 */
function checkContentDeduplication(creatorResults: CreatorResult[]): CheckResult | null {
  if (!creatorResults?.length || creatorResults.length < 2) return null;

  // 检测不同子任务之间的内容相似度
  const duplicatePairs: Array<{ a: string | number; b: string | number; similarity: number }> = [];
  for (let i = 0; i < creatorResults.length; i++) {
    for (let j = i + 1; j < creatorResults.length; j++) {
      const a = creatorResults[i]!.content || '';
      const b = creatorResults[j]!.content || '';
      if (a.length < 50 || b.length < 50) continue;

      // 简单 Jaccard 相似度
      const setA = new Set(a.slice(0, 200).split(''));
      const setB = new Set(b.slice(0, 200).split(''));
      const intersection = new Set([...setA].filter((x) => setB.has(x)));
      const union = new Set([...setA, ...setB]);
      const similarity = intersection.size / union.size;

      if (similarity > 0.85) {
        duplicatePairs.push({
          a: creatorResults[i]!.subtask?.title || i,
          b: creatorResults[j]!.subtask?.title || j,
          similarity: Math.round(similarity * 100),
        });
      }
    }
  }

  if (duplicatePairs.length > 0) {
    return {
      severity: SEVERITY.WARNING,
      category: '内容去重',
      issue: `检测到 ${duplicatePairs.length} 对相似内容`,
      evidence: duplicatePairs.map((p) => `${p.a} ↔ ${p.b} (${p.similarity}% 相似)`).join('; '),
      suggestedFix: '考虑调整子任务划分以使内容差异化',
    };
  }

  return null;
}
