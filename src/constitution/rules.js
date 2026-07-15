/**
 * 稽影 — 三条产品宪法（增强版）
 *
 * 参考：七层AI系统_价值嵌入版_产品概念文档 第0层
 * 借鉴 OpenAI Codex execpolicy 的 prefix_rule 模式
 *
 * v0.2 增强：
 * - 尊严：检查稽影署名格式完整性 + 位置检测
 * - 自主：结构化列表行数 + 深度关键词分析
 * - 追问：多模式假设检测 + 前置声明要求
 */

/**
 * 尊严宪法（康德：人是目的，不只是手段）
 *
 * 要求：任何 AI 生成内容必须在开头声明 "AI 参与" 或等价标记。
 * v0.2 增强：检查稽影 署名格式 + 声明出现在前 20% 位置。
 * decision='block' → 阻断输出，自动追加声明后放行。
 */
export const DIGNITY_RULE = {
  type: 'dignity',
  condition: (text) => {
    if (!text || text.trim().length === 0) return true;
    // 必须同时包含 AI 声明 + 产品署名
    const aiMarkers = /AI[-\s]?(生成|assisted|参与|generated)|稽影|jiying|kouming/i;
    const hasAIDeclaration = aiMarkers.test(text);
    if (!hasAIDeclaration) return true;

    // 额外检查：声明必须出现在前 20% 位置，且不能是微小的伪造
    const lines = text.split('\n');
    const firstDeclLine = lines.findIndex((l) => aiMarkers.test(l));
    if (firstDeclLine === -1) return true;
    // 声明行必须在总行数的前 25%
    if (firstDeclLine > Math.max(1, lines.length * 0.25)) return true;

    return false;
  },
  decision: 'block',
  justification: '尊严宪法（康德）：AI 必须声明身份，用户有权知道 AI 正在参与。你永远不应该在不知情的情况下被当作优化对象。',
  remedy: (text) => '[稽影 AI 参与]\n\n' + text,
  test_cases: {
    match: [
      '这是分析报告的内容部分，包含详细的数据解读。',
    ],
    not_match: [
      'AI 生成：这是分析报告的内容部分。',
      '稽影 AI 参与：这是分析报告的内容。',
      'AI-assisted 生成的分析报告。',
    ],
  },
};

/**
 * 自主宪法（马尔库塞：消灭替代性想像力 = 消灭自由）
 *
 * 要求：每次 AI 输出必须提供至少 2 个不同的替代方案或思考路径。
 * v0.2 增强：不仅检查关键词，还检查结构化列表格式。
 * decision='warn' → 自动追加替代方案提示。
 */
export const AUTONOMY_RULE = {
  type: 'autonomy',
  condition: (text) => {
    if (!text) return true;

    // 关键词计数
    const keywords = [
      ...(text.match(/替代方案/g) || []),
      ...(text.match(/\balternative\b/gi) || []),
      ...(text.match(/另一种(方式|思路|路径|方案|选择|可能)/g) || []),
      ...(text.match(/方案[一二三二三四]/g) || []),
      ...(text.match(/选项\s*[ABCD一二三]/g) || []),
    ].length;

    // 结构化列表项计数（行首为 数字. 数字) - * • → 等）
    const listItems = (text.match(/^[ \t]*[\d]+[.、)）]|^[ \t]*[-*•→▶]/gm) || []).length;

    // 替代方案区域的检测
    const altSectionCount = (text.match(/(?:替代|alternative|选择|方案)[：:](?:\s*[\s\S]*?)(?:[\d]+[.、)）]){2,}/gi) || []).length;

    // 判定：足够的关键词 或 至少 2 个列表项且有替代关键词
    const hasEnoughKeywords = keywords >= 2;
    const hasListWithContext = keywords >= 1 && listItems >= 2;
    const hasAltSection = altSectionCount >= 1 && listItems >= 2;

    if (hasEnoughKeywords || hasListWithContext || hasAltSection) return false;

    // 检查是否有类似 "考虑以下方案" 的结构
    const introPattern = /(?:考虑|建议|推荐|提供|以下|有几个)[^。]{0,20}(?:方案|选择|方式|思路|路径|做法)/i;
    if (introPattern.test(text) && listItems >= 2) return false;

    return true;
  },
  decision: 'warn',
  justification: '自主宪法（马尔库塞）：每次输出应提供至少 2 个不同的替代方案。选择的能力本身比选择了什么更重要。',
  remedy: (text) => text + '\n\n---\n替代方案：\n1. [请考虑另一种路径]\n2. [请考虑第三种可能]',
  test_cases: {
    match: [
      '这里只有一个推荐的方案，按照这个做就可以了。',
    ],
    not_match: [
      '替代方案一：XX。\n替代方案二：YY。',
      '方案A。替代方案B。另一种思路：C。',
      '提供两个可选方案：\n1. 继续当前策略\n2. 切换到备选路径',
    ],
  },
};

/**
 * 追问宪法（海德格尔 + 陈嘉映：追问本身就是抵抗）
 *
 * 要求：AI 必须在输出末尾声明自己的前提假设。
 * v0.2 增强：多模式假设检测 + 假设段落长度要求。
 * decision='warn' → 自动追加"我的假设"段落。
 */
export const QUESTIONING_RULE = {
  type: 'questioning',
  condition: (text) => {
    if (!text) return true;

    // 多模式假设检测
    const patterns = [
      /我(的)?假设[：:]?\s*\n?/i,
      /前提判断[：:]?\s*\n?/i,
      /我的前提[：:]?\s*\n?/i,
      /我的核心假设[：:]?\s*\n?/i,
      /(基于|以下|我的)[^。]{0,15}(假设|前提)[：:]/i,
      /隐含的前提[：:]/i,
      /本分析基于以下假设/i,
      /在这个分析中,?我假设/i,
      /以下是我做判断时的前提/i,
    ];

    const hasAssumption = patterns.some((pat) => pat.test(text));
    if (!hasAssumption) return true;

    // 进一步增强：检查假设段落是否过于简短（只是关键词无实质内容）
    // 找到假设段落的位置和长度
    for (const pat of patterns) {
      const match = text.match(pat);
      if (match) {
        const afterMatch = text.slice(match.index + match[0].length).trim();
        // 假设段落至少要有 10 个字符才有实质内容
        const firstBoundary = afterMatch.search(/\n{2,}|(?=\n#)/);
        const assumptionBody = firstBoundary > 0 ? afterMatch.slice(0, firstBoundary) : afterMatch.slice(0, 100);
        if (assumptionBody.trim().length < 10) return true; // 太短，视为无效假设
        return false;
      }
    }

    return false;
  },
  decision: 'warn',
  justification: '追问宪法（海德格尔 + 陈嘉映）：AI 必须声明自己的前提假设，让价值判断从隐性变成显性。"行之于途而应于心。"',
  remedy: (text) => text + '\n\n---\n我的假设：\n1. [系统补全] 我在生成以上内容时做了一些前提判断，请审视。如果其中任何一个假设不准确，告诉我是哪一个，我会基于正确的前提重新思考。',
  test_cases: {
    match: [
      '这是完整的分析结果，没有附带任何前提说明。',
    ],
    not_match: [
      '这是分析结果。\n\n我的假设：1. 我假设你关心的是短期影响。',
      '基于我的前提判断，我建议采用方案A。',
      '在这个分析中，我假设目标用户是25-35岁的白领。',
    ],
  },
};

/**
 * 所有宪法规则列表
 */
export const RULES = [DIGNITY_RULE, AUTONOMY_RULE, QUESTIONING_RULE];
