import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSkillsStore = create(
  persist(
    (set, get) => ({
      installed: [],
      enabled: [],
      customSkills: [],

      install: (skillId) =>
        set((s) => ({
          installed: s.installed.includes(skillId) ? s.installed : [...s.installed, skillId],
          enabled: s.enabled.includes(skillId) ? s.enabled : [...s.enabled, skillId],
        })),

      uninstall: (skillId) =>
        set((s) => ({
          installed: s.installed.filter((id) => id !== skillId),
          enabled: s.enabled.filter((id) => id !== skillId),
          customSkills: s.customSkills.filter((sk) => sk.id !== skillId),
        })),

      toggleEnabled: (skillId) =>
        set((s) => ({
          enabled: s.enabled.includes(skillId)
            ? s.enabled.filter((id) => id !== skillId)
            : [...s.enabled, skillId],
        })),

      addCustomSkill: (skill) =>
        set((s) => ({
          customSkills: [...s.customSkills.filter((sk) => sk.id !== skill.id), skill],
          installed: [...s.installed, skill.id],
          enabled: [...s.enabled, skill.id],
        })),

      isInstalled: (skillId) => get().installed.includes(skillId),
      isEnabled: (skillId) => get().enabled.includes(skillId),
    }),
    { name: 'jiying-skills' },
  ),
);
