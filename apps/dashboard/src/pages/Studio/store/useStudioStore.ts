import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type LayerType = 'image' | 'video' | 'text' | 'widget';

export interface StudioLayer {
    id: string;
    type: LayerType;
    x: number;
    y: number;
    width?: number;
    height?: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    videoSrc?: string; // Optional real video source for 'video' types
    loop?: boolean;
    muted?: boolean;

    // Media props
    src?: string;
    filePath?: string; // Absolute path on server (for headless streaming)

    // Text props
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    textAlign?: 'left' | 'center' | 'right';
    animation?: 'none' | 'fade' | 'typewriter';
    fill?: string;

    // Widget props
    widgetType?: 'chat' | 'alert';

    zIndex: number;
}

interface StudioState {
    layers: StudioLayer[];
    selectedId: string | null;

    // Actions
    addLayer: (layer: Omit<StudioLayer, 'id' | 'zIndex'>) => void;
    updateLayer: (id: string, attrs: Partial<StudioLayer>) => void;
    removeLayer: (id: string) => void;
    selectLayer: (id: string | null) => void;
    reorderLayer: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
    setLayers: (layers: StudioLayer[]) => void;

    // Stream Settings Actions
    streamSettings: StreamSettings;
    activeChannelIds: string[]; // Track which channels are currently streaming
    setStreamSettings: (settings: Partial<StreamSettings>) => void;
    addActiveChannel: (channelId: string) => void;
    removeActiveChannel: (channelId: string) => void;
    // Recipe & Specialized State
    currentRecipe: 'lofi' | 'talk' | 'webinar' | 'custom' | null;
    setRecipe: (recipe: 'lofi' | 'talk' | 'webinar' | 'custom' | null) => void;

    // Lofi Specific
    lofiPlaylist: { id: string; title: string; src: string; duration: number; filePath?: string }[];
    playbackOrder: 'sequential' | 'random' | 'reverse';
    setPlaybackOrder: (order: 'sequential' | 'random' | 'reverse') => void;
    addToPlaylist: (track: { id: string; title: string; src: string; duration: number; filePath?: string }) => void;
    setPlaylist: (tracks: { id: string; title: string; src: string; duration: number; filePath?: string }[]) => void;
    removeFromPlaylist: (id: string) => void;

    // Talk/Webinar Specific
    guests: { id: string; name: string; hasCam: boolean; hasMic: boolean }[];
    addGuest: (guest: { id: string; name: string }) => void;

}
// Initial state helpers (omitted for brevity, implemented in create below)

export interface StreamSettings {
    rtmpUrl: string;
    streamKey: string;
    selectedChannelIds: string[]; // Changed from single string
}

export const useStudioStore = create<StudioState>((set) => ({
    layers: [],
    selectedId: null,

    addLayer: (layer) => set((state) => {
        const newLayer: StudioLayer = {
            ...layer,
            id: uuidv4(),
            zIndex: state.layers.length + 1,
        };
        return {
            layers: [...state.layers, newLayer],
            selectedId: newLayer.id
        };
    }),

    updateLayer: (id, attrs) => set((state) => ({
        layers: state.layers.map((l) =>
            l.id === id ? { ...l, ...attrs } : l
        ),
    })),

    removeLayer: (id) => set((state) => ({
        layers: state.layers.filter((l) => l.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
    })),

    selectLayer: (id) => set({ selectedId: id }),

    reorderLayer: (id, direction) => set((state) => {
        // Basic placeholder logic for zIndex reordering 
        // (For now just a stub, real implementation involves sorting array)
        return { layers: state.layers };
    }),

    setLayers: (layers) => set({ layers, selectedId: null }),

    // Recipe Actions
    currentRecipe: null,
    setRecipe: (recipe) => set({ currentRecipe: recipe }),

    // Lofi Actions
    lofiPlaylist: [],
    playbackOrder: 'sequential',
    setPlaybackOrder: (order) => set({ playbackOrder: order }),
    addToPlaylist: (track) => set((state) => ({ lofiPlaylist: [...state.lofiPlaylist, track] })),
    setPlaylist: (tracks) => set({ lofiPlaylist: tracks }),
    removeFromPlaylist: (id) => set((state) => ({ lofiPlaylist: state.lofiPlaylist.filter(t => t.id !== id) })),

    // Guest Actions
    guests: [],
    addGuest: (guest) => set((state) => ({ guests: [...state.guests, { ...guest, hasCam: true, hasMic: true }] })),

    // Stream Settings Actions
    streamSettings: {
        rtmpUrl: '',
        streamKey: '',
        selectedChannelIds: [], // Initialized as empty array
    },
    activeChannelIds: [],
    setStreamSettings: (settings) => set((state) => ({ streamSettings: { ...state.streamSettings, ...settings } })),
    addActiveChannel: (id: string) => set((state) => ({ activeChannelIds: [...state.activeChannelIds, id] })),
    removeActiveChannel: (id: string) => set((state) => ({ activeChannelIds: state.activeChannelIds.filter(c => c !== id) })),
}));
