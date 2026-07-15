import { describe, it, expect } from 'vitest';
import { filter, passes } from './index';
import { DIGNITY_RULE, AUTONOMY_RULE, QUESTIONING_RULE } from './rules';

describe('尊严宪法 (Dignity)', () => {
  const rule = DIGNITY_RULE;

  it('缺少 AI 声明的文本 → 触发 block', () => {
    for (const text of rule.test_cases.match) {
      expect(rule.condition(text)).toBe(true);
      const result = filter(text);
      expect(result.status).toBe('block');
      expect(result.violations.some((v) => v.rule === 'dignity')).toBe(true);
    }
  });

  it('含 AI 声明标��的文本 → 不触发', () => {
    for (const text of rule.test_cases.not_match) {
      expect(rule.condition(text)).toBe(false);
    }
  });

  it('block 后自动追加身份声明', () => {
    const input = '纯文本内容';
    const result = filter(input);
    expect(result.remediedOutput).toContain('[稽影 AI 参与]');
    expect(result.remediedOutput).toContain('纯文本内容');
    expect(result.originalOutput).toBe(input);
  });
});

describe('自主宪法 (Autonomy)', () => {
  const rule = AUTONOMY_RULE;

  it('不含替代方案的文本 → 触发 warn', () => {
    for (const text of rule.test_cases.match) {
      expect(rule.condition(text)).toBe(true);
      const result = filter(text);
      expect(result.violations.some((v) => v.rule === 'autonomy')).toBe(true);
    }
  });

  it('包含 2 个替代方案的文本 → 不触发', () => {
    for (const text of rule.test_cases.not_match) {
      expect(rule.condition(text)).toBe(false);
    }
  });

  it('warn 后自动追加替代方案提示', () => {
    const input = 'AI 生成：单一方案输出。';
    const result = filter(input);
    expect(result.remediedOutput).toContain('替代方案：');
    expect(result.violations).toHaveLength(2); // autonomy + questioning (dignity passes)
  });
});

describe('追问宪法 (Questioning)', () => {
  const rule = QUESTIONING_RULE;

  it('不含假设段落的文本 → 触发 warn', () => {
    for (const text of rule.test_cases.match) {
      expect(rule.condition(text)).toBe(true);
    }
  });

  it('含假设段落的文本 → 不触发', () => {
    for (const text of rule.test_cases.not_match) {
      expect(rule.condition(text)).toBe(false);
    }
  });

  it('warn 后自动追加假设段落', () => {
    const input = '不含假设的输出。';
    const result = filter(input);
    expect(result.remediedOutput).toContain('我的假设');
  });
});

describe('增强检查 — v0.2 加固', () => {
  describe('尊严：位置检测', () => {
    it('AI 声明在末尾 → 仍触发 block', () => {
      const text = '这是很长的分析内容。\n'.repeat(10) + 'AI 生成：最终结论。';
      const result = filter(text);
      expect(result.status).toBe('block');
    });

    it('AI 声明在前面 → 通过', () => {
      const text = 'AI 生成：这是分析报告。\n内容正文...';
      expect(filter(text).status).not.toBe('block');
    });
  });

  describe('自主：结构化列表', () => {
    it('带编号的替代方案列表 → 通过', () => {
      const text = '考虑以下替代方案：\n1. 继续当前策略\n2. 切换到备选路径';
      expect(AUTONOMY_RULE.condition(text)).toBe(false);
    });

    it('带破折号的列表 → 通过', () => {
      const text = '以下方案：\n- 方案A\n- 方案B';
      expect(AUTONOMY_RULE.condition(text)).toBe(false);
    });

    it('仅有替代方案关键词但无结构化列表 → 仍触发', () => {
      const text = '我们考虑一下替代方案吧。';
      expect(AUTONOMY_RULE.condition(text)).toBe(true);
    });
  });

  describe('追问：段落长度检测', () => {
    it('"我的假设"段落过短（<10字符）→ 仍触发', () => {
      const text = '这是正文。\n\n我的假设：';
      expect(QUESTIONING_RULE.condition(text)).toBe(true);
    });

    it('"我的假设"有实质内容 → 通过', () => {
      const text = '这是正文。\n\n我的假设：1. 我假设目标用户是年轻白领。';
      expect(QUESTIONING_RULE.condition(text)).toBe(false);
    });

    it('多种假设表述模式', () => {
      expect(QUESTIONING_RULE.condition('基于以下假设：目标市场正在持续扩大进入新阶段')).toBe(false);
      expect(QUESTIONING_RULE.condition('在这个分析中，我假设目标用户群体是年轻白领')).toBe(false);
      expect(QUESTIONING_RULE.condition('以下是我做判断时的前提：市场增长率持续在10%以上')).toBe(false);
    });
  });
});

describe('决策逻辑', () => {
  it('任一 block → 整体 status=block', () => {
    const result = filter('无声明、无替代、无假设');
    expect(result.status).toBe('block');
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
  });

  it('全部通过 → status=pass', () => {
    const result = filter('AI 生成\n替代方案A。\n替代方案B。\n我的假设：1. 我假设目标受众是产品经理');
    expect(result.status).toBe('pass');
    expect(result.violations).toHaveLength(0);
  });

  it('passes() 便捷方法正常', () => {
    expect(passes('无身份声明')).toBe(false);
    expect(passes('AI 生成\n替代方案A。替代方案B。\n我的假设：1.X')).toBe(true);
  });

  it('二次检查：补救后仍违规 → 再次补救', () => {
    const result = filter('无声明、无替代、无假设');
    expect(result.remediedOutput).toContain('[稽影 AI 参与]');
    expect(result.remediedOutput).toContain('替代方案：');
    expect(result.remediedOutput).toContain('我的假设：');
  });
});
