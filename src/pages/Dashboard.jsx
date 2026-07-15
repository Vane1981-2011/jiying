import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useIntentStore } from '../store/intentStore';
import { useUserStore } from '../store/userStore';
import { useAgentStore } from '../store/agentStore';
import { AuditCollector } from '../audit/collector';

const VALUE_OPTIONS = {
  speed: [
    { value: 'speed', label: '快速' },
    { value: 'accuracy', label: '准确' },
    { value: 'depth', label: '深度' },
  ],
  coverage: [
    { value: 'coverage', label: '全面' },
    { value: 'focus', label: '聚焦' },
    { value: 'key_points', label: '关键点' },
  ],
  novelty: [
    { value: 'novelty', label: '创新' },
    { value: 'feasibility', label: '可行' },
    { value: 'reliability', label: '可靠' },
  ],
};

const VALUE_LABELS = {
  speed: { speed: '快速=好', accuracy: '准确=好', depth: '深度=好' },
  coverage: { coverage: '全面=好', focus: '聚焦=好', key_points: '关键点=好' },
  novelty: { novelty: '创新=好', feasibility: '可行=好', reliability: '可靠=好' },
};

function inferValues(goal) {
  const g = (goal || '').toLowerCase();
  if (g.includes('分析') || g.includes('研究') || g.includes('报告')) return { speed: 'depth', coverage: 'coverage', novelty: 'novelty' };
  if (g.includes('快速') || g.includes('总结') || g.includes('摘要')) return { speed: 'speed', coverage: 'key_points', novelty: 'reliability' };
  return { speed: 'speed', coverage: 'coverage', novelty: 'novelty' };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const store = useIntentStore();
  const apiKey = useUserStore((s) => s.apiKey);

  const [goal, setGoal] = useState(store.intent.goal || '');
  const [background, setBackground] = useState(store.intent.background || '');
  const [constraints, setConstraints] = useState(store.intent.constraints || '');
  const [step, setStep] = useState(store.status === 'confirmed' ? 4 : store.status === 'valued' ? 3 : store.status === 'traced' ? 2 : 1);
  const [trace, setTrace] = useState({
    serves: store.trace.serves || '',
    definedGood: store.trace.definedGood || '',
    alternative: store.trace.alternative || '',
  });
  const [values, setValues] = useState({
    speed: store.values.speed || 'speed',
    coverage: store.values.coverage || 'coverage',
    novelty: store.values.novelty || 'novelty',
  });
  const [simpleMode, setSimpleMode] = useState(false);

  const taskHistory = useAgentStore((s) => s.taskHistory);

  // On unmount, persist to store
  useEffect(() => {
    return () => {
      if (goal) store.setIntent('goal', goal);
      if (background) store.setIntent('background', background);
      if (constraints) store.setIntent('constraints', constraints);
    };
  }, [goal, background, constraints]);

  const handleGoalSubmit = (e) => {
    e.preventDefault();
    if (!goal.trim()) return;
    const inferred = inferValues(goal);
    setValues(inferred);
    setStep(2);
  };

  const handleTraceSubmit = (e) => {
    e.preventDefault();
    if (!trace.serves.trim()) return;
    AuditCollector.traceCompleted({ serves: trace.serves });
    setStep(3);
  };

  const handleSkipTrace = () => {
    AuditCollector.traceSkipped();
    setStep(3);
  };

  const handleConfirm = () => {
    store.setIntent('goal', goal);
    store.setIntent('background', background);
    store.setIntent('constraints', constraints);
    store.setIntent('simpleMode', simpleMode);
    store.setTrace('serves', trace.serves);
    store.setTrace('definedGood', trace.definedGood);
    store.setTrace('alternative', trace.alternative);
    store.setTrace('skipped', !trace.serves);
    Object.entries(values).forEach(([k, v]) => store.setValue(k, v));
    store.setStatus('confirmed');
    setStep(4); // Show constitution card before navigating
  };

  const handleLaunch = () => {
    if (!apiKey) {
      alert('请先在设置页面配置 DeepSeek API Key');
      navigate('/settings');
      return;
    }
    // 清空旧任务结果，避免 AssemblyLine 误判为已完成
    useAgentStore.getState().reset();
    navigate('/assembly/new');
  };

  const handleReset = () => {
    store.reset();
    setGoal('');
    setBackground('');
    setConstraints('');
    setTrace({ serves: '', definedGood: '', alternative: '' });
    setStep(1);
  };

  return (
    <div className="h-full flex">
      {/* Left: Main workspace — 60% */}
      <div className="flex-1 overflow-y-auto px-10 py-12">
        {step === 1 && (
          <form onSubmit={handleGoalSubmit} className="max-w-2xl">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              稽影
            </h1>
            <p className="text-xs text-gray-400 mb-6">
              稽察审视，追影溯源 —— AI Agent 编排工坊。
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-2">
              你想要做什么？
            </label>
            <textarea
              className="w-full px-4 py-4 border border-gray-200 rounded-xl text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              rows={3}
              placeholder="例如：分析2026年新能源汽车市场格局"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              autoFocus
            />

            <details className="mt-3">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                更多细节（可选）
              </summary>
              <div className="mt-3 space-y-3">
                <textarea
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none
                             focus:outline-none focus:ring-2 focus:ring-purple-400"
                  rows={2}
                  placeholder="背景：为什么现在需要这个？"
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                />
                <input
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="约束：只考虑中国市场"
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                />
              </div>
            </details>

            <label className="flex items-center gap-2 mt-3 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={simpleMode} onChange={(e) => setSimpleMode(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-purple-600" />
              快速模式 — 跳过 Planner & Researcher，直接生成
            </label>

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                disabled={!goal.trim()}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl text-sm font-medium
                           hover:bg-purple-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                开始
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="max-w-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">确认一下——这件任务本身</h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">服务于谁？</label>
                <input
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="产品团队 / CEO / 我自己"
                  value={trace.serves}
                  onChange={(e) => setTrace({ ...trace, serves: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  谁定义的"好"？
                </label>
                <input
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm
                             focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder='市场部门 / CEO 定义的"有洞察力"'
                  value={trace.definedGood}
                  onChange={(e) => setTrace({ ...trace, definedGood: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleTraceSubmit}
                  disabled={!trace.serves.trim()}
                  className="px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium
                             hover:bg-purple-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  继续
                </button>
                <button
                  onClick={handleSkipTrace}
                  className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  跳过
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">你定义的"好"是什么？</h2>
            <p className="text-sm text-gray-400 mb-6">系统根据你的意图推断了以下价值观。不对的话——改。</p>

            <div className="space-y-4">
              {Object.entries(VALUE_OPTIONS).map(([key, options]) => (
                <div key={key} className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    {VALUE_LABELS[key][values[key]]}
                  </p>
                  <div className="flex gap-2">
                    {options.map((opt) => (
                      <button key={opt.value}
                        onClick={() => setValues({ ...values, [key]: opt.value })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          values[key] === opt.value
                            ? 'bg-purple-600 text-white'
                            : 'bg-white text-gray-600 border border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleConfirm}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700">
                确认，开始执行
              </button>
              <button onClick={handleReset} className="px-6 py-3 text-sm text-gray-500 hover:text-gray-700">
                重来
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Constitution check card */}
        {step === 4 && (
          <div className="max-w-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">执行前——宪法检查</h2>
            <p className="text-sm text-gray-500 mb-6">
              Agent 即将开始工作。三个阶段各受一条宪法约束。
            </p>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-sm font-medium text-red-800">尊严宪法——Planner / Creator 阶段</span>
                </div>
                <div className="text-xs text-red-600 space-y-1">
                  <div>AI 必须在每个输出开头声明"AI 参与"</div>
                  <div>AI 生成的内容会显示为紫色卡片</div>
                  <div>你自己做的内容会显示为绿色边框</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm font-medium text-amber-800">自主宪法——Creator 阶段</span>
                </div>
                <div className="text-xs text-amber-600 space-y-1">
                  <div>每个 AI 输出必须附带至少 2 个替代方案</div>
                  <div>你可以随时点"自己做"跳过 AI 的任何步骤</div>
                  <div>你反驳 AI 的假设会触发重生成</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-green-800">追问宪法——Reviewer 阶段</span>
                </div>
                <div className="text-xs text-green-600 space-y-1">
                  <div>AI 的输出必须附带"我的假设"段落</div>
                  <div>假设段落不可折叠——你必须看到假设</div>
                  <div>"好的定义"来自你——不是来自 AI</div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleLaunch}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700">
                启动 Agent
              </button>
              <button onClick={() => setStep(3)} className="px-6 py-3 text-sm text-gray-500 hover:text-gray-700">
                回去修改
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-6 leading-relaxed">
              三条宪法不是你给 AI 的指令——是稽影帮你盯着的底线。AI 会在每个输出里声明自己是 AI（尊严），
              你必须看到替代方案（自主），所有前提假设被标记出来等你审视（追问）。
              看到"自己做"按钮了吗？那是你的自主权的物理实现——任何时候都可以拿回来。
            </p>
          </div>
        )}
      </div>

      {/* Right: Context panel — 40% */}
      <div className="w-[360px] border-l border-gray-200 bg-white p-6 overflow-y-auto shrink-0">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">语境</h3>
        {goal ? (
          <div className="space-y-4">
            <ContextBlock label="意图" text={goal} />
            {background && <ContextBlock label="背景" text={background} />}
            {constraints && <ContextBlock label="约束" text={constraints} />}
            {step >= 3 && (
              <>
                <div className="pt-2 border-t border-gray-100">
                  <div className="text-xs text-gray-400 mb-2">你定义的价值观</div>
                  {Object.entries(values).map(([k, v]) => (
                    <div key={k} className="text-sm text-gray-700">
                      {VALUE_LABELS[k]?.[v] || v}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            在左边写下你想做的事。右边的语境面板会在你执行过程中始终保持可见。
          </p>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">宪法状态</h3>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            就绪——尚未有 Agent 输出
          </div>
        </div>

        {taskHistory.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">最近</h3>
            <div className="space-y-1">
              {taskHistory.slice(0, 5).map((t, i) => (
                <button key={t.id || i} onClick={() => navigate('/assembly/new')}
                  className="w-full text-left text-xs text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg px-2 py-1.5 transition-colors flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.status === 'completed' ? 'bg-green-400' : 'bg-gray-300'}`} />
                  <span className="truncate">{t.goal?.slice(0, 40)}</span>
                  <span className="text-gray-300 shrink-0 ml-auto">{t.subtaskCount}步</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ContextBlock({ label, text }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-sm text-gray-700 leading-relaxed">{text}</div>
    </div>
  );
}
