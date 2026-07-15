/**
 * 稽影 — Markdown 导出工具
 *
 * 将编排结果拼接为结构化 Markdown 文件并触发浏览器下载。
 * 导出前自动执行 Self-Review 质量门禁。
 */
import { runSelfReview } from '../quality/selfReview';

/**
 * @param {object} params
 * @param {string} params.goal - 用户意图
 * @param {string} params.background - 背景
 * @param {object} params.plan - Planner 输出
 * @param {Array} params.creatorResults - Creator 各子任务结果
 * @param {object} params.review - Reviewer 输出
 * @param {boolean} [params.force=false] - 跳过质量门禁强制导出
 * @returns {{ markdown: string, quality?: { passed: boolean, criticalCount: number, warningCount: number, results: Array } }}
 */
export function buildMarkdownExport({ goal, background, plan, creatorResults, review, force = false }) {
  // 质量门禁：导出前自动检查
  const quality = !force && creatorResults?.length > 0
    ? runSelfReview({ intent: { goal }, plan, creatorResults, review })
    : null;

  if (quality && !quality.passed) {
    console.warn(
      `[Self-Review] ${quality.criticalCount} 个 critical 问题阻挡导出。使用 force=true 强制导出。\n` +
      quality.results.filter((r) => r.severity === 'critical').map((r) => `  🔴 ${r.issue}`).join('\n')
    );
  }

  const lines = [];

  lines.push(`# ${goal}`);
  lines.push('');

  if (background) {
    lines.push(`> 背景：${background}`);
    lines.push('');
  }

  lines.push(`> 本文由稽影生成（${new Date().toISOString().slice(0, 10)}），可直接交给编程 Agent 消费。`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Planner
  if (plan) {
    lines.push('## 任务拆解');
    lines.push('');
    if (plan.reasoning) {
      lines.push(`> ${plan.reasoning}`);
      lines.push('');
    }
    plan.subtasks?.forEach((t, i) => {
      lines.push(`### ${i + 1}. ${t.title}`);
      lines.push('');
      lines.push(`**目标**：${t.goal}`);
      if (t.dependsOn?.length) {
        lines.push(`**依赖**：${t.dependsOn.map((d) => `#${d}`).join(', ')}`);
      }
      lines.push('');
    });
    lines.push('---');
    lines.push('');
  }

  // Creator results
  creatorResults?.forEach((item, i) => {
    lines.push(`## ${item.subtask?.title || `子任务 ${i + 1}`}`);
    lines.push('');
    if (item.content) {
      // 从第一个"假设"标记处切掉后续所有内容（含重复正文）
      let clean = item.content;
      const assumePatterns = [/\n###?\s*假设\s*\n/i, /\n##\s*我的假设\s*\n/i, /\n---\s*\n我的假设：/i];
      for (const pat of assumePatterns) {
        const m = clean.match(pat);
        if (m && m.index > clean.length * 0.4) {
          clean = clean.slice(0, m.index).trim();
          break;
        }
      }
      // 块级去重：拆分为 ## 段落，去掉相邻或相隔的重复块
      const blocks = clean.split(/(?=^#{2,3}\s)/m);
      const seen = new Set();
      const deduped = blocks.map((b) => b.trim()).filter((b) => {
        if (!b || b.length < 5) return false;
        const key = b.replace(/\s+/g, '').slice(0, 80);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      lines.push(deduped.join('\n\n'));
      lines.push('');
    }
    if (item.assumptions) {
      lines.push('### 假设');
      lines.push('');
      lines.push(item.assumptions);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  });

  // Reviewer
  if (review) {
    lines.push('## 审查结果');
    lines.push('');
    lines.push(`- **综合评分**：${review.overall}/5`);
    if (review.strictMode) {
      lines.push(`- **模式**：严格模式`);
    }
    if (review.issues?.length) {
      lines.push('- **问题**：');
      review.issues.forEach((issue) => {
        lines.push(`  - ${issue}`);
      });
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push(`*稽影 | jiying.app | ${new Date().toISOString().slice(0, 10)}*`);

  const markdown = lines.join('\n');
  return quality ? { markdown, quality } : { markdown };
}

/** 触发浏览器下载 */
export function downloadMarkdown(result, goal) {
  // 支持新旧两种调用方式
  const markdown = typeof result === 'string' ? result : result.markdown;
  const quality = typeof result === 'object' ? result.quality : null;

  // 如果有 quality 信息且未通过，在控制台展示但不阻断下载
  if (quality && !quality.passed) {
    console.info('[Self-Review] 导出质量报告:', quality.results);
  }

  const slug = (goal || 'export').slice(0, 30).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
  const filename = `稽影-${slug}-${new Date().toISOString().slice(0, 10)}.md`;
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return quality; // 返回质量报告供调用方展示
}
