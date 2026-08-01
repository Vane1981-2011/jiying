import Markdown from './Markdown';
import { ConstitutionBadge } from './AssemblyShared';

function AgentCard({ agent, output, status, subtaskId }) {
  let display = output?.slice(0, 500) || '等待...';
  // Planner 的 rawText 是 JSON，解析后展示 reasoning + 子任务列表
  if (agent === 'planner' && output) {
    try {
      const j = JSON.parse(output);
      const lines = [];
      if (j.reasoning) lines.push(j.reasoning);
      if (j.subtasks?.length) {
        lines.push('');
        j.subtasks.forEach((t, i) => { lines.push(`${t.id || i + 1}. ${t.title || '未命名子任务'}`); });
      }
      display = lines.join('\n').slice(0, 500);
    } catch { /* 不是 JSON 就原样显示 */ }
  }
  return (
    <div className="p-4 rounded-xl" style={{ border: '1px solid var(--color-ai-border)', background: 'var(--color-ai-bg)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: 'var(--color-ai)' }}>
          {agent === 'planner' ? 'Planner' : agent === 'researcher' ? 'Researcher' : agent === 'creator' ? `Creator ${subtaskId ? '#' + subtaskId : ''}` : agent}
        </span>
        <ConstitutionBadge status={status} />
      </div>
      <Markdown className="text-sm text-gray-600 leading-relaxed line-clamp-4" text={display} />
    </div>
  );
}

export default function AssemblyPipeline({ agentOutputs, intent, error, onRetry }) {
  return (
    <div className="space-y-4">
      {agentOutputs.length === 0 && !error && (
        <div className="py-20 text-center">
          <div className="text-sm text-gray-400 mb-2 animate-pulse">Planner 正在拆解你的意图...</div>
          <div className="text-xs text-gray-300">{intent.goal}</div>
        </div>
      )}
      {agentOutputs.map((out, i) => (
        <AgentCard key={i} agent={out.agent} output={out.output} status={out.constitution} subtaskId={out.subtaskId} />
      ))}

      {error && (
        <div className="py-12 text-center">
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl inline-block text-left">
            <div className="text-sm font-medium text-red-800 mb-1">执行出错</div>
            <div className="text-xs text-red-600">{error}</div>
          </div>
          <button onClick={onRetry}
            className="mt-4 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg">重试</button>
        </div>
      )}
    </div>
  );
}
