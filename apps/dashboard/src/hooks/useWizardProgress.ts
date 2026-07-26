import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface WizardSession {
    id: string; // UUID
    type: 'worker' | 'brand';
    name: string; // e.g. "Phone A (S20)", "Funny Shorts Ch"
    startDate: string; // ISO Date
    lastUpdated: string; // ISO Date (To track incubation time)
    currentDay: number;
    totalDays: number;
    completedTasks: string[]; // IDs of checked tasks for the current day
    status: 'active' | 'completed';
    // specific fields
    workerEmail?: string;
    channelName?: string;
}

interface WizardState {
    sessions: WizardSession[];
    createSession: (type: 'worker' | 'brand', name: string) => string;
    updateSession: (id: string, data: Partial<WizardSession>) => void;
    deleteSession: (id: string) => void;
    getSession: (id: string) => WizardSession | undefined;
    toggleTask: (sessionId: string, taskId: string, isChecked: boolean) => void;
    completeDay: (sessionId: string) => void;
}

export const useWizardProgress = create<WizardState>()(
    persist(
        (set, get) => ({
            sessions: [],

            createSession: (type, name) => {
                const newSession: WizardSession = {
                    id: uuidv4(),
                    type,
                    name,
                    startDate: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    currentDay: 1,
                    totalDays: type === 'worker' ? 4 : 7,
                    completedTasks: [],
                    status: 'active',
                };
                set((state) => ({ sessions: [...state.sessions, newSession] }));
                return newSession.id;
            },

            updateSession: (id, data) => {
                set((state) => ({
                    sessions: state.sessions.map((session) =>
                        session.id === id
                            ? { ...session, ...data, lastUpdated: new Date().toISOString() }
                            : session
                    ),
                }));
            },

            deleteSession: (id) => {
                set((state) => ({
                    sessions: state.sessions.filter((session) => session.id !== id),
                }));
            },

            getSession: (id) => {
                return get().sessions.find((s) => s.id === id);
            },

            toggleTask: (sessionId, taskId, isChecked) => {
                set((state) => ({
                    sessions: state.sessions.map((session) => {
                        if (session.id !== sessionId) return session;

                        const currentTasks = session.completedTasks;
                        let newTasks;
                        if (isChecked) {
                            newTasks = [...currentTasks, taskId];
                        } else {
                            newTasks = currentTasks.filter((id) => id !== taskId);
                        }

                        return {
                            ...session,
                            completedTasks: newTasks,
                            lastUpdated: new Date().toISOString(),
                        };
                    }),
                }));
            },

            completeDay: (sessionId) => {
                set((state) => ({
                    sessions: state.sessions.map((session) => {
                        if (session.id !== sessionId) return session;

                        const nextDay = session.currentDay + 1;
                        if (nextDay > session.totalDays) {
                            return {
                                ...session,
                                currentDay: session.totalDays,
                                status: 'completed',
                                lastUpdated: new Date().toISOString(),
                            };
                        }

                        return {
                            ...session,
                            currentDay: nextDay,
                            completedTasks: [], // Reset tasks for new day
                            lastUpdated: new Date().toISOString(),
                        };
                    }),
                }));
            },
        }),
        {
            name: 'wizard_sessions_v1', // localStorage key
        }
    )
);
