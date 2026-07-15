/**
 * 稽影 — 技能模板注册表（池子架构）
 *
 * 借鉴 OpenAI Codex 的 Skill 加载机制：
 * - 技能不绑定特定 Agent——Agent 启动时从池子中自选匹配项
 * - description 既是人类可读说明，也是 Agent 的路由匹配文本
 * - Agent 读取 description 后自行判断是否需要激活该技能
 */

export const SKILLS = [
  {
    id: 'data-analysis',
    name: '数据分析',
    description: '当任务涉及数据清洗、统计分析、可视化建议或需要定量描述时使用。适用于 Creator 和 Researcher 的信息处理阶段。',
    category: '分析',
    systemPromptAddition: '你是一位数据分析专家。在输出中优先使用定量描述和统计术语。每个结论附带数据支撑和置信区间。',
    temperature: 0.2,
  },
  {
    id: 'market-research',
    name: '市场研究',
    description: '当任务需要结构化竞品分析、市场趋势判断或行业格局扫描时使用。适用于 Researcher 的调研阶段和 Creator 的分析报告生成。',
    category: '分析',
    systemPromptAddition: '你是一位市场研究分析师。每个结论附带市场份额、增长率等量化数据。标注信息来源和可信度。',
    temperature: 0.3,
  },
  {
    id: 'code-review',
    name: '代码审查',
    description: '当输出涉及代码时自动激活。适用于 Reviewer 的质量审查阶段——按安全→性能→可维护性→可读性顺序检查。',
    category: '工程',
    systemPromptAddition: '你是资深代码审查员。按安全→性能→可维护性→可读性的顺序审查。给出具体行号和修复建议。',
    temperature: 0.1,
  },
  {
    id: 'creative-writing',
    name: '创意思考',
    description: '当任务需要创意发散、多角度思考或非线性路径时使用。适用于 Creator 的构思阶段和 Planner 的路径拆解阶段。',
    category: '创意',
    systemPromptAddition: '你是一位创意顾问。提供至少3个不同方向的创意路径，每个附带独特的视角和可行性评估。',
    temperature: 0.7,
  },
  {
    id: 'strategy-planner',
    name: '战略规划',
    description: '当任务需要长线拆解、里程碑设定或资源分配时使用。适用于 Planner 的意图拆解阶段和 Reviewer 的策略审查阶段。',
    category: '战略',
    systemPromptAddition: '你是一位战略顾问。使用目标→子目标→行动项→里程碑的四层拆解。每个节点标注资源需求和风险等级。',
    temperature: 0.3,
  },
  {
    id: 'proofread',
    name: '内容润色',
    description: '当任务需要文本质量检查、语法修正或表达优化时使用。适用于 Reviewer 的文字审查阶段和 Creator 的输出优化阶段。',
    category: '文字',
    systemPromptAddition: '你是一位文字编辑。检查语法错误、逻辑跳跃和表达含糊处，给出具体修改建议而非笼统评价。',
    temperature: 0.2,
  },
  {
    id: 'tech-writing',
    name: '技术写作',
    description: '当任务需要技术文档、API 说明、架构描述或操作指南时使用。适用于 Creator 的文档生成阶段。',
    category: '工程',
    systemPromptAddition: '你是一位技术作家。使用概述→前置条件→步骤→示例→FAQ 的标准格式。代码示例完整可运行。',
    temperature: 0.3,
  },
  {
    id: 'fact-check',
    name: '事实核查',
    description: '当输出包含事实陈述、数据或引用时自动激活。适用于 Reviewer 的验证阶段和 Researcher 的调研阶段。每一条标注 ✅已验证 / ⚠️需确认 / ❓无法验证。',
    category: '分析',
    systemPromptAddition: '你是一位事实核查员。逐条标注每项事实陈述的可信度：✅已验证 / ⚠️需确认 / ❓无法验证。对无法验证的内容附加获取验证的方法。',
    temperature: 0.1,
  },
];

export const CATEGORIES = ['分析', '工程', '创意', '战略', '文字'];

/**
 * 从技能池中匹配当前 Agent 应激活的技能
 * 匹配逻辑：description 包含当前 Agent 角色名称 → 激活
 */
export function matchSkills(agentRole, enabledSkillIds) {
  return SKILLS.filter(
    (s) => enabledSkillIds.includes(s.id) && s.description.toLowerCase().includes(agentRole.toLowerCase()),
  );
}

/**
 * 从 Codex 格式的 SKILL.md 文本导入技能
 * 解析 frontmatter (name, description) → 生成稽影 skill 对象
 */
export function importFromCodexSkill(markdownText) {
  const frontmatterMatch = markdownText.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) throw new Error('不是有效的 SKILL.md 格式：缺少 frontmatter');

  const fm = {};
  for (const line of frontmatterMatch[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  if (!fm.name) throw new Error('SKILL.md 缺少 name 字段');
  if (!fm.description) throw new Error('SKILL.md 缺少 description 字段');

  const body = markdownText.replace(/^---[\s\S]*?---\n*/, '').trim();
  const id = 'custom_' + fm.name.replace(/[^a-z0-9-]/g, '-');
  const category = inferCategory(fm.description + ' ' + body.slice(0, 500));

  return { id, name: fm.name, description: fm.description, category, systemPromptAddition: distillPrompt(body), temperature: 0.3, custom: true };
}

function inferCategory(text) {
  const t = text.toLowerCase();
  if (/规划|拆解|plan|strategy|roadmap|milestone/.test(t)) return '战略';
  if (/工程|代码|code|build|deploy|infra|compile/.test(t)) return '工程';
  if (/创意|brainstorm|ideation|creative|发散/.test(t)) return '创意';
  if (/文字|写作|write|proofread|grammar|edit/.test(t)) return '文字';
  if (/分析|analyz|research|审计|audit|data|metric/.test(t)) return '分析';
  if (/框架|思维|principle|methodology|哲学|追问/.test(t)) return '思维框架';
  return '分析';
}

function distillPrompt(body) {
  const lines = body.split('\n');
  const steps = [];
  let capturing = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^##\s*(Overview|概述|概览|Workflow|流程|步骤)/i.test(t)) { capturing = true; continue; }
    if (capturing && t.startsWith('##')) break;
    if (capturing && t.match(/^\d+[\.\)]\s/) && t.length < 200) steps.push(t);
  }
  if (steps.length) return '按以下流程执行：' + steps.slice(0, 5).join(' → ');
  return body.slice(0, 500);
}
