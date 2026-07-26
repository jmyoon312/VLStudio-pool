import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAgentStore = create(
  persist(
    (set, get) => ({
      // Agent Copilot Chat History
      chatHistory: [],
      addChatMessage: (msg) => set((state) => ({ chatHistory: [...state.chatHistory, msg] })),
      
      // Storyboard Scenes
      // Array of { id, mediaId, status (pending|done|error), type, previewUrl, prompt }
      scenes: [],
      addScenes: (newScenes) => set((state) => ({ scenes: [...state.scenes, ...newScenes] })),
      updateScene: (id, updates) => set((state) => ({
        scenes: state.scenes.map(s => s.id === id ? { ...s, ...updates } : s)
      })),
      removeScene: (id) => set((state) => ({
        scenes: state.scenes.filter(s => s.id !== id)
      })),
      reorderScenes: (newScenes) => set({ scenes: newScenes }),
      
      // Context Manager (Assets & Personas)
      // Array of { id, type (image|character), file, prompt, isActive }
      contexts: [],
      addContext: (ctx) => set((state) => ({ contexts: [...state.contexts, ctx] })),
      toggleContext: (id) => set((state) => ({
        contexts: state.contexts.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c)
      })),
      removeContext: (id) => set((state) => ({
        contexts: state.contexts.filter(c => c.id !== id)
      })),
      updateContext: (id, updates) => set((state) => ({
        contexts: state.contexts.map(c => c.id === id ? { ...c, ...updates } : c)
      })),

      // Chapters for Massive Scripts (Phase 5.2)
      // Array of { id, title, status, summary }
      chapters: [],
      setChapters: (chapters) => set({ chapters }),
      updateChapter: (id, updates) => set((state) => ({
        chapters: state.chapters.map(c => c.id === id ? { ...c, ...updates } : c)
      })),

      // UI State
      isAgentMode: true,
      toggleAgentMode: () => set((state) => ({ isAgentMode: !state.isAgentMode })),
      
      selectedModel: 'omni_flash', // 'omni_flash' (10s) or 'veo_3_1' (8s)
      setSelectedModel: (model) => set({ selectedModel: model }),
      
      resetStore: () => set({
        chatHistory: [],
        scenes: [],
        chapters: []
      })
    }),
    {
      name: 'agent-studio-storage-v3', // Changed to force reset after UI push-up bug
      // We don't persist 'contexts' if they contain File objects, but it's okay, 
      // they will just be plain objects. For now, we persist everything.
    }
  )
);
