/**
 * 稽影 v0.4.2 — 服务端内核
 *
 * 架构突破：信任保证从"浏览器尽力而为"→"服务端强制执行"
 *
 * v0.2 客户端模式的问题：
 *   - 用户可 DevTools 绕过所有宪法检查
 *   - 知识库无法跨设备共享
 *   - 无多用户隔离
 *
 * v0.4 服务端模式：
 *   - 宪法/质量门禁在服务端执行 → 真正不可绕过
 *   - REST API 供客户端调用
 *   - 服务端日志和审计
 *
 * 启动: node server/index.js
 * 默认端口: 3456
 */

import express from 'express';
import cors from 'cors';
import { RULES } from '../src/constitution/rules.js';
import { runSelfReview } from '../src/quality/selfReview.js';

const app = express();
const PORT = process.env.PORT || 3456;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── 健康检查 ──
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: '稽影 v0.4 服务端内核',
    version: '0.4.0',
    uptime: process.uptime(),
    constitution_rules: RULES.length,
    node: process.version,
  });
});

// ── 宪法检查 API ──
app.post('/api/constitution/check', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text 字段必填（字符串）' });
  }

  const results = RULES.map(rule => ({
    type: rule.type,
    violated: rule.condition(text),
    decision: rule.decision,
    justification: rule.justification,
  }));

  const blocked = results.find(r => r.violated && r.decision === 'block');
  const warned = results.filter(r => r.violated && r.decision === 'warn');

  res.json({
    passed: !blocked,
    results,
    summary: {
      total: results.length,
      blocked: blocked ? 1 : 0,
      warned: warned.length,
      passed: results.filter(r => !r.violated).length,
    },
    checked_at: new Date().toISOString(),
  });
});

// ── 质量门禁 API ──
app.post('/api/quality/review', (req, res) => {
  const { creatorResults, review } = req.body;
  if (!creatorResults || !Array.isArray(creatorResults)) {
    return res.status(400).json({ error: 'creatorResults 字段必填（数组）' });
  }

  const result = runSelfReview({
    intent: req.body.intent || {},
    plan: req.body.plan || {},
    creatorResults,
    review: review || null,
  });

  res.json({
    passed: result.passed,
    criticalCount: result.criticalCount,
    warningCount: result.warningCount,
    results: result.results,
    reviewed_at: new Date().toISOString(),
  });
});

// ── 审计日志 API ──
const auditLog = [];
const MAX_AUDIT_LOG = 1000;

app.post('/api/audit/log', (req, res) => {
  const entry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...req.body,
  };
  auditLog.push(entry);
  if (auditLog.length > MAX_AUDIT_LOG) auditLog.shift();

  res.status(201).json({ logged: true, entry_id: entry.id });
});

app.get('/api/audit/log', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json({
    total: auditLog.length,
    entries: auditLog.slice(-limit).reverse(),
  });
});

// ── 启停控制 ──
let server = null;

export function start() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`🛡️  稽影 v0.4 服务端内核已启动 → http://localhost:${PORT}`);
      console.log(`  宪法规则: ${RULES.length} | 质量门禁: 7 | 审计日志上限: ${MAX_AUDIT_LOG}`);
      resolve(server);
    });
  });
}

export function stop() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('稽影服务端已停止');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// 直接运行时启动
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^\.\//, ''))) {
  start();
}

export { app };
