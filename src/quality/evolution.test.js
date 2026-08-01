/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { recordSnapshot, analyzeEvolution, getEvolutionSummary, resetEvolution } from './evolution.js';

describe('C9 系统演化与抗脆弱性', () => {
  beforeEach(async () => {
    await resetEvolution();
  });

  describe('recordSnapshot', () => {
    it('记录快照 → 可读取', async () => {
      await recordSnapshot({
        constitutionViolations: 0,
        userEdits: 2,
        avgConfidence: 4,
        avgReviewScore: 4.5,
        taskCount: 1,
      });
      const summary = await getEvolutionSummary();
      expect(summary).toBeTruthy();
      expect(summary.snapshots).toBe(1);
    });

    it('多次记录 → 累积', async () => {
      await recordSnapshot({ taskCount: 1 });
      await recordSnapshot({ taskCount: 1 });
      await recordSnapshot({ taskCount: 1 });
      const summary = await getEvolutionSummary();
      expect(summary.snapshots).toBe(3);
    });
  });

  describe('analyzeEvolution', () => {
    it('数据不足 → 健康提示', async () => {
      const result = await analyzeEvolution();
      expect(result.suggestions.some((s) => s.message.includes('数据不足'))).toBe(true);
    });

    it('宪法改善趋势 → improving', async () => {
      // 模拟 15 次快照：前5次高违反，后10次低违反
      for (let i = 0; i < 5; i++) {
        await recordSnapshot({ constitutionViolations: 3, userEdits: 1, avgReviewScore: 3 });
      }
      for (let i = 0; i < 10; i++) {
        await recordSnapshot({ constitutionViolations: 0, userEdits: 2, avgReviewScore: 4.5 });
      }
      const result = await analyzeEvolution();
      expect(result.trends.constitutionTrend).toBe('improving');
    });

    it('宪法恶化趋势 → needs_attention', async () => {
      for (let i = 0; i < 5; i++) {
        await recordSnapshot({ constitutionViolations: 0, userEdits: 2, avgReviewScore: 4 });
      }
      for (let i = 0; i < 10; i++) {
        await recordSnapshot({ constitutionViolations: 4, userEdits: 1, avgReviewScore: 2 });
      }
      const result = await analyzeEvolution();
      expect(result.health).toBe('needs_attention');
    });

    it('生成改进建议', async () => {
      // 前5次：良好状态
      for (let i = 0; i < 5; i++) {
        await recordSnapshot({ constitutionViolations: 0, userEdits: 3, avgReviewScore: 4.5 });
      }
      // 后10次：恶化状态
      for (let i = 0; i < 10; i++) {
        await recordSnapshot({ constitutionViolations: 3, userEdits: 0, avgReviewScore: 2.5 });
      }
      const result = await analyzeEvolution();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('抗脆弱性评分', () => {
    it('健康系统 → 高分', async () => {
      for (let i = 0; i < 25; i++) {
        await recordSnapshot({ constitutionViolations: 0, userEdits: 3, avgReviewScore: 4.5 });
      }
      const result = await analyzeEvolution();
      expect(result.antiFragilityScore).toBeGreaterThanOrEqual(6);
    });
  });
});
