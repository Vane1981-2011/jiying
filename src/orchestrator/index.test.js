import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const { mockPlanner, mockResearcher, mockCreator, mockReviewer } = vi.hoisted(() => ({
  mockPlanner: vi.fn(),
  mockResearcher: vi.fn(),
  mockCreator: vi.fn(),
  mockReviewer: vi.fn(),
}));

vi.mock('../agents/planner', () => ({ runPlanner: mockPlanner }));
vi.mock('../agents/researcher', () => ({ runResearcher: mockResearcher }));
vi.mock('../agents/creator', () => ({ runCreator: mockCreator }));
vi.mock('../agents/reviewer', () => ({ runReviewer: mockReviewer }));

// Mock Zustand store
const storeState = {
  reset: vi.fn(),
  setStatus: vi.fn(),
  setCurrentStep: vi.fn(),
  setTotalSteps: vi.fn(),
  appendOutput: vi.fn(),
  setError: vi.fn(),
  setResult: vi.fn(),
  addTaskHistory: vi.fn(),
};
vi.mock('../store/agentStore', () => ({
  useAgentStore: {
    getState: () => storeState,
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock('../store/userStore', () => ({
  useUserStore: {
    getState: () => ({
      modelProvider: 'deepseek',
      customBaseURL: '',
      modelName: 'deepseek-chat',
      uncomfortableMode: false,
    }),
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock('../guardian', () => ({
  initGuardian: vi.fn(() => () => {}),
}));

vi.mock('../knowledge/manager', () => ({
  KnowledgeBase: {
    getContext: vi.fn().mockResolvedValue(null),
    search: vi.fn().mockResolvedValue([]),
  },
}));

describe('Orchestrator', () => {
  let orchestrate;

  beforeAll(async () => {
    orchestrate = (await import('./index')).orchestrate;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultDeps = {
    apiKey: 'test-key',
    intent: { goal: '分析市场' },
    trace: { serves: 'CEO', definedGood: '有洞察力', alternative: '', skipped: false },
    values: { speed: 'depth', coverage: 'coverage', novelty: 'novelty' },
  };

  it('成功运行完整流水线', async () => {
    mockPlanner.mockResolvedValueOnce({
      subtasks: [
        { id: 1, title: '收集数据', goal: '收集市场数据', dependsOn: [] },
        { id: 2, title: '分析数据', goal: '分析趋势', dependsOn: [1] },
      ],
      reasoning: '分两步：先收集再分析',
      constitution: { status: 'pass' },
      rawText: '...',
    });
    mockResearcher.mockResolvedValueOnce({
      content: '调研结果', constitution: { status: 'pass' }, rawText: '...', sourceStats: { primary: 1, secondary: 0, inferred: 0 },
    });
    mockResearcher.mockResolvedValueOnce({
      content: '调研结果2', constitution: { status: 'pass' }, rawText: '...', sourceStats: { primary: 0, secondary: 1, inferred: 0 },
    });
    mockCreator.mockResolvedValueOnce({
      content: '生成内容1', assumptions: '我的假设：...', constitution: { status: 'pass' }, rawText: '...',
    });
    mockCreator.mockResolvedValueOnce({
      content: '生成内容2', assumptions: '我的假设：...', constitution: { status: 'pass' }, rawText: '...',
    });
    mockReviewer.mockResolvedValueOnce({
      scores: { accuracy: 5 }, overall: 5, verdict: 'pass', strictMode: false,
    });

    const result = await orchestrate(defaultDeps);

    expect(result.status).toBe('completed');
    expect(result.creatorResults).toHaveLength(2);
    expect(result.plan.subtasks).toHaveLength(2);
    expect(mockPlanner).toHaveBeenCalledTimes(1);
    expect(mockCreator).toHaveBeenCalledTimes(2);
    expect(mockReviewer).toHaveBeenCalledTimes(1);
  });

  it('Planner 失败时抛出错误', async () => {
    mockPlanner.mockRejectedValueOnce(new Error('API 超时'));

    await expect(orchestrate(defaultDeps)).rejects.toThrow('API 超时');
    expect(storeState.setError).toHaveBeenCalledWith('API 超时');
  });

  it('跳过被标记的步骤时不调用 Creator', async () => {
    mockPlanner.mockResolvedValueOnce({
      subtasks: [{ id: 1, title: '任务', goal: '目标', dependsOn: [] }],
      reasoning: '一个任务',
      constitution: { status: 'pass' },
      rawText: '...',
    });
    mockResearcher.mockResolvedValueOnce({
      content: '', constitution: { status: 'pass' }, rawText: '', sourceStats: { primary: 0, secondary: 0, inferred: 0 },
    });
    mockCreator.mockResolvedValueOnce({
      content: '', assumptions: '', constitution: { status: 'pass' }, rawText: '', skipped: true,
    });
    mockReviewer.mockResolvedValueOnce({
      scores: {}, overall: 3, verdict: 'pass', strictMode: false,
    });

    const result = await orchestrate({
      ...defaultDeps,
      options: { withResearch: false, skipSteps: [1] },
    });

    expect(result.creatorResults[0].skipped).toBe(true);
  });

  it('关闭 Research 时不调用 Researcher', async () => {
    mockPlanner.mockResolvedValueOnce({
      subtasks: [{ id: 1, title: '任务', goal: '目标', dependsOn: [] }],
      reasoning: '一个任务',
      constitution: { status: 'pass' },
      rawText: '...',
    });
    mockCreator.mockResolvedValueOnce({
      content: '内容', assumptions: '', constitution: { status: 'pass' }, rawText: '...',
    });
    mockReviewer.mockResolvedValueOnce({
      scores: {}, overall: 3, verdict: 'pass', strictMode: false,
    });

    await orchestrate({
      ...defaultDeps,
      options: { withResearch: false },
    });

    expect(mockResearcher).not.toHaveBeenCalled();
  });
});
