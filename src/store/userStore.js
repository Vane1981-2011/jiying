import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 用户偏好 Store
 *
 * 存储用户设置和本地状态。持久化到 localStorage。
 * 守护进程和编排引擎都可以读取此 store。
 */
export const useUserStore = create(
  persist(
    (set, get) => ({
      /** DeepSeek API Key（用户自带，存在本地） */
      apiKey: '',

      /** 设置 API Key */
      setApiKey: (key) => set({ apiKey: key }),

      /** 清除 API Key */
      clearApiKey: () => set({ apiKey: '' }),

      /** 模型提供商：'deepseek' | 'custom'（兼容 OpenAI 接口） */
      modelProvider: 'deepseek',

      /** 设置模型提供商 */
      setModelProvider: (provider) => set({ modelProvider: provider }),

      /** 自定义 API Base URL（modelProvider='custom' 时使用） */
      customBaseURL: '',

      /** 设置自定义 Base URL */
      setCustomBaseURL: (url) => set({ customBaseURL: url }),

      /** 模型名称 */
      modelName: 'deepseek-v4-pro',

      /** 设置模型名称 */
      setModelName: (name) => set({ modelName: name }),

      /** 不舒服模式——默认关闭（老板决定 2026-07-12） */
      uncomfortableMode: false,

      /** 切换不舒服模式 */
      toggleUncomfortableMode: () =>
        set((s) => ({ uncomfortableMode: !s.uncomfortableMode })),

      /** Shell 执行总开关——默认关闭（v0.3 上线） */
      shellEnabled: false,

      /** 切换 Shell 执行 */
      toggleShellEnabled: () => set((s) => ({ shellEnabled: !s.shellEnabled })),

      /** 完全访问（信任模式）——默认关闭 */
      shellFullAccess: false,

      /** 切换完全访问 */
      toggleShellFullAccess: () =>
        set((s) => ({ shellFullAccess: !s.shellFullAccess })),

      /** Shell 白名单——完全访问模式下自动执行的命令 */
      shellWhitelist: [],

      /** 添加命令到白名单 */
      addToWhitelist: (cmd) =>
        set((s) => ({
          shellWhitelist: s.shellWhitelist.includes(cmd)
            ? s.shellWhitelist
            : [...s.shellWhitelist, cmd],
        })),

      /** 从白名单移除 */
      removeFromWhitelist: (cmd) =>
        set((s) => ({
          shellWhitelist: s.shellWhitelist.filter((c) => c !== cmd),
        })),
    }),
    {
      name: 'jiying-user',
      partialize: (state) => ({
        apiKey: state.apiKey,
        modelProvider: state.modelProvider,
        customBaseURL: state.customBaseURL,
        modelName: state.modelName,
        uncomfortableMode: state.uncomfortableMode,
        shellEnabled: state.shellEnabled,
        shellFullAccess: state.shellFullAccess,
        shellWhitelist: state.shellWhitelist,
      }),
    },
  ),
);
