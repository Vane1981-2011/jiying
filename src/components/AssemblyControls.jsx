import { VALUE_LABELS, ContextBlock } from './AssemblyShared';

export default function AssemblyControls({
  intent,
  trace,
  values,
  constitutionStatus,
  ethicsResult,
  onEthicsCheck,
  result,
  speedBump,
  guardianAlerts,
  execStatus,
  currentStep,
  totalSteps,
}) {
  return (
    <div className="w-[360px] border-l border-gray-200 bg-white p-6 overflow-y-auto shrink-0">
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">语境</h3>

      <div className="space-y-4">
        <ContextBlock label="意图" text={intent.goal} />
        {intent.background && <ContextBlock label="背景" text={intent.background} />}
        {intent.constraints && <ContextBlock label="约束" text={intent.constraints} />}

        {trace && !trace.skipped && (
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-400 mb-1">溯源</div>
            <div className="text-sm text-gray-600">服务于 {trace.serves}</div>
            <div className="text-sm text-gray-600">"好" = {trace.definedGood}</div>
          </div>
        )}

        <div className="pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-400 mb-1">价值观</div>
          {Object.entries(values).map(([k, v]) => (
            <div key={k} className="text-sm text-gray-700">
              {VALUE_LABELS[k]?.[v] || v}
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">宪法状态</h3>
          <div className="flex items-center gap-2">
            {constitutionStatus === 'pass' && <span className="w-2 h-2 rounded-full bg-green-500" />}
            {constitutionStatus === 'warn' && <span className="w-2 h-2 rounded-full bg-amber-500" />}
            {constitutionStatus === 'block' && <span className="w-2 h-2 rounded-full bg-red-500" />}
            {!constitutionStatus && <span className="w-2 h-2 rounded-full bg-gray-300" />}
            <span className="text-xs text-gray-500">
              {constitutionStatus === 'pass' ? '全部通过' : constitutionStatus === 'warn' ? '有警告' : constitutionStatus === 'block' ? '有阻断' : '等待中'}
            </span>
          </div>
          {constitutionStatus !== 'pass' && constitutionStatus && (
            <div className="mt-2 text-xs text-amber-700">
              Agent 输出未完全通过宪法检查。查看左侧卡片中的标记了解详情。
            </div>
          )}
        </div>

        {/* C8 伦理放大效应 */}
        {result && !ethicsResult && (
          <div className="pt-4 border-t border-gray-100">
            <button onClick={onEthicsCheck}
              className="w-full px-3 py-2 text-xs bg-gray-50 text-gray-600 rounded-lg
                         border border-gray-200 hover:bg-gray-100 transition-colors">
              🛡 伦理放大效应检查
            </button>
          </div>
        )}
        {ethicsResult && (
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">伦理检查</h3>
            <div className={`p-3 rounded-lg text-xs ${
              ethicsResult.verdict === 'block' ? 'bg-red-50 border border-red-200' :
              ethicsResult.verdict === 'caution' ? 'bg-amber-50 border border-amber-200' :
              'bg-green-50 border border-green-200'
            }`}>
              <div className="font-medium mb-1">
                {ethicsResult.verdict === 'block' ? '🔴 建议阻断' :
                 ethicsResult.verdict === 'caution' ? '🟡 需要警惕' :
                 '🟢 通过'}
              </div>
              {ethicsResult.amplificationRisks.length > 0 && (
                <div className="space-y-1 mt-1">
                  {ethicsResult.amplificationRisks.slice(0, 2).map((r, i) => (
                    <div key={i} className={r.level === 'critical' ? 'text-red-600' : 'text-amber-600'}>
                      {r.level === 'critical' ? '🔴' : '🟡'} {r.issue}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Speed bump warning */}
        {speedBump && (
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">减速提醒</h3>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-blue-800">⚠ 减速点触发</span>
              </div>
              <div className="text-xs text-blue-700 leading-relaxed">
                {speedBump.message}
              </div>
              <div className="mt-2 text-[10px] text-blue-500">
                之前平均 {speedBump.previousAvg} 个 → 现在 {speedBump.currentAvg} 个
              </div>
            </div>
          </div>
        )}

        {/* Guardian alerts */}
        {guardianAlerts.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">守护</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {guardianAlerts.slice(0, 5).map((a) => (
                <div key={a.id} className={`text-xs p-2 rounded-lg ${
                  a.type === 'violation' ? 'bg-red-50 text-red-700' :
                  a.type === 'metric_drift' ? 'bg-amber-50 text-amber-700' :
                  'bg-purple-50 text-purple-700'
                }`}>
                  <span className="font-medium">
                    {a.type === 'violation' ? '⚡' : a.type === 'metric_drift' ? '📉' : '💜'}
                  </span>{' '}
                  {a.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress */}
        {execStatus === 'running' && (
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">进度</h3>
            <div className="text-xs text-gray-500">{currentStep}/{totalSteps || '?'} 步</div>
            <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
              <div className="bg-purple-500 h-1 rounded-full transition-all" style={{ width: totalSteps ? `${(currentStep/totalSteps)*100}%` : '10%' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
