import { useState, useEffect } from 'react';

const STORAGE_KEY = 'jiying-reflect';

export default function PauseReflect() {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setText(stored);
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, text);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">
        暂停—反思
      </h1>
      <p className="text-gray-500 mb-2">
        你最近在用这个系统做什么？这些事值得做吗？
      </p>
      <p className="text-sm text-purple-600 mb-8">
        还有什么事是你想做但一直没开始的？
      </p>

      <textarea
        className="w-full h-64 p-5 border border-gray-200 rounded-xl resize-none
                   focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent
                   text-gray-800 text-sm leading-relaxed"
        placeholder="在这里写下你的想法。这些内容不会被优化，也不会被用来推荐任何东西。"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-gray-400">
          这个空间存在的唯一理由：在效率之外，保留一个追问意义的角落。
          <br />
          你的回答不进入任何飞轮——不被优化、不被分析、不被推荐。
        </p>
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium
                     hover:bg-gray-700 transition-colors"
        >
          {saved ? '已保存' : '保存'}
        </button>
      </div>
    </div>
  );
}
