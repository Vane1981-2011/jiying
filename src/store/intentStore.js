import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 意图规格书 Store
 *
 * 管理用户的任务意图、溯源追问结果、价值观映射。
 * 持久化到 localStorage（草稿自动保存）。
 */
export const useIntentStore = create(
  persist(
    (set, get) => ({
      /** 意图规格书 */
      intent: {
        goal: '',
        background: '',
        constraints: '',
        successCriteria: '',
        simpleMode: false,
      },

      /** 更新意图字段 */
      setIntent: (field, value) =>
        set((s) => ({ intent: { ...s.intent, [field]: value } })),

      /** 溯源追问 */
      trace: {
        serves: '',
        definedGood: '',
        alternative: '',
        skipped: false,
      },

      /** 更新溯源字段 */
      setTrace: (field, value) =>
        set((s) => ({ trace: { ...s.trace, [field]: value } })),

      /** 跳过溯源追问 */
      skipTrace: () =>
        set((s) => ({
          trace: { ...s.trace, skipped: true },
          status: 'valued', // 跳过溯源后直接进入价值观步骤
        })),

      /** 价值观映射 */
      values: {
        speed: 'speed', // speed | accuracy | depth
        coverage: 'coverage', // coverage | focus | key_points
        novelty: 'novelty', // novelty | feasibility | reliability
      },

      /** 更新价值观 */
      setValue: (key, value) =>
        set((s) => ({ values: { ...s.values, [key]: value } })),

      /** 当前意图状态 */
      status: 'draft', // draft | traced | valued | confirmed

      setStatus: (status) => set({ status }),

      /** 重置意图 */
      reset: () =>
        set({
          intent: { goal: '', background: '', constraints: '', successCriteria: '', simpleMode: false },
          trace: { serves: '', definedGood: '', alternative: '', skipped: false },
          values: { speed: 'speed', coverage: 'coverage', novelty: 'novelty' },
          status: 'draft',
        }),
    }),
    {
      name: 'jiying-intent',
    },
  ),
);
