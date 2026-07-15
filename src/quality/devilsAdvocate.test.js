import { describe, it, expect } from 'vitest';
import { challenge, COGNITIVE_BIASES } from './devilsAdvocate';

describe('魔鬼代言人 M2 批判性思维', () => {
  describe('基础功能', () => {
    it('空内容 → low confidence', () => {
      const result = challenge({ content: '' });
      expect(result.overallConfidence).toBe(1);
      expect(result.challenged).toBe(false);
    });

    it('有效内容 → 返回完整挑战报告', () => {
      const result = challenge({
        content: '建议加大新能源汽车市场投入。当前市场增长迅速，所有主要车企都在加大投入。数据分析显示未来三年市场将增长50%。',
      });
      expect(result.challenged).toBe(true);
      expect(result.hiddenAssumptions.length).toBeGreaterThanOrEqual(1);
      expect(result.biasesDetected.length).toBeGreaterThanOrEqual(1);
      expect(result.reverseArgument.length).toBeGreaterThan(10);
    });
  });

  describe('假设挖掘', () => {
    it('检测到确定性语言', () => {
      const result = challenge({
        content: '这个方案一定成功。市场肯定会接受。用户绝对会喜欢。',
      });
      const det = result.hiddenAssumptions.filter((a) => a.severity === 'high');
      expect(det.length).toBeGreaterThanOrEqual(1);
    });

    it('检测到受众假设', () => {
      const result = challenge({
        content: '用户想要更快更好的产品。我们的目标受众是年轻人。',
      });
      const userAssumptions = result.hiddenAssumptions.filter((a) => a.label === '受众假设');
      expect(userAssumptions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('偏见检测', () => {
    it('无反方观点 → 检测到确认偏误', () => {
      const result = challenge({
        content: '推荐采用方案A。方案A有三大优势：成本低、速度快、效果好。',
      });
      const confirmationBias = result.biasesDetected.find((b) => b.bias?.id === 'confirmation');
      expect(confirmationBias).toBeTruthy();
    });

    it('包含反方观点 → 不触发确认偏误', () => {
      const result = challenge({
        content: '推荐采用方案A。但方案B在长期可能更优。方案A有局限：初期成本高。',
      });
      const confirmationBias = result.biasesDetected.find((b) => b.bias?.id === 'confirmation');
      expect(confirmationBias).toBeFalsy();
    });

    it('过度自信 → 检测到', () => {
      const result = challenge({
        content: '这个方案百分之百可行。毫无疑问这是最佳选择。绝对没问题。',
      });
      const overconfidence = result.biasesDetected.find((b) => b.bias?.id === 'overconfidence');
      expect(overconfidence).toBeTruthy();
    });
  });

  describe('深度模式', () => {
    it('深度模式检查更严格', () => {
      const quick = challenge({
        content: '建议继续加大投入。已经在研发上投入了大量资源。',
        mode: 'quick',
      });
      const deep = challenge({
        content: '建议继续加大投入。已经在研发上投入了大量资源。',
        mode: 'deep',
      });
      expect(deep.biasesDetected.length).toBeGreaterThanOrEqual(quick.biasesDetected.length);
    });

    it('深度模式检测群体思维', () => {
      const result = challenge({
        content: '大家一致认为这是正确的方向。没有争议。',
        mode: 'deep',
      });
      const groupthink = result.biasesDetected.find((b) => b.bias?.id === 'groupthink');
      expect(groupthink).toBeTruthy();
    });
  });

  describe('综合置信度', () => {
    it('无明显问题 → 高置信度', () => {
      const result = challenge({
        content: '建议加大市场投入，但需注意三点风险：需求不确定性、竞争加剧、成本波动。然而市场趋势整体向好。',
      });
      expect(result.overallConfidence).toBeGreaterThanOrEqual(3);
    });

    it('多个严重问题 → 低置信度', () => {
      const result = challenge({
        content: '这个方案一定成功。数据绝对准确。用户肯定喜欢。市场必然增长。毫无疑问。',
      });
      expect(result.overallConfidence).toBeLessThan(3);
    });
  });
});
