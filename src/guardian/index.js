/**
 * 稽影 — 价值守护进程（完整版）
 *
 * 独立于编排引擎的后台监控。通过 Zustand subscribeWithSelector 只读订阅。
 * 五项监控：尊严红线 / 能力退化 / 想像力衰减 / 指标漂移 / 追问缺失
 */

import { filter } from '../constitution';
import { AuditCollector } from '../audit/collector';
import { useGuardianStore } from '../store/guardianStore';

let checkInterval = null;

/**
 * 初始化守护进程 — 五项全监控
 */
export function initGuardian(store) {
  if (!store || typeof store.subscribe !== 'function') {
    console.warn('[Guardian] 无法订阅');
    return () => {};
  }

  let prevLength = 0;

  // Monitor 1: 尊严红线 — 每个 Agent 输出即时检查
  const unsub = store.subscribe((state) => {
    const outputs = state.agentOutputs || [];
    if (outputs.length <= prevLength) return;
    prevLength = outputs.length;

    const latest = outputs[outputs.length - 1];
    if (!latest?.output) return;

    const { status, violations } = filter(latest.output);
    if (status !== 'pass') {
      notify('violation', { agent: latest.agent, violations });
    }
  });

  // Monitors 2-5: 定期检查（每 10 分钟）
  checkInterval = setInterval(() => {
    const report = AuditCollector.getReport();

    // Monitor 2: 能力退化检测
    if (report.totalTasks >= 5 && report.agencyScore < 30) {
      notify('agency_decline', {
        score: report.agencyScore,
        message: '你的AI越来越好了——但你越来越少自己动手。试试在下一个任务中自己做一步？',
      });
    }

    // Monitor 3: 想像力衰减检测（暂停反思使用频率）
    if (report.totalTasks >= 5 && report.reflectCount === 0) {
      notify('imagination_decline', {
        message: '你最近做了不少任务。有没有什么事是AI在替你做——但你不再确定是否应该做？',
      });
    }

    // Monitor 4: 追问缺失检测（溯源跳过率）
    if (report.traceSkipRate > 70 && report.totalTasks >= 3) {
      notify('questioning_decline', {
        skipRate: report.traceSkipRate,
        message: '你最近跳过了大部分溯源追问。有没有一个任务的目标，值得停下来重新想一想？',
      });
    }

    // Monitor 5: 指标漂移（暂存快照，季度比较）
    trackMetricDrift(report);
  }, 600000);

  return () => {
    unsub();
    if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
  };
}

function notify(type, detail) {
  useGuardianStore.getState().addAlert({ type, ...detail });
}

// 指标漂移跟踪
const DRIFT_KEY = 'jiying-metric-drift';

function trackMetricDrift(report) {
  const snapshots = JSON.parse(localStorage.getItem(DRIFT_KEY) || '[]');
  snapshots.push({
    timestamp: Date.now(),
    aiDependencyScore: report.aiDependencyScore,
    agencyScore: report.agencyScore,
    questioningScore: report.questioningScore,
    traceSkipRate: report.traceSkipRate,
    reflectCount: report.reflectCount,
  });

  // 只保留最近 90 天的快照
  const cutoff = Date.now() - 90 * 24 * 3600 * 1000;
  const recent = snapshots.filter((s) => s.timestamp > cutoff);
  localStorage.setItem(DRIFT_KEY, JSON.stringify(recent.slice(-500)));

  // 检测漂移：与 7 天前比较
  const sevenDaysAgo = snapshots.find((s) => s.timestamp < Date.now() - 7 * 24 * 3600 * 1000);
  if (sevenDaysAgo && report.totalTasks >= 10) {
    const drift = report.agencyScore - sevenDaysAgo.agencyScore;
    if (drift < -20) {
      notify('metric_drift', {
        direction: 'decline',
        change: drift,
        message: `你的能力保留度在过去一周下降了 ${Math.abs(drift)} 分。`,
      });
    }
  }
}

/** 获取指标漂移报告 */
export function getMetricDriftReport() {
  const snapshots = JSON.parse(localStorage.getItem(DRIFT_KEY) || '[]');
  if (snapshots.length < 2) return null;

  const latest = snapshots[snapshots.length - 1];
  const oldest = snapshots[0];

  return {
    period: `${Math.round((latest.timestamp - oldest.timestamp) / (24 * 3600 * 1000))} 天`,
    agencyDrift: latest.agencyScore - oldest.agencyScore,
    questioningDrift: latest.questioningScore - oldest.questioningScore,
    traceSkipDrift: latest.traceSkipRate - oldest.traceSkipRate,
    totalSnapshots: snapshots.length,
  };
}

export function shutdown() {
  if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
}
