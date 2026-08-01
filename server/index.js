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

// ── 安全配置 ──
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3456', 'app://.'];

app.use(cors({
  origin: (origin, callback) => {
    // 允许无 origin 的请求（如 Electron、curl）
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[Security] CORS 拒绝来源: ${origin}`);
      callback(new Error('不允许的来源'), false);
    }
  },
  methods: ['GET', 'POST'],
  maxAge: 86400,
}));

app.use(express.json({ limit: '2mb' }));

// ── 简易速率限制（内存实现，生产环境应使用 Redis） ──
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60_000; // 1 分钟
const RATE_LIMIT_MAX = 60;        // 每分钟最多 60 次请求

function rateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = rateLimitStore.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };

  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + RATE_LIMIT_WINDOW;
  } else {
    record.count++;
  }

  rateLimitStore.set(ip, record);

  if (record.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: '请求过于频繁，请稍后再试',
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    });
  }

  next();
}

// 定期清理过期记录（每 5 分钟）
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore) {
    if (now > record.resetAt) rateLimitStore.delete(ip);
  }
}, 300_000);

app.use(rateLimiter);

// ── 可选 API Key 鉴权 ──
const API_KEY = process.env.JIYING_API_KEY;

function authGuard(req, res, next) {
  if (!API_KEY) return next(); // 未配置 API Key → 跳过鉴权

  const provided = req.headers['x-api-key'] || req.query.api_key;
  if (provided !== API_KEY) {
    return res.status(401).json({ error: '未授权：API Key 无效' });
  }
  next();
}

// ── 健康检查（无需鉴权） ──
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

// ── API 路由（需鉴权） ──
const api = express.Router();
api.use(authGuard);

// 宪法检查 API
api.post('/constitution/check', (req, res) => {
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

// 质量门禁 API
api.post('/quality/review', (req, res) => {
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

// 审计日志 API
const auditLog = [];
const MAX_AUDIT_LOG = 1000;

api.post('/audit/log', (req, res) => {
  const entry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...req.body,
  };
  auditLog.push(entry);
  if (auditLog.length > MAX_AUDIT_LOG) auditLog.shift();

  res.status(201).json({ logged: true, entry_id: entry.id });
});

api.get('/audit/log', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json({
    total: auditLog.length,
    entries: auditLog.slice(-limit).reverse(),
  });
});

app.use('/api', api);

// ── 启停控制 ──
let server = null;

export function start() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`🛡️  稽影 v0.4 服务端内核已启动 → http://localhost:${PORT}`);
      console.log(`  宪法规则: ${RULES.length} | 质量门禁: 7 | 审计日志上限: ${MAX_AUDIT_LOG}`);
      console.log(`  速率限制: ${RATE_LIMIT_MAX}/分钟 | CORS: ${ALLOWED_ORIGINS.join(', ')}`);
      if (API_KEY) console.log('  🔑 API Key 鉴权已启用');
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
