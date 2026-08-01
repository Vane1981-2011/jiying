/**
 * 稽影 — Schema-First 类型校验系统
 *
 * 对标 Hermes DimResult + FetcherSpec 的设计模式：
 * 先定义 Schema，再解析 JSON，校验不符则报错+提示修复。
 *
 * 设计模式：Schema-First（类型先行）
 * - 每个 Agent 产出的 JSON 格式有独立的 Schema 定义
 * - validate() 返回详细的校验结果（缺失字段/类型错误/格式错误）
 * - 不符合 Schema 的输出会被标记，但不会阻断流程（降级策略）
 *
 * 与宪法过滤器的区别：
 * - 宪法过滤器：检查输出内容（尊严/自主/追问）
 * - Schema 校验：检查输出格式（字段完整性/类型正确性）
 */

/** 字段类型 */
export type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

/** 字段定义 */
export interface FieldDef {
  type: FieldType;
  description: string;
  minLength?: number;
  minItems?: number;
  itemSchema?: Schema;
  fields?: Record<string, FieldDef>;
}

/** Schema 定义 */
export interface Schema {
  name?: string;
  fields: Record<string, FieldDef>;
  required: string[];
}

/** 校验错误 */
export interface ValidationError {
  path: string;
  issue: string;
}

/** 校验结果 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/** safeParse 返回结果 */
export interface SafeParseResult {
  parsed: Record<string, unknown> | null;
  errors: ValidationError[];
  warnings: ValidationError[];
  fallbackUsed: boolean;
}

/** Agent 角色 */
export type AgentRole = 'planner' | 'creator' | 'reviewer' | 'researcher';

/** Planner Agent 输出 Schema */
export const PLANNER_SCHEMA: Schema = {
  name: 'Planner Output',
  fields: {
    subtasks: {
      type: 'array',
      description: '子任务列表，每个包含 id/title/goal/dependsOn',
      minItems: 1,
      itemSchema: {
        fields: {
          id: { type: 'number', description: '子任务编号' },
          title: { type: 'string', description: '子任务标题', minLength: 2 },
          goal: { type: 'string', description: '子任务目标描述', minLength: 5 },
          dependsOn: { type: 'array', description: '依赖的子任务 ID 列表' },
        },
        required: ['id', 'title', 'goal'],
      },
    },
    reasoning: {
      type: 'string',
      description: 'Planner 的拆解依据',
      minLength: 10,
    },
  },
  required: ['subtasks', 'reasoning'],
};

/** Creator Agent 输出 Schema */
export const CREATOR_SCHEMA: Schema = {
  name: 'Creator Output',
  fields: {
    content: { type: 'string', description: '生成的内容正文', minLength: 20 },
    assumptions: { type: 'string', description: '我的假设段落' },
  },
  required: ['content'],
};

/** Reviewer Agent 输出 Schema */
export const REVIEWER_SCHEMA: Schema = {
  name: 'Reviewer Output',
  fields: {
    scores: {
      type: 'object',
      description: '各项评分',
      fields: {
        accuracy: { type: 'number', description: '准确率评分 1-5' },
        logic: { type: 'number', description: '逻辑评分 1-5' },
        intentMatch: { type: 'number', description: '意图匹配度 1-5' },
      },
    },
    issues: { type: 'array', description: '发现的问题列表' },
    suggestions: { type: 'array', description: '改进建议列表' },
    overall: { type: 'number', description: '综合评分 1-5' },
    verdict: {
      type: 'string',
      description: '最终裁决: pass | revise | reject',
    },
  },
  required: ['scores', 'overall', 'verdict'],
};

/** Researcher Agent 输出 Schema */
export const RESEARCHER_SCHEMA: Schema = {
  name: 'Researcher Output',
  fields: {
    content: { type: 'string', description: '调研内容', minLength: 20 },
    sourceStats: {
      type: 'object',
      description: '来源统计',
      fields: {
        primary: { type: 'number', description: '一手来源数量' },
        secondary: { type: 'number', description: '二手来源数量' },
        inferred: { type: 'number', description: '推断数量' },
      },
    },
  },
  required: ['content'],
};

/**
 * 根据 Agent 角色获取对应的 Schema
 */
export function getSchema(role: AgentRole | string): Schema | null {
  const schemas: Record<string, Schema> = {
    planner: PLANNER_SCHEMA,
    creator: CREATOR_SCHEMA,
    reviewer: REVIEWER_SCHEMA,
    researcher: RESEARCHER_SCHEMA,
  };
  return schemas[role] || null;
}

/**
 * 校验单个字段值
 */
