/**
 * 稽影 — 代偿审计收集器
 *
 * 收集用户行为数据用于代偿审计。所有数据仅存本地，绝不上传。
 *
 * 代偿审计的核心问题（王东岳）："你的 AI 越来越好了，你越来越不好了？"
 */

const STORAGE_KEY = 'jiying-audit';
const MAX_EVENTS = 1000;

function loadEvents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveEvents(events) {
  const trimmed = events.slice(-MAX_EVENTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export const AuditCollector = {
  /** 记录用户跳过溯源追问 */
  traceSkipped() {
    const events = loadEvents();
    events.push({ type: 'trace_skipped', timestamp: Date.now() });
    saveEvents(events);
  },

  /** 记录用户填写了溯源追问 */
  traceCompleted(answers) {
    const events = loadEvents();
    events.push({ type: 'trace_completed', timestamp: Date.now(), served: answers.serves });
    saveEvents(events);
  },

  /** 记录用户修改了价值观 */
  valuesChanged(from, to) {
    const events = loadEvents();
    events.push({ type: 'values_changed', timestamp: Date.now(), from, to });
    saveEvents(events);
  },

  /** 记录用户选择了"自己做" */
  stepUserDid(subtaskId) {
    const events = loadEvents();
    events.push({ type: 'step_user_did', timestamp: Date.now(), subtaskId });
    saveEvents(events);
  },

  /** 记录用户反驳了 AI 假设 */
  assumptionRebuttal(subtaskId) {
    const events = loadEvents();
    events.push({ type: 'assumption_rebuttal', timestamp: Date.now(), subtaskId });
    saveEvents(events);
  },

  /** 记录用户打开了暂停反思 */
  pauseReflectOpened() {
    const events = loadEvents();
    events.push({ type: 'pause_reflect_opened', timestamp: Date.now() });
    saveEvents(events);
  },

  /** 记录任务完成 */
  taskCompleted(subtaskCount, totalDuration) {
    const events = loadEvents();
    events.push({
      type: 'task_completed', timestamp: Date.now(),
      subtaskCount, totalDuration,
    });
    saveEvents(events);
  },

  /** 获取审计数据 */
  getReport() {
    const events = loadEvents();
    const now = Date.now();
    const thirtyDays = 30 * 24 * 3600 * 1000;
    const recent = events.filter((e) => now - e.timestamp < thirtyDays);

    const totalTasks = recent.filter((e) => e.type === 'task_completed').length;
    const totalTraces = recent.filter((e) => e.type.startsWith('trace_')).length;
    const traceSkipped = recent.filter((e) => e.type === 'trace_skipped').length;
    const userDidSteps = recent.filter((e) => e.type === 'step_user_did').length;
    const rebuttals = recent.filter((e) => e.type === 'assumption_rebuttal').length;
    const reflectCount = recent.filter((e) => e.type === 'pause_reflect_opened').length;
    const valuesChanged = recent.filter((e) => e.type === 'values_changed').length;

    return {
      period: '30天',
      totalTasks,
      totalTraces,
      traceSkipRate: totalTraces > 0 ? Math.round((traceSkipped / totalTraces) * 100) : 0,
      userDidStepCount: userDidSteps,
      rebuttalCount: rebuttals,
      reflectCount,
      valuesChangedCount: valuesChanged,
      /** AI介入度：任务中被 AI 完成的比例（越低越好——说明用户保留的判断多） */
      aiDependencyScore: calculateAiDependency({ totalTasks, userDidSteps, rebuttals, traceSkipped, totalTraces }),
      /** 能力保留度：自己做 + 反驳 + 反思的操作频率（越高越好） */
      agencyScore: calculateAgencyScore({ totalTasks, userDidSteps, rebuttals, reflectCount }),
      /** 追问频率：不跳过溯源 + 使用暂停反思 */
      questioningScore: calculateQuestioningScore({ totalTraces, traceSkipped, reflectCount }),
      raw: recent,
    };
  },
};

function calculateAiDependency({ totalTasks, userDidSteps, rebuttals, traceSkipped, totalTraces }) {
  if (totalTasks === 0) return 0;
  // 任务中完全交给 AI 的步骤越多 → 依赖度越高
  const avgStepsPerTask = 3; // 假设每个任务约 3 个子步骤
  const actualUserSteps = userDidSteps + rebuttals;
  const dependencyRate = 1 - (actualUserSteps / (totalTasks * avgStepsPerTask));
  // 融合溯源跳过率
  const skipPenalty = totalTraces > 0 ? traceSkipped / totalTraces : 0;
  return Math.min(100, Math.round(Math.max(0, dependencyRate * 100 + skipPenalty * 30)));
}

function calculateAgencyScore({ totalTasks, userDidSteps, rebuttals, reflectCount }) {
  if (totalTasks === 0) return 100;
  const score = ((userDidSteps + rebuttals + reflectCount) / totalTasks) * 50;
  return Math.min(100, Math.round(score));
}

function calculateQuestioningScore({ totalTraces, traceSkipped, reflectCount }) {
  if (totalTraces === 0) return 100;
  const completedRate = 1 - (traceSkipped / totalTraces);
  const reflectWeight = reflectCount * 0.1;
  return Math.min(100, Math.round((completedRate + reflectWeight) * 100));
}

/**
 * 减速点检测
 *
 * 当检测到系统在某维度快速改善时（如效率指标飙升），触发暂停，
 * 提示用户审视改善背后的数据变化。
 */
const SPEED_BUMP_KEY = 'jiying-speed-bump';

export function checkSpeedBump(currentMetrics) {
  const history = JSON.parse(localStorage.getItem(SPEED_BUMP_KEY) || '[]');
  history.push({ ...currentMetrics, timestamp: Date.now() });

  // Keep last 30 entries
  const recent = history.slice(-30);
  localStorage.setItem(SPEED_BUMP_KEY, JSON.stringify(recent));

  if (recent.length < 5) return null;

  // Check for rapid improvement in task completion rate
  const lastFive = recent.slice(-5);
  const avgCompletion = lastFive.reduce((sum, m) => sum + (m.totalTasks || 0), 0) / 5;
  const prevAvg = recent.slice(-10, -5).reduce((sum, m) => sum + (m.totalTasks || 0), 0) / 5;

  if (prevAvg > 0 && avgCompletion / prevAvg > 1.5) {
    return {
      triggered: true,
      metric: '任务完成率',
      previousAvg: Math.round(prevAvg),
      currentAvg: Math.round(avgCompletion),
      improvement: `${Math.round((avgCompletion / prevAvg - 1) * 100)}%`,
      message: '你的任务完成速度在快速增长。停下来看看——是你在变高效，还是AI在替你变高效？',
    };
  }

  return null;
}

/**
 * 周期性价值审计报告
 *
 * 每月生成一次，比较当前指标与上月的变化。
 */
const AUDIT_REPORT_KEY = 'jiying-audit-reports';

export function generatePeriodicReport() {
  const now = Date.now();
  const monthMs = 30 * 24 * 3600 * 1000;

  // Check if we already have a report this month
  const reports = JSON.parse(localStorage.getItem(AUDIT_REPORT_KEY) || '[]');
  const latestReport = reports[reports.length - 1];
  if (latestReport && now - latestReport.timestamp < monthMs) return latestReport;

  const current = AuditCollector.getReport();
  const prevReport = reports[reports.length - 1] || null;

  const report = {
    timestamp: now,
    period: new Date().toISOString().slice(0, 7),
    current,
    changes: prevReport ? {
      agencyScore: current.agencyScore - prevReport.current.agencyScore,
      questioningScore: current.questioningScore - prevReport.current.questioningScore,
      traceSkipRate: current.traceSkipRate - prevReport.current.traceSkipRate,
    } : null,
    aiRedefiningGoals: countGoalRedefinitions(), // 接受了多少AI的替代任务建议
    summary: generateSummary(current, prevReport),
  };

  reports.push(report);
  localStorage.setItem(AUDIT_REPORT_KEY, JSON.stringify(reports.slice(-12))); // Keep 12 months

  return report;
}

function countGoalRedefinitions() {
  const events = JSON.parse(localStorage.getItem('jiying-audit') || '[]');
  return events.filter((e) => e.type === 'values_changed').length;
}

function generateSummary(current, prevReport) {
  const lines = [];
  lines.push(`本月完成 ${current.totalTasks} 个任务`);
  lines.push(`溯源跳过率 ${current.traceSkipRate}%`);
  lines.push(`能力保留度 ${current.agencyScore}/100`);

  if (prevReport) {
    const prev = prevReport.current;
    if (current.agencyScore < prev.agencyScore) {
      lines.push(`能力保留度较上月下降 ${prev.agencyScore - current.agencyScore} 分`);
    }
    if (current.traceSkipRate > prev.traceSkipRate + 10) {
      lines.push('溯源跳过率较上月明显上升——你越来越少追问自己的目标了');
    }
  }

  if (current.agencyScore < 30) {
    lines.push('警告：你的能力保留度已降至低位。效率在上升，但你在退场。');
  }

  return lines.join('。');
}
