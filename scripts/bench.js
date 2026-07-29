#!/usr/bin/env node
/**
 * 稽影 — 性能基准测试脚本
 *
 * 覆盖：宪法检查·Self-Review·编排模拟·TF-IDF检索
 * 输出：P50/P95/P99 延迟 + TF-IDF vs 暴力搜索对比
 */

import { DIGNITY_RULE, AUTONOMY_RULE, QUESTIONING_RULE, RULES } from '../src/constitution/rules.js';
import { runSelfReview } from '../src/quality/selfReview.js';

const ITERATIONS = 100;
const WARMUP = 10;

// ── 测试数据 ──
const AI_DECLARED_TEXT = 'AI 生成：这是分析报告的内容部分，包含详细的数据解读和替代方案。\n\n替代方案一：保持现状。\n替代方案二：渐进式调整。\n\n我的假设：我假设用户关注短期效果。';
const MISSING_AI_TEXT = '这是分析报告的内容部分，包含详细的数据解读。';
const NO_ALTERNATIVES_TEXT = 'AI 生成：这里只有一个推荐的方案，按照这个做就可以了。';
const COMPLEX_TEXT = (AI_DECLARED_TEXT + '\n\n' + AI_DECLARED_TEXT).repeat(5);

// ── Benchmark 工具 ──
function benchmark(name, fn, iterations = ITERATIONS) {
  // 预热
  for (let i = 0; i < WARMUP; i++) fn();

  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);

  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = times[0];
  const max = times[times.length - 1];

  console.log(`\n📊 ${name}`);
  console.log(`  迭代: ${iterations} 次 (预热 ${WARMUP})`);
  console.log(`  P50: ${p50.toFixed(3)}ms  P95: ${p95.toFixed(3)}ms  P99: ${p99.toFixed(3)}ms`);
  console.log(`  Avg: ${avg.toFixed(3)}ms  Min: ${min.toFixed(3)}ms  Max: ${max.toFixed(3)}ms`);

  return { name, p50, p95, p99, avg, min, max };
}

// ── TF-IDF vs 暴力搜索对比 ──
function benchmarkSearch() {
  // 模拟文档集
  const documents = [];
  for (let i = 0; i < 50; i++) {
    documents.push({
      id: `doc-${i}`,
      content: `这是第${i}号文档的内容。包含财务数据分析报告、投资风险评估、市场趋势预测等信息。关键词：收益率、波动率、夏普比率、最大回撤。`.repeat(3),
    });
  }

  const query = '财务数据 投资风险 市场趋势';

  // 暴力关键词搜索
  const kwStart = performance.now();
  let kwResults = [];
  for (const doc of documents) {
    const score = query.split(' ').filter(w => doc.content.includes(w)).length;
    if (score > 0) kwResults.push({ id: doc.id, score });
  }
  kwResults.sort((a, b) => b.score - a.score);
  const kwTime = performance.now() - kwStart;

  // 简易 TF-IDF 模拟
  const tfidfStart = performance.now();
  const termFreq = {};
  for (const term of query.split(' ')) {
    termFreq[term] = {};
    for (const doc of documents) {
      const count = (doc.content.match(new RegExp(term, 'g')) || []).length;
      termFreq[term][doc.id] = count / doc.content.length;
    }
    const df = Object.values(termFreq[term]).filter(v => v > 0).length;
    for (const doc of documents) {
      const tf = termFreq[term][doc.id];
      termFreq[term][doc.id] = df > 0 ? tf * Math.log(documents.length / df) : 0;
    }
  }
  const tfidfScores = {};
  for (const doc of documents) {
    tfidfScores[doc.id] = Object.values(termFreq).reduce((sum, tfs) => sum + (tfs[doc.id] || 0), 0);
  }
  const tfidfResults = Object.entries(tfidfScores)
    .filter(([_, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);
  const tfidfTime = performance.now() - tfidfStart;

  console.log('\n📊 检索对比 (50文档·3词查询)');
  console.log(`  暴力关键词: ${kwTime.toFixed(3)}ms · 命中 ${kwResults.length} 篇`);
  console.log(`  TF-IDF:      ${tfidfTime.toFixed(3)}ms · 命中 ${tfidfResults.length} 篇`);
  console.log(`  TF-IDF vs 暴力: ${(kwTime / tfidfTime).toFixed(1)}x ${kwTime > tfidfTime ? '更快' : '更慢'}`);
  console.log(`  Top-3 一致性: ${compareResults(kwResults.slice(0, 3), tfidfResults.slice(0, 3))}`);

  return { kwTime, tfidfTime, kwHits: kwResults.length, tfidfHits: tfidfResults.length };
}

function compareResults(a, b) {
  const ids = new Set(a.map(r => r.id));
  const overlap = b.filter(r => ids.has(r[0])).length;
  return `${overlap}/${Math.min(a.length, b.length)} 重合`;
}

// ── 主流程 ──
console.log('═'.repeat(60));
console.log('  稽影 · 性能基线测试');
console.log('  客户端 SPA · Node.js ' + process.version);
console.log('═'.repeat(60));

// 1. 宪法检查
benchmark('宪法·尊严规则 (合规文本)', () => DIGNITY_RULE.condition(AI_DECLARED_TEXT));
benchmark('宪法·自主规则 (缺失替代方案)', () => AUTONOMY_RULE.condition(NO_ALTERNATIVES_TEXT));
benchmark('宪法·追问规则 (有假设声明)', () => QUESTIONING_RULE.condition(COMPLEX_TEXT));
benchmark('宪法·全规则扫描 (合规文本)', () => RULES.forEach(r => r.condition(AI_DECLARED_TEXT)));

// 2. Self-Review (模拟)
const mockCreatorResults = [
  { content: AI_DECLARED_TEXT, constitution: { status: 'pass' }, subtask: { title: 'Q1' }, assumptions: '假设用户关注短期' },
  { content: AI_DECLARED_TEXT, constitution: { status: 'pass' }, subtask: { title: 'Q2' }, assumptions: '基于公开数据' },
];
const mockReview = { overall: 4 };
benchmark('Self-Review·7项检查', () => runSelfReview({
  intent: {}, plan: {}, creatorResults: mockCreatorResults, review: mockReview,
}));

// 3. 检索对比
const searchResult = benchmarkSearch();

// 4. 基线汇总
const memUsage = process.memoryUsage();
console.log('\n═'.repeat(60));
console.log('  📋 基线汇总');
console.log(`  内存·堆使用: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`);
console.log(`  内存·堆总量: ${(memUsage.heapTotal / 1024 / 1024).toFixed(1)} MB`);
console.log('═'.repeat(60));
