import { describe, it, expect } from 'vitest';
import { runSelfReview, SEVERITY } from './selfReview.ts';

const makeResult = (overrides = {}) => ({
  content: '这是一份有实际内容的产品分析报告。包含多个分析维度和详细的数据支持，覆盖市场规模、竞争格局、用户需求和技术趋势等关键方面。',
  assumptions: '我的假设：1. 我假设目标用户是产品经理',
  assessment: '内容充分且有深度，覆盖多个分析维度。',
  constitution: { status: 'pass', violations: [] },
  skipped: false,
  userEdited: false,
  subtask: { id: 1, title: '基本分析' },
  ...overrides,
});

describe('Self-Review 质量门禁', () => {
  describe('宪法状态检查', () => {
    it('全部通过 → 无 critical', () => {
      const result = runSelfReview({
        intent: { goal: '测试' },
        plan: { subtasks: [{ id: 1, title: '测试' }] },
        creatorResults: [makeResult()],
      });
      expect(result.criticalCount).toBe(0);
    });

    it('有宪法阻断 → critical', () => {
      const result = runSelfReview({
        intent: { goal: '测试' },
        plan: { subtasks: [{ id: 1, title: '测试' }] },
        creatorResults: [makeResult({ constitution: { status: 'block', violations: [{ rule: 'dignity' }] } })],
      });
      expect(result.criticalCount).toBeGreaterThanOrEqual(1);
      expect(result.passed).toBe(false);
    });
  });

  describe('Agent 参与度检查', () => {
    it('空 creatorResults → critical', () => {
      const result = runSelfReview({
        intent: { goal: '测试' },
        creatorResults: [],
      });
      expect(result.criticalCount).toBeGreaterThanOrEqual(1);
      expect(
        result.results.some((r) => r.issue.includes('没有 Creator')),
      ).toBe(true);
    });

    it('内容为空 → critical', () => {
      const result = runSelfReview({
        intent: { goal: '测试' },
        plan: { subtasks: [{ id: 1, title: '测试' }] },
        creatorResults: [makeResult({ content: '' })],
      });
      expect(result.criticalCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('内容覆盖率检查', () => {
    it('覆盖率 < 60% → critical', () => {
      const result = runSelfReview({
        intent: { goal: '测试' },
        plan: { subtasks: [{ id: 1, title: 'a' }, { id: 2, title: 'b' }, { id: 3, title: 'c' }] },
        creatorResults: [
          makeResult({ subtask: { id: 1, title: 'a' } }),
          makeResult({ subtask: { id: 2, title: 'b' }, content: '' }),
          makeResult({ subtask: { id: 3, title: 'c' }, content: '' }),
        ],
      });
      const coverageCheck = result.results.find((r) => r.category === '覆盖率');
      expect(coverageCheck).toBeTruthy();
      expect(coverageCheck.severity).toBe(SEVERITY.CRITICAL);
    });
  });

  describe('占位符检查', () => {
    it('检测到 [请补充] 占位符 → critical', () => {
      const result = runSelfReview({
        intent: { goal: '测试' },
        plan: { subtasks: [{ id: 1, title: '测试' }] },
        creatorResults: [makeResult({ content: '这是分析报告，[请补充具体数据]' })],
      });
      expect(result.criticalCount).toBeGreaterThanOrEqual(1);
      expect(result.results.some((r) => r.category === '占位符')).toBe(true);
    });

    it('检测到 TODO 占位符 → critical', () => {
      const result = runSelfReview({
        intent: { goal: '测试' },
        plan: { subtasks: [{ id: 1, title: '测试' }] },
        creatorResults: [makeResult({ content: 'TODO: 补充完整分析' })],
      });
      expect(result.criticalCount).toBeGreaterThanOrEqual(1);
    });

    it('检测到 [系统补全] → critical', () => {
      const result = runSelfReview({
        intent: { goal: '测试' },
        plan: { subtasks: [{ id: 1, title: '测试' }] },
        creatorResults: [makeResult({ content: '内容。[系统补全]的假设段落' })],
      });
      expect(result.criticalCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Review 评分检查', () => {
    it('无 review → warning', () => {
      const result = runSelfReview({
        intent: { goal: '测试' },
        creatorResults: [makeResult()],
        review: null,
      });
      expect(result.results.some((r) => r.category === '审查评分')).toBe(true);
    });

    it('review 评分高 → info', () => {
      const result = runSelfReview({
        intent: { goal: '测试' },
        creatorResults: [makeResult()],
        review: { overall: 5, issues: [] },
      });
      const reviewCheck = result.results.find((r) => r.category === '审查评分');
      expect(reviewCheck.severity).toBe(SEVERITY.INFO);
    });
  });

  describe('假设声明检查', () => {
    it('缺少假设段落 → warning', () => {
      const result = runSelfReview({
        intent: { goal: '测试' },
        plan: { subtasks: [{ id: 1, title: '测试' }] },
        creatorResults: [makeResult({ assumptions: '' })],
      });
      expect(result.results.some((r) => r.category === '假设声明')).toBe(true);
    });
  });

  describe('内容去重检查', () => {
    it('高相似度内容 → warning', () => {
      // 使用完全相同的超长内容确保 Jaccard 相似度 > 0.85
      const dupText =
        '产品分析报告显示市场正在快速增长，建议采取积极策略。' +
        '本报告从多个维度分析了当前市场格局和发展趋势。' +
        '基于最新数据，我们建议企业应加大投入以抢占市场份额。';
      const result = runSelfReview({
        intent: { goal: '测试' },
        plan: { subtasks: [{ id: 1, title: 'a' }, { id: 2, title: 'b' }] },
        creatorResults: [
          { content: dupText, assumptions: '假设', constitution: { status: 'pass' }, skipped: false, userEdited: false, subtask: { id: 1, title: 'a' } },
          { content: dupText, assumptions: '假设', constitution: { status: 'pass' }, skipped: false, userEdited: false, subtask: { id: 2, title: 'b' } },
        ],
      });
      expect(result.results.some((r) => r.category === '内容去重')).toBe(true);
    });
  });

  describe('整体通过/失败', () => {
    it('无任何问题 → passed=true', () => {
      const result = runSelfReview({
        intent: { goal: '分析市场' },
        plan: { subtasks: [{ id: 1, title: '市场规模', goal: '分析' }] },
        creatorResults: [
          makeResult({ subtask: { id: 1, title: '市场规模' } }),
        ],
        review: { overall: 4, issues: [] },
      });
      expect(result.passed).toBe(true);
      expect(result.criticalCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });

    it('有 critical → passed=false', () => {
      const result = runSelfReview({
        intent: { goal: '测试' },
        plan: { subtasks: [{ id: 1, title: '测试' }] },
        creatorResults: [makeResult({ content: '' })],
      });
      expect(result.passed).toBe(false);
    });
  });
});
