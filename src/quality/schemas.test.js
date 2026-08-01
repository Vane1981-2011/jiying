import { describe, it, expect } from 'vitest';
import { validate, safeParse, getSchema, PLANNER_SCHEMA, REVIEWER_SCHEMA } from './schemas.ts';

describe('Schema-First 类型校验', () => {
  describe('Planner Schema', () => {
    const validPlan = {
      subtasks: [
        { id: 1, title: '市场分析', goal: '分析2026年新能源汽车市场', dependsOn: [] },
        { id: 2, title: '竞争格局', goal: '分析主要竞争对手', dependsOn: [1] },
      ],
      reasoning: '先分析市场再分析竞争，基于时间顺序',
    };

    it('有效 Planner 输出 → valid=true', () => {
      const result = validate(validPlan, PLANNER_SCHEMA);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('缺少必需字段 subtasks → valid=false', () => {
      const result = validate({ reasoning: 'test' }, PLANNER_SCHEMA);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('subtasks'))).toBe(true);
    });

    it('subtasks 为空数组 → valid=false', () => {
      const result = validate({ subtasks: [], reasoning: 'test' }, PLANNER_SCHEMA);
      expect(result.valid).toBe(false);
    });

    it('子任务缺少 title → valid=false', () => {
      const result = validate({
        subtasks: [{ id: 1, goal: '分析' }],
        reasoning: 'test reasoning',
      }, PLANNER_SCHEMA);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('title'))).toBe(true);
    });

    it('未知字段 → warning 但不影响 valid', () => {
      const result = validate({ ...validPlan, extraField: 'test' }, PLANNER_SCHEMA);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Reviewer Schema', () => {
    const validReview = {
      scores: { accuracy: 4, logic: 3, intentMatch: 5 },
      issues: ['缺少数据分析'],
      suggestions: ['增加定量分析'],
      overall: 4,
      verdict: 'revise',
    };

    it('有效 Reviewer 输出 → valid=true', () => {
      const result = validate(validReview, REVIEWER_SCHEMA);
      expect(result.valid).toBe(true);
    });

    it('缺少 scores → valid=false', () => {
      const result = validate({ overall: 3, verdict: 'pass' }, REVIEWER_SCHEMA);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('scores'))).toBe(true);
    });

    it('verdict 拼写错误不影响校验（只做类型检查）', () => {
      const result = validate(validReview, REVIEWER_SCHEMA);
      expect(result.valid).toBe(true);
    });
  });

  describe('getSchema', () => {
    it('已知角色返回对应的 Schema', () => {
      expect(getSchema('planner')).toBe(PLANNER_SCHEMA);
      expect(getSchema('reviewer')).toBe(REVIEWER_SCHEMA);
    });

    it('未知角色返回 null', () => {
      expect(getSchema('unknown')).toBeNull();
    });
  });

  describe('safeParse', () => {
    it('解析有效 JSON → 返回 parsed', () => {
      const result = safeParse(
        '{"subtasks":[{"id":1,"title":"测试","goal":"测试2026年新能源汽车市场"}],"reasoning":"拆解依据：先分析市场再分析竞争"}',
        'planner',
      );
      expect(result.parsed).toBeTruthy();
      expect(result.errors).toHaveLength(0);
    });

    it('从 Markdown code block 中提取 JSON', () => {
      const result = safeParse(
        '```json\n{"subtasks":[{"id":1,"title":"测试","goal":"测试2026年新能源汽车市场"}],"reasoning":"拆解依据：先分析市场再分析竞争格局"}\n```',
        'planner',
      );
      expect(result.parsed).toBeTruthy();
      expect(result.errors).toHaveLength(0);
    });

    it('无效 JSON → 返回 parsed=null', () => {
      const result = safeParse('不是 JSON 格式的内容', 'planner');
      expect(result.parsed).toBeNull();
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });

    it('缺少必需字段 → fallbackUsed=true', () => {
      const result = safeParse('{"someField": "test"}', 'planner');
      expect(result.fallbackUsed).toBe(true);
      expect(result.parsed).toBeNull();
    });

    it('未知角色 → 只解析但不校验 Schema', () => {
      const result = safeParse('{"data": "test"}', 'unknown');
      expect(result.parsed).toBeTruthy();
      expect(result.errors).toHaveLength(0);
    });
  });
});
