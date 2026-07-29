/**
 * 语义宪法验证器 · 测试套件
 */
import { describe, it, expect, vi } from 'vitest';
import { semanticConstitutionCheck, fullConstitutionCheck, getL2CacheStats, L2_TEST_CASES } from './semanticVerifier.js';
import { RULES } from './rules.js';

// 模拟 LLM 调用
function mockLlm(response) {
  return vi.fn().mockResolvedValue(JSON.stringify(response));
}

describe('Semantic Constitution Verifier (L2)', () => {
  it('【L2·genuine】真诚尊重的输出通过语义检查', async () => {
    const llm = mockLlm({
      dignity: { verdict: 'genuine', evidence: '稽影 AI 参与', reason: '声明有品牌标识且与内容衔接' },
      autonomy: { verdict: 'genuine', evidence: '保守策略...积极策略', reason: '两个方案结构不同·风险收益各异' },
      questioning: { verdict: 'genuine', evidence: 'CME FedWatch 数据', reason: '假设引用具体数据源·可验证' },
      overall: 'genuine',
      confidence: 0.92,
    });
    const result = await semanticConstitutionCheck(L2_TEST_CASES.genuine, llm);
    expect(result.passed).toBe(true);
    expect(result.result.overall).toBe('genuine');
  });

  it('【L2·superficial】表面尊重的输出被标记', async () => {
    const llm = mockLlm({
      dignity: { verdict: 'superficial', evidence: 'AI 参与', reason: '声明与内容脱节·无品牌标识' },
      autonomy: { verdict: 'superficial', evidence: '小幅调整方案A', reason: '两个方案是同一思路的措辞变体' },
      questioning: { verdict: 'superficial', evidence: '假设市场稳定', reason: '假设过于泛泛·无法质疑' },
      overall: 'superficial',
      confidence: 0.88,
    });
    const result = await semanticConstitutionCheck(L2_TEST_CASES.superficial_dignity, llm);
    expect(result.passed).toBe(false);
    expect(result.result.dignity.verdict).toBe('superficial');
  });

  it('【降级】L2 关闭时返回 degraded', async () => {
    const result = await semanticConstitutionCheck('任意文本', mockLlm({}), { enabled: false });
    expect(result.degraded).toBe(true);
    expect(result.reason).toBe('L2_DISABLED');
  });

  it('【降级】LLM 超时时优雅降级', async () => {
    const slowLlm = () => new Promise(() => {}); // 永远不 resolve
    const result = await semanticConstitutionCheck('test', slowLlm, { timeout: 100 });
    expect(result.degraded).toBe(true);
    expect(result.passed).toBe(true); // 降级不阻塞
  });

  it('【缓存】相同文本命中缓存', async () => {
    const llm = mockLlm({ overall: 'genuine', confidence: 0.9 });
    const text = L2_TEST_CASES.genuine;
    
    const r1 = await semanticConstitutionCheck(text, llm);
    expect(r1.cached).toBeUndefined();
    
    const r2 = await semanticConstitutionCheck(text, llm);
    expect(r2.cached).toBe(true);
    expect(llm).toHaveBeenCalledTimes(1); // 仅调用一次
  });

  it('【JSON解析】格式错误的响应不崩溃', async () => {
    const badLlm = vi.fn().mockResolvedValue('这不是合法的 JSON 格式');
    const result = await semanticConstitutionCheck('test', badLlm);
    expect(result.degraded).toBe(true);
    expect(result.reason).toBe('L2_PARSE_ERROR');
  });
});

describe('Full Constitution Check (L1 + L2)', () => {
  it('【L1阻断】dignity block 时不执行 L2', async () => {
    const llm = vi.fn();
    const text = '没有任何AI声明的纯内容'; // 会触发 dignity block
    const result = await fullConstitutionCheck(text, RULES, llm);
    expect(result.finalVerdict).toBe('BLOCKED_BY_L1');
    expect(llm).not.toHaveBeenCalled(); // L2 未调用
  });

  it('【L2标记】L1通过但L2标记为表面尊重', async () => {
    const llm = mockLlm({ overall: 'superficial', confidence: 0.8 });
    const text = L2_TEST_CASES.superficial_dignity;
    const result = await fullConstitutionCheck(text, RULES, llm);
    expect(result.finalVerdict).toBe('FLAGGED_BY_L2');
  });

  it('【全通过】L1和L2都通过', async () => {
    const llm = mockLlm({ overall: 'genuine', confidence: 0.95 });
    const result = await fullConstitutionCheck(L2_TEST_CASES.genuine, RULES, llm);
    expect(result.finalVerdict).toBe('PASSED_FULL');
  });
});

describe('L2 Cache', () => {
  it('缓存统计可查询', () => {
    const stats = getL2CacheStats();
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('ttl');
  });
});
