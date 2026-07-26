import { create } from 'zustand';
import { temporal } from 'zundo';
import { v4 as uuidv4 } from 'uuid';

export type TrackItemType = 'video' | 'audio' | 'text' | 'image' | 'effect' | 'transition';

export interface TransformState {
    x: number;
    y: number;
    scale: number;
    rotation: number;
    opacity: number;
}

export interface TrackItem {
    id: string;
    trackId: string;
    type: TrackItemType;
    source: string; // URL, Base64, or text string
    startTime: number; // Position on timeline (ms)
    duration: number; // Length on timeline (ms)
    offset: number; // Trim start (ms from beginning of source media)
    sourceDuration: number; // Original length of the media (ms)
    layer: number; // Z-index stacking
    name: string;
    transform: TransformState;
    properties: Record<string, any>; // volume, font, text-align, etc.
}

export interface Track {
    id: string;
    type: 'main' | 'overlay' | 'audio' | 'text';
    name: string;
    isMuted: boolean;
    isHidden: boolean;
    isLocked: boolean;
    volume: number;
}

export interface EditorState {
    // Project Metadata
    projectId: string;
    fps: number;
    width: number;
    height: number;
    duration: number; // Total project duration in ms

    // Composition State
    tracks: Track[];
    items: Record<string, TrackItem>;

    // Playback State (Not stored in history)
    playhead: number;
    isPlaying: boolean;
    zoom: number; // pixels per millisecond

    // Selection State
    selectedItemIds: string[];
    activeTrackId: string | null;

    // Actions
    setPlayhead: (time: number) => void;
    togglePlay: () => void;
    setZoom: (zoom: number) => void;
    
    // Track Management
    addTrack: (trackData?: Partial<Track>) => void;
    removeTrack: (trackId: string) => void;
    updateTrack: (trackId: string, updates: Partial<Track>) => void;

    // Item Management
    addItem: (item: Omit<TrackItem, 'id'>) => string;
    updateItem: (itemId: string, updates: Partial<TrackItem>) => void;
    deleteItems: (itemIds: string[]) => void;
    splitItem: (itemId: string, splitTime: number) => void;
    
    // Selection
    setSelection: (itemIds: string[]) => void;
    
    // Editor State
    setProjectConfig: (config: Partial<Pick<EditorState, 'fps' | 'width' | 'height' | 'duration'>>) => void;
}

export const useEditorStore = create<EditorState>()(
    temporal((set, get) => ({
        projectId: uuidv4(),
        fps: 30,
        width: 1080,
        height: 1920,
        duration: 60000, // 1 minute default
        
        tracks: [
            { id: 'track-main', type: 'main', name: 'Main Video', isMuted: false, isHidden: false, isLocked: false, volume: 100 },
            { id: 'track-audio-1', type: 'audio', name: 'Audio 1', isMuted: false, isHidden: false, isLocked: false, volume: 100 }
        ],
        items: {},
        
        playhead: 0,
        isPlaying: false,
        zoom: 0.1, // 0.1 px per ms => 100px per second
        
        selectedItemIds: [],
        activeTrackId: null,

        setPlayhead: (time) => set({ playhead: Math.max(0, time) }),
        togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
        setZoom: (zoom) => set({ zoom: Math.max(0.01, Math.min(zoom, 5)) }),

        addTrack: (trackData) => {
            const newTrack: Track = {
                id: uuidv4(),
                type: 'overlay',
                name: `Track ${get().tracks.length + 1}`,
                isMuted: false,
                isHidden: false,
                isLocked: false,
                volume: 100,
                ...trackData
            };
            set((state) => ({ tracks: [newTrack, ...state.tracks] }));
        },
        
        removeTrack: (trackId) => {
            set((state) => {
                const newItems = { ...state.items };
                // Remove all items in this track
                Object.values(newItems).forEach(item => {
                    if (item.trackId === trackId) delete newItems[item.id];
                });
                return {
                    tracks: state.tracks.filter(t => t.id !== trackId),
                    items: newItems,
                    selectedItemIds: state.selectedItemIds.filter(id => state.items[id]?.trackId !== trackId)
                };
            });
        },

        updateTrack: (trackId, updates) => set((state) => ({
            tracks: state.tracks.map(t => t.id === trackId ? { ...t, ...updates } : t)
        })),

        addItem: (itemData) => {
            const id = uuidv4();
            const newItem = { ...itemData, id };
            set((state) => {
                const newDuration = Math.max(state.duration, newItem.startTime + newItem.duration);
                return { 
                    items: { ...state.items, [id]: newItem },
                    duration: newDuration
                };
            });
            return id;
        },

        updateItem: (id, updates) => set((state) => {
            if (!state.items[id]) return state;
            const updatedItem = { ...state.items[id], ...updates };
            const newDuration = Math.max(state.duration, updatedItem.startTime + updatedItem.duration);
            return {
                items: { ...state.items, [id]: updatedItem },
                duration: newDuration
            };
        }),

        deleteItems: (ids) => set((state) => {
            const newItems = { ...state.items };
            ids.forEach(id => delete newItems[id]);
            return { 
                items: newItems, 
                selectedItemIds: state.selectedItemIds.filter(id => !ids.includes(id)) 
            };
        }),

        splitItem: (itemId, splitTime) => set((state) => {
            const item = state.items[itemId];
            if (!item || splitTime <= item.startTime || splitTime >= item.startTime + item.duration) return state;

            // Calculate the relative split point
            const splitOffset = splitTime - item.startTime;
            
            // Left part
            const leftItem: TrackItem = {
                ...item,
                duration: splitOffset
            };
            
            // Right part
            const rightItemId = uuidv4();
            const rightItem: TrackItem = {
                ...item,
                id: rightItemId,
                startTime: splitTime,
                duration: item.duration - splitOffset,
                offset: item.offset + splitOffset
            };

            return {
                items: {
                    ...state.items,
                    [itemId]: leftItem,
                    [rightItemId]: rightItem
                },
                selectedItemIds: [rightItemId] // Select the newly created right part
            };
        }),

        setSelection: (ids) => set({ selectedItemIds: ids }),
        
        setProjectConfig: (config) => set((state) => ({ ...state, ...config }))
    }), {
        partialize: (state) => ({ 
            tracks: state.tracks, 
            items: state.items, 
            duration: state.duration, 
            fps: state.fps, 
            width: state.width, 
            height: state.height 
        }),
        limit: 100
    })
);