function validateField(value: unknown, fieldDef: FieldDef, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (value === undefined || value === null) {
    errors.push({ path, issue: `字段缺失，期望类型 ${fieldDef.type}` });
    return errors;
  }

  // 类型检查
  const actualType: string = Array.isArray(value) ? 'array' : typeof value;
  if (actualType !== fieldDef.type) {
    errors.push({ path, issue: `类型错误：期望 ${fieldDef.type}，实际 ${actualType}` });
    return errors;
  }

  // 长度/数量检查
  if (fieldDef.type === 'string' && fieldDef.minLength && (value as string).length < fieldDef.minLength) {
    errors.push({ path, issue: `字符串长度 ${(value as string).length} < 最小要求 ${fieldDef.minLength}` });
  }
  if (fieldDef.type === 'array') {
    const arr = value as unknown[];
    if (fieldDef.minItems && arr.length < fieldDef.minItems) {
      errors.push({ path, issue: `数组长度 ${arr.length} < 最小要求 ${fieldDef.minItems}` });
    }
    // 递归校验数组元素
    if (fieldDef.itemSchema && arr.length > 0) {
      for (let i = 0; i < arr.length; i++) {
        const itemErrors = validateObject(arr[i] as Record<string, unknown>, fieldDef.itemSchema, `${path}[${i}]`);
        errors.push(...itemErrors);
      }
    }
  }
  if (fieldDef.type === 'object' && fieldDef.fields && value !== null) {
    const objErrors = validateObject(
      value as Record<string, unknown>,
      { fields: fieldDef.fields, required: Object.keys(fieldDef.fields) },
      path,
    );
    errors.push(...objErrors);
  }

  return errors;
}

/**
 * 校验对象是否符合 Schema
 */
function validateObject(obj: Record<string, unknown>, schema: Schema, basePath: string = ''): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!obj || typeof obj !== 'object') {
    errors.push({ path: basePath, issue: '不是有效的对象' });
    return errors;
  }

  // 检查必需字段
  for (const field of schema.required || []) {
    if (obj[field] === undefined || obj[field] === null) {
      errors.push({ path: `${basePath}.${field}`, issue: `缺少必需字段` });
    }
  }

  // 校验每个字段
  for (const [field, fieldDef] of Object.entries(schema.fields || {})) {
    if (obj[field] !== undefined) {
      const fieldErrors = validateField(obj[field], fieldDef, `${basePath}.${field}`);
      errors.push(...fieldErrors);
    }
  }

  return errors;
}

/**
 * 对 Agent 输出 JSON 进行 Schema 校验
 *
 * @param json - 解析后的 JSON 对象
 * @param schema - 要校验的 Schema
 * @param label - 标签（用于错误提示）
 */
export function validate(json: Record<string, unknown> | null | undefined, schema: Schema, label: string = ''): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!json) {
    errors.push({ path: '', issue: `${label}: JSON 为空` });
    return { valid: false, errors, warnings };
  }

  // 基础类型检查
  if (typeof json !== 'object' || Array.isArray(json)) {
    errors.push({ path: '', issue: `${label}: 期望对象，实际为 ${typeof json}` });
    return { valid: false, errors, warnings };
  }

  // Schema 校验
  const schemaErrors = validateObject(json, schema);
  errors.push(...schemaErrors);

  // 识别未知字段（可能有用但不是错误，标记为 warning）
  const knownFields = new Set(Object.keys(schema.fields || {}));
  for (const field of Object.keys(json)) {
    if (!knownFields.has(field)) {
      warnings.push({ path: field, issue: '未知字段（将被忽略）' });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 安全解析 JSON 并进行 Schema 校验
 * 对标 Hermes 的框架捕获异常模式
 *
 * @param rawText - Agent 输出的原始文本
 * @param role - Agent 角色（'planner'|'creator'|'reviewer'|'researcher'）
 */
export function safeParse(rawText: string, role: AgentRole | string): SafeParseResult {
  const schema = getSchema(role);
  let parsed: Record<string, unknown> | null = null;
  let parseError: string | null = null;

  // 尝试提取 JSON（可能是 markdown code block 包裹）
  try {
    const jsonMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1]! : rawText;
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      parsed = JSON.parse(jsonStr.slice(start, end + 1)) as Record<string, unknown>;
    }
  } catch (e: unknown) {
    parseError = e instanceof Error ? e.message : String(e);
  }

  if (!parsed) {
    return {
      parsed: null,
      errors: [{ path: '', issue: `JSON 解析失败: ${parseError || '无法提取有效 JSON'}` }],
      warnings: [],
      fallbackUsed: false,
    };
  }

  if (!schema) {
    return {
      parsed,
      errors: [],
      warnings: [{ path: '', issue: `无 Schema 定义 for role "${role}"` }],
      fallbackUsed: false,
    };
  }

  const validation = validate(parsed, schema);

  return {
    parsed: validation.valid ? parsed : null,
    errors: validation.errors,
    warnings: validation.warnings,
    fallbackUsed: !validation.valid,
  };
}
