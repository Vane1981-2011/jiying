import { AuditCollector, generatePeriodicReport } from '../audit/collector';
import { useState, useEffect } from 'react';

const REPORT_KEY = 'jiying-audit-reports';

export default function AuditPanel() {
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('current');

  useEffect(() => {
    setReport(AuditCollector.getReport());
    try { setHistory(JSON.parse(localStorage.getItem(REPORT_KEY) || '[]').reverse()); } catch { setHistory([]); }
  }, []);

  if (!report) return <div className="max-w-2xl mx-auto py-8 text-gray-400">加载中...</div>;

  const agencyColor = report.agencyScore >= 60 ? 'text-green-600' : report.agencyScore >= 30 ? 'text-amber-600' : 'text-red-600';
  const aiDepColor = report.aiDependencyScore <= 30 ? 'text-green-600' : report.aiDependencyScore <= 60 ? 'text-amber-600' : 'text-red-600';
  const questioningColor = report.questioningScore >= 60 ? 'text-green-600' : report.questioningScore >= 30 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">价值健康报告</h1>
      <p className="text-sm text-gray-500 mb-2">
        这些指标只显示给你自己，绝不出现在任何公共排名中。
        <br />
        <span className="text-purple-600">"你的 AI 越来越好了，你越来越好了吗？"</span>
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <TabButton active={tab === 'current'} onClick={() => setTab('current')} label="当前" />
        <TabButton active={tab === 'history'} onClick={() => setTab('history')} label={`历史 (${history.length})`} />
      </div>

      {tab === 'current' ? (
        <>
          {/* Score Cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <ScoreCard label="AI 介入度" score={report.aiDependencyScore} color={aiDepColor}
              description="越低越好——AI 替你做决策的程度" warn={report.aiDependencyScore > 60}
              warnText="AI 参与了超过一半的任务步骤" />
            <ScoreCard label="能力保留度" score={report.agencyScore} color={agencyColor}
              description="自己做 + 反驳 + 反思 / 总任务" warn={report.agencyScore < 30}
              warnText="在下一个任务中试试自己做一步" />
            <ScoreCard label="追问频率" score={report.questioningScore} color={questioningColor}
              description="溯源完成率 + 反思频率" />
          </div>

          <StatsTable report={report} />
          {report.agencyScore < 30 && report.totalTasks > 3 && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="text-sm font-medium text-red-800 mb-1">效率侵蚀警告</div>
              <div className="text-xs text-red-600">你的 AI 越来越高效了——但你越来越少自己动手、越来越少反问 AI 的假设。一个以人的代价换来的效率不是效率。</div>
            </div>
          )}
        </>
      ) : (
        <HistoryTab history={history} />
      )}
    </div>
  );
}

function ScoreCard({ label, score, color, description, warn, warnText }) {
  return (
    <div className="p-5 bg-white border border-gray-200 rounded-xl">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{score}</div>
      <div className="text-xs text-gray-400 mt-1 whitespace-pre-line">{description}</div>
      {warn && <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">{warnText}</div>}
    </div>
  );
}

function StatsTable({ report }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-700">统计详情（{report.period}）</h3>
      </div>
      <div className="divide-y divide-gray-100">
        <StatRow label="任务总数" value={report.totalTasks} />
        <StatRow label="溯源跳过率" value={`${report.traceSkipRate}%`} warning={report.traceSkipRate > 50} warningText="超过一半的任务跳过了溯源追问" />
        <StatRow label="自己做的步骤" value={report.userDidStepCount} warning={report.userDidStepCount === 0 && report.totalTasks > 3} warningText="最近没有自己动手完成任何步骤" />
        <StatRow label="反驳 AI 假设" value={report.rebuttalCount} />
        <StatRow label="暂停反思次数" value={report.reflectCount} warning={report.reflectCount === 0 && report.totalTasks > 5} warningText="已超过5个任务未使用暂停反思模式" />
        <StatRow label="价值观修改" value={report.valuesChangedCount} />
      </div>
    </div>
  );
}

function HistoryTab({ history }) {
  if (history.length === 0) {
    return <div className="py-12 text-center text-sm text-gray-400">暂无历史报告。完成更多任务后自动生成月度报告。</div>;
  }
  return (
    <div className="space-y-4">
      {history.map((r, i) => (
        <div key={i} className="p-5 bg-white border border-gray-200 rounded-xl">
          <div className="text-xs text-gray-400 mb-2">{r.period}</div>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <MetricLine label="任务数" value={r.current.totalTasks} />
            <MetricLine label="能力保留度" value={r.current.agencyScore}
              delta={r.changes?.agencyScore} />
            <MetricLine label="追问频率" value={r.current.questioningScore}
              delta={r.changes?.questioningScore} />
          </div>
          <div className="text-xs text-gray-500">{r.summary}</div>
        </div>
      ))}
    </div>
  );
}

function MetricLine({ label, value, delta }) {
  return (
    <div>
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="text-sm font-semibold text-gray-900">
        {value}{' '}
        {delta !== undefined && delta !== null && (
          <span className={`text-xs ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {delta >= 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }) {
  return (
    <button onClick={onClick}
      className={`text-xs px-4 py-2 rounded-full border transition-colors ${
        active ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300'
      }`}>
      {label}
    </button>
  );
}

function StatRow({ label, value, warning, warningText }) {
  return (
    <div className="flex items-center justify-between px-6 py-3">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-900">{value}</span>
        {warning && <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full" title={warningText}>!</span>}
      </div>
    </div>
  );
}
