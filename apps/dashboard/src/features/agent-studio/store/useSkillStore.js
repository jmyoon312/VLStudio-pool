import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import defaultSkills from '../../../../../api/app/data/prompt_skills.json';

export const useSkillStore = create(
  persist(
    (set, get) => ({
      skills: defaultSkills,
      
      // 사용자 정의 채널/브랜드 스타일 (Vibe)
      brandPersona: {
        active: false,
        vibe: '', // 예: "유튜브 Shorts 감성의 빠르고 화려한 스타일", "잔잔한 다큐멘터리 분위기"
      },

      setBrandPersona: (vibe) => set({
        brandPersona: { active: true, vibe }
      }),
      
      toggleBrandPersona: () => set((state) => ({
        brandPersona: { ...state.brandPersona, active: !state.brandPersona.active }
      })),

      addCustomSkill: (skill) => set((state) => ({
        skills: [...state.skills, { ...skill, id: `custom_${Date.now()}` }]
      })),
      
      removeSkill: (id) => set((state) => ({
        skills: state.skills.filter(s => s.id !== id)
      })),

      updateSkill: (id, updates) => set((state) => ({
        skills: state.skills.map(s => s.id === id ? { ...s, ...updates } : s)
      })),
      
      resetToDefault: () => set({ skills: defaultSkills })
    }),
    {
      name: 'agent-skill-storage',
    }
  )
);
