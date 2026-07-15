import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initGuardian, shutdown, getMetricDriftReport } from './index';
import { useGuardianStore } from '../store/guardianStore';

// 创建一个最小化的 Zustand-like store 用于测试
function createTestStore(initialState = { agentOutputs: [] }) {
  const listeners = new Set();
  let state = { ...initialState };

  return {
    getState: () => state,
    setState: (update) => {
      const next = typeof update === 'function' ? update(state) : update;
      state = next;
      listeners.forEach((fn) => fn(next));
    },
    subscribe: (listener) => {
      const wrapped = (s) => listener(s, state);
      listeners.add(wrapped);
      return () => listeners.delete(wrapped);
    },
    appendOutput: (output) => {
      const prev = state.agentOutputs;
      const next = { ...state, agentOutputs: [...prev, output] };
      state = next;
      listeners.forEach((fn) => fn(next));
    },
  };
}

describe('守护进程', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
    useGuardianStore.getState().clearAlerts();
  });

  afterEach(() => {
    shutdown();
  });

  it('检测尊严违反：Agent 输出缺少 AI 身份声明', () => {
    const unsub = initGuardian(store);

    store.appendOutput({
      agent: 'creator',
      output: '这是没有身份声明的普通文本输出。',
      filtered: false,
      constitution: null,
    });

    const alerts = useGuardianStore.getState().alerts;
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    const alert = alerts[0];
    expect(alert.type).toBe('violation');
    expect(alert.agent).toBe('creator');
    expect(alert.violations.some((v) => v.rule === 'dignity')).toBe(true);
    unsub();
  });

  it('检测自主违反：输出缺少替代方案', () => {
    const unsub = initGuardian(store);

    store.appendOutput({
      agent: 'creator',
      output: 'AI 生成：单一方案输出。',
      filtered: false,
    });

    const alerts = useGuardianStore.getState().alerts;
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].violations.some((v) => v.rule === 'autonomy')).toBe(true);
    unsub();
  });

  it('检测追问违反：输出缺少假设段落', () => {
    const unsub = initGuardian(store);

    store.appendOutput({
      agent: 'creator',
      output: 'AI 生成：替代方案A。\n替代方案B。\n没有假设段落。',
      filtered: false,
    });

    const alerts = useGuardianStore.getState().alerts;
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].violations.some((v) => v.rule === 'questioning')).toBe(true);
    unsub();
  });

  it('全部通过时不触发事件', () => {
    const unsub = initGuardian(store);

    store.appendOutput({
      agent: 'creator',
      output: 'AI 生成：完美的输出。\n替代方案A。\n替代方案B。\n我的假设：1. 我假设目标受众是产品经理。',
      filtered: false,
    });

    const alerts = useGuardianStore.getState().alerts;
    expect(alerts).toHaveLength(0);
    unsub();
  });

  it('initGuardian 在 store 不可用时安全返回', () => {
    const unsub = initGuardian(null);
    expect(typeof unsub).toBe('function');
    unsub(); // 不抛异常
  });
});
