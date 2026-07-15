/**
 * 稽影 — 轻量 Markdown 渲染组件
 *
 * 零外部依赖，支持常用 Markdown 语法。
 * 渲染 AI 生成的卡片内容。
 */
export default function Markdown({ text, className = '' }) {
  if (!text) return null;

  const html = parseMarkdown(text);

  return (
    <div
      className={`markdown-body ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function parseMarkdown(text) {
  // 首先 escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 代码块 (```...```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="bg-gray-100 rounded-lg p-3 overflow-x-auto text-xs my-2"><code>${code.trim()}</code></pre>`;
  });

  // 行内代码 (`code`)
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs text-pink-600 font-mono">$1</code>');

  // 表格: 匹配连续的 |...| 行（至少 3 行：表头 + 分隔 + 数据）
  html = html.replace(/((?:^\|.+\|\s*$(?:\n|$))+)/gm, (block) => {
    const lines = block.trim().split('\n');
    if (lines.length < 2) return block;
    const headerLine = lines[0];
    const sepLine = lines[1];
    const dataLines = lines.slice(2);
    if (!/^\|[-: |]+\|$/.test(sepLine.trim())) return block; // 不是表格分隔行

    const parseRow = (line) => line.split('|').slice(1, -1).map((c) => c.trim());

    const header = parseRow(headerLine).map((c) =>
      `<th class="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 border-b border-gray-200 text-left">${c}</th>`
    ).join('');

    const rows = dataLines.map((r) => {
      const cells = parseRow(r).map((c) =>
        `<td class="px-3 py-2 text-xs text-gray-600 border-b border-gray-100">${c}</td>`
      ).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    return `<div class="overflow-x-auto my-3"><table class="w-full border-collapse border border-gray-200 rounded-lg"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
  });

  // 标题 (###, ##, #)
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-900 mt-3 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-gray-900 mt-4 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-900 mt-5 mb-3">$1</h1>');

  // 粗体 + 斜体 (***...***)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // 粗体 (**...**)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 斜体 (*...*)
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 水平线 (---)
  html = html.replace(/^---+$/gm, '<hr class="border-gray-200 my-3" />');

  // 无序列表 (每一行是一个 <li>，连续的行构成 <ul>)
  html = html.replace(/((?:^[-*•] .+(?:\n|$))+)/gm, (block) => {
    const items = block.trim().split('\n').map((line) => {
      return `<li class="text-sm text-gray-700 ml-4 list-disc">${line.replace(/^[-*•] /, '')}</li>`;
    }).join('');
    return `<ul class="my-2 space-y-1">${items}</ul>`;
  });

  // 有序列表
  html = html.replace(/((?:^\d+[.)] .+(?:\n|$))+)/gm, (block) => {
    const items = block.trim().split('\n').map((line) => {
      return `<li class="text-sm text-gray-700 ml-4 list-decimal">${line.replace(/^\d+[.)] /, '')}</li>`;
    }).join('');
    return `<ol class="my-2 space-y-1">${items}</ol>`;
  });

  // 段落：连续的非空行
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map((p) => {
    const trimmed = p.trim();
    if (!trimmed) return '';
    // 如果已经包含块级元素，不包装
    if (/^<(h[1-3]|ul|ol|pre|hr)/.test(trimmed)) return trimmed;
    // 如果是单行且不包含块级标记，包装为段落
    return `<p class="text-sm text-gray-700 leading-relaxed">${trimmed.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');

  return html;
}
