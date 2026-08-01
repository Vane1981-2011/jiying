import Markdown from './Markdown';
import { ConstitutionBadge } from './AssemblyShared';

/** AI 声明折叠 + 正文渲染 */
function CreatorContent({ content }) {
  if (!content) return <div className="text-sm text-gray-400">(AI 未生成内容)</div>;

  // 匹配声明：从"稽影 ... Agent"到第一个 --- 或 ## 标题
  const declMatch = content.match(/稽影[·.]?工坊[\s\S]*?(?:Creator|Planner|Researcher|Reviewer)\s*Agent[\s\S]*?(?=\n---|\n##\s)/i);
  if (!declMatch) {
    return <Markdown className="text-sm text-gray-700 leading-relaxed" text={content} />;
  }

  const declaration = declMatch[0].trim();
  let body = content.slice(declMatch.index + declMatch[0].length).replace(/^\s*---\s*\n*/, '');
  // 从第一个"假设"标记处切掉后续所有内容
  const assumePatterns = [/\n###?\s*假设\s*\n/i, /\n##\s*我的假设\s*\n/i, /\n---\s*\n我的假设：/i];
  for (const pat of assumePatterns) {
    const m = body.match(pat);
    if (m && m.index > body.length * 0.4) {
      body = body.slice(0, m.index).trim();
      break;
    }
  }

  return (
    <div>
      <details className="mb-3">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
          AI 参与声明
        </summary>
        <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800 leading-relaxed whitespace-pre-line">
          {declaration}
        </div>
      </details>
      <Markdown className="text-sm text-gray-700 leading-relaxed" text={body} />
    </div>
  );
}

export default function AssemblyOutput({
  result,
  intent,
  iterations,
  improving,
  onImprove,
  devilResult,
  onDevilAdvocate,
  speedBump,
  exportQuality,
  qualityExpanded,
  onToggleQualityExpanded,
  onExport,
  skipSteps,
  userEdits,
  rebuttals,
  editingStep,
  editContent,
  onEditContentChange,
  onToggleSkip,
  onSubmitEdit,
  onCancelEdit,
  onRebuttal,
}) {
  return (
    <div className="space-y-6">
      {/* Planner */}
      <div className="p-5 rounded-xl" style={{ border: '1px solid var(--color-ai-border)', background: 'var(--color-ai-bg)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: 'var(--color-ai)' }}>Planner</span>
          <ConstitutionBadge status={result.plan?.constitution?.status} />
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {result.plan?.subtasks?.map((st) => (
            <span key={st.id} className="text-xs px-3 py-1.5 bg-white rounded-full border border-purple-200 text-purple-700 font-medium">
              {st.id}. {st.title}
            </span>
          ))}
        </div>
        {result.plan?.reasoning && (
          <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-purple-200">
            拆解依据：{result.plan.reasoning}
          </div>
        )}
      </div>

      {/* Creator results */}
      {result.creatorResults?.map((item) => (
        <div key={item.subtask.id} className="p-5 rounded-xl" style={{ border: '1px solid var(--color-ai-border)', background: 'var(--color-ai-bg)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: 'var(--color-ai)' }}>
                Creator #{item.subtask.id}
              </span>
              {item.constitution && <ConstitutionBadge status={item.constitution.status} />}
            </div>
            <button onClick={() => onToggleSkip(item.subtask.id)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                skipSteps.has(item.subtask.id) || userEdits[item.subtask.id]
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'text-gray-500 border-gray-200 hover:border-purple-300'
              }`}
            >
              {skipSteps.has(item.subtask.id) || userEdits[item.subtask.id] ? '自己做的' : '自己做'}
            </button>
          </div>

          {editingStep === item.subtask.id ? (
            <div className="space-y-3">
              <textarea className="w-full h-32 p-4 border border-purple-200 rounded-xl text-sm bg-white" value={editContent}
                onChange={(e) => onEditContentChange(e.target.value)} placeholder="在这里完成这个子任务..." />
              <div className="flex gap-2">
                <button onClick={() => onSubmitEdit(item.subtask.id)}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg">提交，继续</button>
                <button onClick={() => onCancelEdit(item.subtask.id)}
                  className="px-4 py-2 text-sm text-gray-500">取消</button>
              </div>
            </div>
          ) : userEdits[item.subtask.id] ? (
            <div className="p-3 rounded-lg text-sm text-gray-700 bg-green-50 border border-green-200">
              {userEdits[item.subtask.id]}
            </div>
          ) : (
            <>
            <CreatorContent content={item.content} />

            {/* Assumptions — 追问宪法：不可折叠 */}
              {item.assumptions && (
                <div className="mt-4 p-3 rounded-lg text-xs"
                  style={{ background: 'var(--color-assumption-bg)', border: '1px solid #FAC775' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium" style={{ color: 'var(--color-assumption)' }}>我的假设</span>
                    {rebuttals[item.subtask.id] && (
                      <span className="text-green-700">已有修正</span>
                    )}
                  </div>
                  <Markdown className="whitespace-pre-wrap text-xs" style={{ color: '#854F0B' }} text={item.assumptions} />
                  {!rebuttals[item.subtask.id] && (
                    <input className="mt-2 w-full px-3 py-1.5 text-xs border border-amber-300 rounded-lg bg-white
                                           focus:outline-none focus:ring-1 focus:ring-amber-400"
                      placeholder="不对——我认为..."
                      onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value.trim()) { onRebuttal(item.subtask.id, e.target.value.trim()); e.target.value = ''; } }}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {result.review && (
        <div className="p-4 rounded-xl bg-white border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">Reviewer #{iterations.length + 1}</span>
            <span className="text-xs text-gray-500">
              综合评分 {result.review.overall}/5
              {result.review.strictMode && ' · 严格模式'}
            </span>
          </div>
          {result.review.issues?.length > 0 && (
            <div className="text-xs text-gray-600 space-y-1">
              {result.review.issues.map((issue, i) => <div key={i}>- {issue}</div>)}
            </div>
          )}
          {iterations.length < 5 && (
            <button onClick={onImprove} disabled={improving}
              className="mt-3 w-full px-4 py-2 text-xs bg-teal-50 text-teal-700 rounded-lg
                         hover:bg-teal-100 disabled:opacity-50 transition-colors">
              {improving ? '改进中...' : `根据反馈改进 (${5 - iterations.length}/5)`}
            </button>
          )}

          {/* M2 魔鬼代言人挑战 */}
          {!devilResult && (
            <button onClick={onDevilAdvocate}
              className="mt-2 w-full px-4 py-2 text-xs bg-orange-50 text-orange-700 rounded-lg
                         border border-orange-200 hover:bg-orange-100 transition-colors">
              🗣 魔鬼代言人挑战 —— 找找漏洞
            </button>
          )}
          {devilResult && (
            <div className="mt-2 p-3 rounded-lg text-xs border border-orange-200 bg-orange-50">
              <div className="font-medium text-orange-800 mb-1">
                🗣 魔鬼代言人 · 置信度 {devilResult.overallConfidence}/5
              </div>
              {devilResult.hiddenAssumptions.length > 0 && (
                <div className="mt-1">
                  <div className="text-orange-700 font-medium">隐含假设：</div>
                  {devilResult.hiddenAssumptions.slice(0, 3).map((a, i) => (
                    <div key={i} className="text-orange-600 ml-2">· {a.assumption}</div>
                  ))}
                </div>
              )}
              {devilResult.biasesDetected.length > 0 && (
                <div className="mt-1">
                  <div className="text-red-700 font-medium">检测到的偏见：</div>
                  {devilResult.biasesDetected.map((b, i) => (
                    <div key={i} className="text-red-600 ml-2">· {b.bias?.name}: {b.evidence}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Improved iterations */}
      {iterations.map((iter, idx) => (
        <div key={idx} className="p-4 rounded-xl bg-white border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">Reviewer #{idx + 2}</span>
            <span className="text-xs text-gray-500">
              综合评分 {iter.review.overall}/5
              <span className="text-gray-400 ml-2">第 {idx + 1} 轮改进</span>
            </span>
          </div>
          {iter.review.issues?.length > 0 && (
            <div className="text-xs text-gray-600 space-y-1">
              {iter.review.issues.map((issue, i) => <div key={i}>- {issue}</div>)}
            </div>
          )}
        </div>
      ))}

      {/* Speed bump card */}
      {speedBump && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-blue-800">⚠ 停下来看一看</span>
          </div>
          <div className="text-xs text-blue-700 leading-relaxed">{speedBump.message}</div>
        </div>
      )}

      {/* Export + Quality Gate */}
      {result?.creatorResults?.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={onExport}
            className="w-full px-4 py-3 bg-purple-600 text-white text-sm rounded-xl
                       hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            导出 Markdown
          </button>

          {/* 质量门禁报告 */}
          {exportQuality && (
            <div className="p-3 rounded-lg text-xs border"
              style={{ borderColor: exportQuality.passed ? '#86EFAC' : '#FCA5A5', background: exportQuality.passed ? '#F0FDF4' : '#FEF2F2' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium" style={{ color: exportQuality.passed ? '#166534' : '#991B1B' }}>
                  {exportQuality.passed ? '✅ 质量检查通过' : '⚠ 质量检查有警告'}
                </span>
                <button onClick={onToggleQualityExpanded}
                  className="text-gray-400 hover:text-gray-600 text-[10px]">
                  {qualityExpanded ? '收起' : '详情'}
                </button>
              </div>
              {exportQuality.criticalCount > 0 && (
                <div className="text-red-700">🔴 {exportQuality.criticalCount} 个 critical 问题</div>
              )}
              {exportQuality.warningCount > 0 && (
                <div className="text-amber-700">🟡 {exportQuality.warningCount} 个 warning</div>
              )}
              {qualityExpanded && exportQuality.results.filter((r) => r.severity !== 'info').map((r, i) => (
                <div key={i} className="mt-1 text-gray-600">· {r.issue}</div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
