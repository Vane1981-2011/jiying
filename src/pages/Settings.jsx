import { useUserStore } from '../store/userStore';

const MODEL_PRESETS = [
  { value: 'deepseek', label: 'DeepSeek', model: 'deepseek-v4-pro' },
  { value: 'custom', label: '自定义（OpenAI 兼容）', model: 'gpt-4o' },
];

export default function Settings() {
  const {
    apiKey, setApiKey, clearApiKey,
    modelProvider, setModelProvider,
    customBaseURL, setCustomBaseURL,
    modelName, setModelName,
    uncomfortableMode, toggleUncomfortableMode,
    shellEnabled, toggleShellEnabled,
    shellFullAccess, toggleShellFullAccess,
    shellWhitelist, addToWhitelist, removeFromWhitelist,
  } = useUserStore();

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">设置</h1>

      {/* API Key */}
      <section className="mb-8 p-6 bg-white rounded-xl border border-gray-200">
        <h2 className="text-base font-medium text-gray-900 mb-2">DeepSeek API Key</h2>
        <p className="text-sm text-gray-500 mb-4">
          你的 API Key 仅在本地存储，直连 DeepSeek API。我方服务器不会接触到你的 Key 或 AI 对话内容。
        </p>
        <div className="flex gap-3">
          <input
            type="password"
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          {apiKey && (
            <button
              onClick={clearApiKey}
              className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              清除
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          没有 API Key？前往{' '}
          <a
            href="https://platform.deepseek.com/api_keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:underline"
          >
            DeepSeek 开放平台
          </a>{' '}
          获取。
        </p>
      </section>

      {/* 模型选择 */}
      <section className="mb-8 p-6 bg-white rounded-xl border border-gray-200">
        <h2 className="text-base font-medium text-gray-900 mb-2">AI 模型</h2>
        <p className="text-sm text-gray-500 mb-4">
          选择 AI 服务提供商和模型。DeepSeek 是默认推荐，也支持任何兼容 OpenAI 接口的服务。
        </p>
        <div className="flex gap-2 mb-4">
          {MODEL_PRESETS.map((p) => (
            <button key={p.value} onClick={() => { setModelProvider(p.value); if (p.value !== 'custom') setModelName(p.model); }}
              className={`text-xs px-4 py-2 rounded-lg border transition-colors ${
                modelProvider === p.value
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {modelProvider === 'custom' && (
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">API Base URL</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs
                           focus:outline-none focus:ring-1 focus:ring-purple-400"
                placeholder="https://api.openai.com/v1"
                value={customBaseURL}
                onChange={(e) => setCustomBaseURL(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">模型名称</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs
                           focus:outline-none focus:ring-1 focus:ring-purple-400"
                placeholder="gpt-4o"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
              />
            </div>
          </div>
        )}
        {modelProvider !== 'custom' && (
          <div className="text-xs text-gray-400 pt-2">当前模型：{modelName}</div>
        )}
      </section>

      {/* 不舒服模式 */}
      <section className="mb-8 p-6 bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium text-gray-900">不舒服模式</h2>
            <p className="text-sm text-gray-500 mt-1">
              开启后，审查 Agent 会更严格——不只检查事实，还会检查逻辑谬误和确认偏误。
              黄色标记会变多，但这正是你想要的挑战。
            </p>
          </div>
          <button
            onClick={toggleUncomfortableMode}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              uncomfortableMode ? 'bg-purple-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                uncomfortableMode ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Shell 执行 */}
      <section className="mb-8 p-6 bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-medium text-gray-900">
              Shell 执行
              <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                v0.3
              </span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              允许 Agent 在沙箱中执行 Shell 命令（如数据分析、文件处理）。
              所有命令默认需要手动确认。
            </p>
          </div>
          <button
            onClick={toggleShellEnabled}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              shellEnabled ? 'bg-purple-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                shellEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {shellEnabled && (
          <>
            {/* 完全访问 */}
            <div className="flex items-center justify-between py-3 border-t border-gray-100">
              <div>
                <h3 className="text-sm font-medium text-gray-800">完全访问（信任模式）</h3>
                <p className="text-xs text-gray-500">
                  白名单命令自动执行，不再逐条确认。破坏性命令不受影响。
                </p>
              </div>
              <button
                onClick={toggleShellFullAccess}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  shellFullAccess ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    shellFullAccess ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* 白名单 */}
            {shellFullAccess && (
              <div className="py-3 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-800 mb-2">命令白名单</h3>
                <div className="flex flex-wrap gap-2">
                  {shellWhitelist.map((cmd) => (
                    <span
                      key={cmd}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700
                                 rounded-full text-xs cursor-pointer hover:bg-red-50 hover:text-red-600"
                      onClick={() => removeFromWhitelist(cmd)}
                      title="点击移除"
                    >
                      {cmd} ×
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <input
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs
                               focus:outline-none focus:ring-1 focus:ring-purple-400"
                    placeholder="添加命令（如 cat、python）"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addToWhitelist(e.target.value.trim());
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-4 p-3 bg-amber-50 rounded-lg text-xs text-amber-800">
          高风险命令（rm、sudo、chmod、kill 等）永远被宪法拦截——不受任何开关控制。
        </div>
      </section>
    </div>
  );
}
