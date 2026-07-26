import { create } from 'zustand';

export interface LogEntry {
  type: 'user' | 'agent';
  text: string;
  time: Date;
}

interface SwarmState {
  agentLogs: LogEntry[];
  isConnected: boolean;
  isThinking: boolean;
  activeSkillPerAgent: Record<string, string>;
  currentStage: number;
  addLog: (log: LogEntry) => void;
  setIsConnected: (status: boolean) => void;
  setIsThinking: (status: boolean) => void;
  setActiveSkill: (agentRole: string, skillName: string | null) => void;
  setCurrentStage: (stage: number) => void;
  clearLogs: () => void;
}

export const useSwarmStore = create<SwarmState>((set) => ({
  agentLogs: [],
  isConnected: false,
  isThinking: false,
  activeSkillPerAgent: {},
  currentStage: 0,
  addLog: (log) => set((state) => ({ agentLogs: [...state.agentLogs, log] })),
  setIsConnected: (status) => set({ isConnected: status }),
  setIsThinking: (status) => set({ isThinking: status }),
  setActiveSkill: (agentRole, skillName) => set((state) => ({
    activeSkillPerAgent: {
      ...state.activeSkillPerAgent,
      [agentRole]: skillName || ""
    }
  })),
  setCurrentStage: (stage) => set({ currentStage: stage }),
  clearLogs: () => set({ agentLogs: [], activeSkillPerAgent: {} })
}));
