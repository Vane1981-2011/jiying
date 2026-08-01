import { describe, it, expect } from 'vitest';
import { ethicsAmplificationCheck } from './ethicsCheck.ts';

describe('C8 伦理放大效应检查', () => {
  describe('利害关系人分析', () => {
    it('识别受益方', () => {
      const r = ethicsAmplificationCheck({
        content: '建议采用此方案，用户将获得更好体验。',
        goal: '优化用户体验',
      });
      expect(r.stakeholders.some((s) => s.benefitOrHarm === 'benefit')).toBe(true);
    });

    it('只有受益方无受损方 → warning', () => {
      const r = ethicsAmplificationCheck({
        content: '建议采用方案A，用户受益显著。',
        goal: '提升效率',
      });
      const risk = r.amplificationRisks.find((rr) => rr.issue.includes('受益'));
      expect(risk).toBeTruthy();
    });
  });

  describe('放大效应', () => {
    it('个性化推荐 → critical', () => {
      const r = ethicsAmplificationCheck({
        content: '使用个性化推荐算法精准匹配用户偏好。',
        goal: '推荐系统优化',
      });
      expect(r.amplificationRisks.some((rr) => rr.level === 'critical')).toBe(true);
    });

    it('数据收集 → critical', () => {
      const r = ethicsAmplificationCheck({
        content: '系统需要收集用户行为数据进行画像分析。',
        goal: '用户分析',
      });
      expect(r.amplificationRisks.some((rr) => rr.level === 'critical')).toBe(true);
    });

    it('正常分析内容 → 无 critical', () => {
      const r = ethicsAmplificationCheck({
        content: '市场分析报告：新能源车2026年销量增长20%。主要原因是政策支持和成本下降。',
        goal: '分析市场趋势',
      });
      const criticalRisks = r.amplificationRisks.filter((rr) => rr.level === 'critical');
      expect(criticalRisks).toHaveLength(0);
    });
  });

  describe('不可逆性', () => {
    it('检测 irreversible 操作', () => {
      const r = ethicsAmplificationCheck({
        content: '建议永久删除旧数据以释放空间。',
        goal: '清理数据',
      });
      expect(r.irreversibility).toBe('irreversible');
      expect(r.verdict).toBe('block');
    });

    it('可逆操作 → reversible', () => {
      const r = ethicsAmplificationCheck({
        content: '建议备份后清理临时文件。',
        goal: '系统维护',
      });
      expect(r.irreversibility).toBe('reversible');
    });
  });

  describe('最终裁决', () => {
    it('无风险 → approve', () => {
      const r = ethicsAmplificationCheck({
        content: '市场分析报告：行业趋势向好。',
        goal: '行业分析',
      });
      expect(r.verdict).toBe('approve');
      expect(r.passed).toBe(true);
    });

    it('有 critical → block', () => {
      const r = ethicsAmplificationCheck({
        content: '使用推荐算法进行个性化内容推送。',
        goal: '内容推荐',
      });
      expect(r.verdict).toBe('block');
      expect(r.passed).toBe(false);
    });
  });
});
