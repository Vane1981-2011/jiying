export const VALUE_LABELS = {
  speed: { speed: '快速', accuracy: '准确', depth: '深度' },
  coverage: { coverage: '全面', focus: '聚焦', key_points: '关键点' },
  novelty: { novelty: '创新', feasibility: '可行', reliability: '可靠' },
};

export function ConstitutionBadge({ status }) {
  if (!status || status === 'pass') return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">宪法通过</span>;
  if (status === 'warn') return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">宪法警告</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">宪法阻断</span>;
}

export function ContextBlock({ label, text }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-sm text-gray-700 leading-relaxed">{text}</div>
    </div>
  );
}
