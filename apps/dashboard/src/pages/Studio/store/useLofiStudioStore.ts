import { create } from 'zustand';
import { temporal } from 'zundo';
import { v4 as uuidv4 } from 'uuid';

// ===== Type Definitions =====

export type LayerType = 'text' | 'image' | 'video' | 'widget' | 'particle';
export type WidgetType = 'nowPlaying' | 'clock' | 'visualizer';

export interface Layer {
    id: string;
    type: LayerType;
    name: string;
    visible: boolean;
    locked: boolean;

    // Transform
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    opacity: number;

    // Text properties
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fill?: string;
    textAlign?: 'left' | 'center' | 'right';
    fontStyle?: string; // 'normal', 'bold', 'italic', 'bold italic'

    // Media properties
    src?: string;
    filePath?: string;
    loop?: boolean;
    muted?: boolean;
    zIndex: number;

    // Widget properties
    widgetType?: WidgetType;
    widgetConfig?: any;
}

export interface Track {
    id: string;
    title: string;
    artist: string;
    album?: string;
    duration: number;
    src: string;
    filePath?: string;
    albumArt?: string;

    // Audio settings
    volume: number;
    fadeIn: number;
    fadeOut: number;
}

export interface SceneTransition {
    type: 'fade' | 'slide_left' | 'slide_right' | 'zoom_in' | 'dissolve';
    duration: number;
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface Scene {
    id: string;
    name: string;
    thumbnail: string;
    duration: number | null; // null = infinite
    layers: Layer[];
    playlist: Track[];
    playbackOrder: 'sequential' | 'random' | 'reverse';
    transition: SceneTransition;
    backgroundVideo: string | null;
    crossfadeDuration: number;

    // [NEW] AI Director Fields
    script?: string;
    visualPrompt?: string;
    generatedAssetPath?: string;
    audioPath?: string;
    audioUrl?: string;
}

export interface NowPlayingConfig {
    enabled: boolean;
    template: string;
    position: { x: number; y: number };
    style: {
        fontFamily: string;
        fontSize: number;
        color: string;
        backgroundColor?: string;
        padding: number;
    };
    animation: 'fade' | 'slide' | 'none';
    animationDuration: number;
    showAlbumArt: boolean;
    showProgress: boolean;
}

export interface ClockConfig {
    enabled: boolean;
    format: '12h' | '24h' | 'full';
    position: { x: number; y: number };
    style: {
        fontFamily: string;
        fontSize: number;
        color: string;
        backgroundColor?: string;
    };
    timezone: string;
    blinkColon: boolean;
    showTimezone: boolean;
}

export interface VisualizerConfig {
    enabled: boolean;
    type: 'waveform' | 'bars' | 'circle' | 'particles';
    position: { x: number; y: number };
    size: { width: number; height: number };
    color: string;
    opacity: number;
    sensitivity: number;
    smoothing: number;
    preset: 'minimal_bars' | 'ambient_wave' | 'vinyl_circle' | 'retro_spectrum';
}

export interface BrandKit {
    id: string;
    name: string;
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
    };
    fonts: {
        heading: string;
        body: string;
        accent: string;
    };
    logos: {
        main: string;
        icon: string;
        watermark: string;
    };
}

export interface WatermarkConfig {
    enabled: boolean;
    image: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    offset: { x: number; y: number };
    size: number;
    opacity: number;
    alwaysOnTop: boolean;
}

export interface VideoFilterConfig {
    preset: 'none' | 'warm_vintage' | 'cool_night' | 'retro_vhs' | 'soft_pastel' | 'custom';
    brightness: number;
    contrast: number;
    saturation: number;
    warmth: number;
    vignette: number;
    grain: number;
}

// ===== Store Interface =====

interface LofiStudioState {
    // ===== Scenes =====
    scenes: Scene[];
    activeSceneId: string | null;
    isDirectorMode: boolean; // [NEW]

    // Scene Actions
    addScene: (scene: Omit<Scene, 'id'>) => void;
    updateScene: (id: string, updates: Partial<Scene>) => void;
    deleteScene: (id: string) => void;
    duplicateScene: (id: string) => void;
    reorderScenes: (fromIndex: number, toIndex: number) => void;
    setActiveScene: (id: string) => void;

    // New Action
    resetStudio: (skipCleanup?: boolean) => void;
    setDirectorMode: (enabled: boolean) => void; // [NEW]

    // ===== Layers =====
    selectedLayerIds: string[];

    // Layer Actions
    addLayer: (layer: Omit<Layer, 'id' | 'zIndex'>) => void;
    updateLayer: (layerId: string, updates: Partial<Layer>) => void;
    deleteLayer: (layerId: string) => void;
    duplicateLayer: (layerId: string) => void;
    reorderLayer: (layerId: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
    selectLayers: (layerIds: string[]) => void;
    toggleLayerVisibility: (layerId: string) => void;
    toggleLayerLock: (layerId: string) => void;

    // ===== Playlist =====
    currentTrackId: string | null;
    playbackState: 'playing' | 'paused' | 'stopped';

    // Playlist Actions
    addTrack: (track: Omit<Track, 'id'>) => void;
    removeTrack: (trackId: string) => void;
    reorderTracks: (fromIndex: number, toIndex: number) => void;
    setPlaybackOrder: (order: 'sequential' | 'random' | 'reverse') => void;
    setCurrentTrack: (trackId: string | null) => void;
    setPlaybackState: (state: 'playing' | 'paused' | 'stopped') => void;

    // ===== Widgets =====
    widgets: {
        nowPlaying: NowPlayingConfig;
        clock: ClockConfig;
        visualizer: VisualizerConfig;
    };

    // Widget Actions
    updateNowPlayingConfig: (config: Partial<NowPlayingConfig>) => void;
    updateClockConfig: (config: Partial<ClockConfig>) => void;
    updateVisualizerConfig: (config: Partial<VisualizerConfig>) => void;

    // ===== Branding =====
    brandKit: BrandKit | null;
    watermark: WatermarkConfig;

    // Branding Actions
    setBrandKit: (kit: BrandKit) => void;
    updateWatermark: (config: Partial<WatermarkConfig>) => void;

    // ===== Effects =====
    videoFilters: VideoFilterConfig;
    sceneTransition: SceneTransition;

    // Effects Actions
    updateVideoFilters: (filters: Partial<VideoFilterConfig>) => void;
    updateSceneTransition: (transition: Partial<SceneTransition>) => void;
    setCrossfadeDuration: (duration: number) => void;

    // ===== Canvas =====
    zoom: number;
    pan: { x: number; y: number };
    gridEnabled: boolean;
    guidesEnabled: boolean;

    // Canvas Actions
    setZoom: (zoom: number) => void;
    setPan: (pan: { x: number; y: number }) => void;
    toggleGrid: () => void;
    toggleGuides: () => void;

    // Integration
    loadFromStation: (stationData: { scene?: Scene; scenes?: Scene[]; playlist: any[]; activeSceneId?: string }) => void;
    loadFromTemplate: (templateData: any) => void;
}

// ===== Default Configurations =====

const defaultNowPlayingConfig: NowPlayingConfig = {
    enabled: true,
    template: '♪ {artist} - {title}',
    position: { x: 640, y: 500 },
    style: {
        fontFamily: 'Poppins',
        fontSize: 48,
        color: '#FFFFFF',
        padding: 20,
    },
    animation: 'fade',
    animationDuration: 500,
    showAlbumArt: false,
    showProgress: false,
};

const defaultClockConfig: ClockConfig = {
    enabled: true,
    format: '24h',
    position: { x: 1200, y: 50 },
    style: {
        fontFamily: 'Roboto Mono',
        fontSize: 36,
        color: '#FFFFFF',
    },
    timezone: 'Asia/Seoul',
    blinkColon: true,
    showTimezone: false,
};

const defaultVisualizerConfig: VisualizerConfig = {
    enabled: true,
    type: 'bars',
    position: { x: 640, y: 650 },
    size: { width: 1200, height: 60 },
    color: '#4ECDC4',
    opacity: 0.7,
    sensitivity: 80,
    smoothing: 80,
    preset: 'minimal_bars',
};

const defaultWatermarkConfig: WatermarkConfig = {
    enabled: false,
    image: '',
    position: 'bottom-right',
    offset: { x: 20, y: 20 },
    size: 80,
    opacity: 0.7,
    alwaysOnTop: true,
};

const defaultVideoFilters: VideoFilterConfig = {
    preset: 'none',
    brightness: 0,
    contrast: 0,
    saturation: 0,
    warmth: 0,
    vignette: 0,
    grain: 0,
};

const defaultSceneTransition: SceneTransition = {
    type: 'fade',
    duration: 2000,
    easing: 'ease-in-out',
};

// ===== Create Default Scene =====

const createDefaultScene = (): Scene => ({
    id: uuidv4(),
    name: 'Main Scene',
    thumbnail: '',
    duration: null,
    layers: [],
    playlist: [],
    playbackOrder: 'random',
    transition: defaultSceneTransition,
    backgroundVideo: null,
    crossfadeDuration: 0.2,
});

// ===== Store Implementation =====

export const useLofiStudioStore = create<LofiStudioState>()(
    temporal((set, get) => ({
        // ===== Initial State =====
        scenes: [createDefaultScene()],
        activeSceneId: null,
        isDirectorMode: false, // [NEW]
        selectedLayerIds: [],
        currentTrackId: null,
        playbackState: 'stopped',

        widgets: {
            nowPlaying: defaultNowPlayingConfig,
            clock: defaultClockConfig,
            visualizer: defaultVisualizerConfig,
        },

        brandKit: null,
        watermark: defaultWatermarkConfig,
        videoFilters: defaultVideoFilters,
        sceneTransition: defaultSceneTransition,

        zoom: 1,
        pan: { x: 0, y: 0 },
        gridEnabled: false,
        guidesEnabled: false,

        // ===== Scene Actions =====

        addScene: (scene) => set((state) => {
            const newScene: Scene = {
                ...scene,
                id: uuidv4(),
            };
            return {
                scenes: [...state.scenes, newScene],
                activeSceneId: newScene.id,
            };
        }),

        updateScene: (id, updates) => set((state) => ({
            scenes: state.scenes.map(scene =>
                scene.id === id ? { ...scene, ...updates } : scene
            ),
        })),

        deleteScene: (id) => set((state) => {
            // Prevent deleting last scene
            if (state.scenes.length === 1) return state;

            // Find the scene to delete
            const sceneToDelete = state.scenes.find(s => s.id === id);

            // Collect all file paths from layers, tracks, and background video
            if (sceneToDelete) {
                const filePaths: string[] = [];

                // Collect from layers (images/videos)
                sceneToDelete.layers.forEach(layer => {
                    if (layer.filePath && layer.filePath.includes('studio_uploads')) {
                        filePaths.push(layer.filePath);
                    }
                });

                // Collect from playlist tracks (audio files)
                sceneToDelete.playlist.forEach(track => {
                    if (track.filePath && track.filePath.includes('studio_uploads')) {
                        filePaths.push(track.filePath);
                    }
                });

                // Collect background video
                if (sceneToDelete.backgroundVideo && sceneToDelete.backgroundVideo.includes('studio_uploads')) {
                    filePaths.push(sceneToDelete.backgroundVideo);
                }

                // Call cleanup API if there are files to delete
                if (filePaths.length > 0) {
                    fetch('/api/studio/cleanup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ file_paths: filePaths })
                    })
                        .then(res => res.json())
                        .then(data => {
                            console.log(`🗑️ Cleaned up ${data.deleted_count} files from scene "${sceneToDelete.name}"`);
                            if (data.errors.length > 0) {
                                console.warn('Cleanup errors:', data.errors);
                            }
                        })
                        .catch(err => {
                            console.error('Failed to cleanup files:', err);
                        });
                }
            }

            const newScenes = state.scenes.filter(s => s.id !== id);
            const newActiveId = state.activeSceneId === id
                ? newScenes[0]?.id || null
                : state.activeSceneId;

            return {
                scenes: newScenes,
                activeSceneId: newActiveId,
            };
        }),

        duplicateScene: (id) => set((state) => {
            const scene = state.scenes.find(s => s.id === id);
            if (!scene) return state;

            const newScene: Scene = {
                ...scene,
                id: uuidv4(),
                name: `${scene.name} (Copy)`,
                layers: scene.layers.map(layer => ({
                    ...layer,
                    id: uuidv4(),
                })),
                playlist: scene.playlist.map(track => ({
                    ...track,
                    id: uuidv4(),
                })),
            };

            return {
                scenes: [...state.scenes, newScene],
            };
        }),

        reorderScenes: (fromIndex, toIndex) => set((state) => {
            const newScenes = [...state.scenes];
            const [removed] = newScenes.splice(fromIndex, 1);
            newScenes.splice(toIndex, 0, removed);
            return { scenes: newScenes };
        }),

        setActiveScene: (id) => set({ activeSceneId: id }),

        // ===== Layer Actions =====

        addLayer: (layer) => set((state) => {
            const activeScene = state.scenes.find(s => s.id === state.activeSceneId);
            if (!activeScene) return state;

            const newLayer: Layer = {
                ...layer,
                id: uuidv4(),
                zIndex: activeScene.layers.length,
            };

            return {
                scenes: state.scenes.map(scene =>
                    scene.id === state.activeSceneId
                        ? { ...scene, layers: [...scene.layers, newLayer] }
                        : scene
                ),
                selectedLayerIds: [newLayer.id],
            };
        }),

        updateLayer: (layerId, updates) => set((state) => {
            const activeScene = state.scenes.find(s => s.id === state.activeSceneId);
            if (!activeScene) return state;

            return {
                scenes: state.scenes.map(scene =>
                    scene.id === state.activeSceneId
                        ? {
                            ...scene,
                            layers: scene.layers.map(layer =>
                                layer.id === layerId ? { ...layer, ...updates } : layer
                            ),
                        }
                        : scene
                ),
            };
        }),

        deleteLayer: (layerId) => set((state) => {
            const activeScene = state.scenes.find(s => s.id === state.activeSceneId);
            if (!activeScene) return state;

            return {
                scenes: state.scenes.map(scene =>
                    scene.id === state.activeSceneId
                        ? { ...scene, layers: scene.layers.filter(l => l.id !== layerId) }
                        : scene
                ),
                selectedLayerIds: state.selectedLayerIds.filter(id => id !== layerId),
            };
        }),

        duplicateLayer: (layerId) => set((state) => {
            const activeScene = state.scenes.find(s => s.id === state.activeSceneId);
            if (!activeScene) return state;

            const layer = activeScene.layers.find(l => l.id === layerId);
            if (!layer) return state;

            const newLayer: Layer = {
                ...layer,
                id: uuidv4(),
                name: `${layer.name} (Copy)`,
                x: layer.x + 20,
                y: layer.y + 20,
                zIndex: activeScene.layers.length,
            };

            return {
                scenes: state.scenes.map(scene =>
                    scene.id === state.activeSceneId
                        ? { ...scene, layers: [...scene.layers, newLayer] }
                        : scene
                ),
                selectedLayerIds: [newLayer.id],
            };
        }),

        reorderLayer: (layerId, direction) => set((state) => {
            const activeScene = state.scenes.find(s => s.id === state.activeSceneId);
            if (!activeScene) return state;

            const layers = [...activeScene.layers];
            const index = layers.findIndex(l => l.id === layerId);
            if (index === -1) return state;

            let newIndex = index;
            switch (direction) {
                case 'up':
                    newIndex = Math.min(index + 1, layers.length - 1);
                    break;
                case 'down':
                    newIndex = Math.max(index - 1, 0);
                    break;
                case 'top':
                    newIndex = layers.length - 1;
                    break;
                case 'bottom':
                    newIndex = 0;
                    break;
            }

            const [removed] = layers.splice(index, 1);
            layers.splice(newIndex, 0, removed);

            // Update zIndex
            layers.forEach((layer, i) => {
                layer.zIndex = i;
            });

            return {
                scenes: state.scenes.map(scene =>
                    scene.id === state.activeSceneId
                        ? { ...scene, layers }
                        : scene
                ),
            };
        }),

        selectLayers: (layerIds) => set({ selectedLayerIds: layerIds }),

        toggleLayerVisibility: (layerId) => set((state) => {
            const activeScene = state.scenes.find(s => s.id === state.activeSceneId);
            if (!activeScene) return state;

            return {
                scenes: state.scenes.map(scene =>
                    scene.id === state.activeSceneId
                        ? {
                            ...scene,
                            layers: scene.layers.map(layer =>
                                layer.id === layerId
                                    ? { ...layer, visible: !layer.visible }
                                    : layer
                            ),
                        }
                        : scene
                ),
            };
        }),

        toggleLayerLock: (layerId) => set((state) => {
            const activeScene = state.scenes.find(s => s.id === state.activeSceneId);
            if (!activeScene) return state;

            return {
                scenes: state.scenes.map(scene =>
                    scene.id === state.activeSceneId
                        ? {
                            ...scene,
                            layers: scene.layers.map(layer =>
                                layer.id === layerId
                                    ? { ...layer, locked: !layer.locked }
                                    : layer
                            ),
                        }
                        : scene
                ),
            };
        }),

        // ===== Playlist Actions =====

        addTrack: (track) => set((state) => {
            const activeScene = state.scenes.find(s => s.id === state.activeSceneId);
            if (!activeScene) return state;

            const newTrack: Track = {
                ...track,
                id: uuidv4(),
            };

            return {
                scenes: state.scenes.map(scene =>
                    scene.id === state.activeSceneId
                        ? { ...scene, playlist: [...scene.playlist, newTrack] }
                        : scene
                ),
            };
        }),

        removeTrack: (trackId) => set((state) => {
            const activeScene = state.scenes.find(s => s.id === state.activeSceneId);
            if (!activeScene) return state;

            return {
                scenes: state.scenes.map(scene =>
                    scene.id === state.activeSceneId
                        ? { ...scene, playlist: scene.playlist.filter(t => t.id !== trackId) }
                        : scene
                ),
                currentTrackId: state.currentTrackId === trackId ? null : state.currentTrackId,
            };
        }),

        reorderTracks: (fromIndex, toIndex) => set((state) => {
            const activeScene = state.scenes.find(s => s.id === state.activeSceneId);
            if (!activeScene) return state;

            const newPlaylist = [...activeScene.playlist];
            const [removed] = newPlaylist.splice(fromIndex, 1);
            newPlaylist.splice(toIndex, 0, removed);

            return {
                scenes: state.scenes.map(scene =>
                    scene.id === state.activeSceneId
                        ? { ...scene, playlist: newPlaylist }
                        : scene
                ),
            };
        }),

        setPlaybackOrder: (order) => set((state) => {
            const activeScene = state.scenes.find(s => s.id === state.activeSceneId);
            if (!activeScene) return state;

            return {
                scenes: state.scenes.map(scene =>
                    scene.id === state.activeSceneId
                        ? { ...scene, playbackOrder: order }
                        : scene
                ),
            };
        }),

        setCurrentTrack: (trackId) => set({ currentTrackId: trackId }),

        setPlaybackState: (state) => set({ playbackState: state }),

        // ===== Widget Actions =====

        updateNowPlayingConfig: (config) => set((state) => ({
            widgets: {
                ...state.widgets,
                nowPlaying: { ...state.widgets.nowPlaying, ...config },
            },
        })),

        updateClockConfig: (config) => set((state) => ({
            widgets: {
                ...state.widgets,
                clock: { ...state.widgets.clock, ...config },
            },
        })),

        updateVisualizerConfig: (config) => set((state) => ({
            widgets: {
                ...state.widgets,
                visualizer: { ...state.widgets.visualizer, ...config },
            },
        })),

        // ===== Branding Actions =====

        setBrandKit: (kit) => set({ brandKit: kit }),

        updateWatermark: (config) => set((state) => ({
            watermark: { ...state.watermark, ...config },
        })),

        // ===== Effects Actions =====

        updateVideoFilters: (filters) => set((state) => ({
            videoFilters: { ...state.videoFilters, ...filters },
        })),

        updateSceneTransition: (transition) => set((state) => ({
            sceneTransition: { ...state.sceneTransition, ...transition },
        })),

        setCrossfadeDuration: (duration) => set((state) => {
            const activeScene = state.scenes.find(s => s.id === state.activeSceneId);
            if (!activeScene) return state;

            return {
                scenes: state.scenes.map(scene =>
                    scene.id === state.activeSceneId
                        ? { ...scene, crossfadeDuration: duration }
                        : scene
                )
            };
        }),

        // ===== Canvas Actions =====

        setZoom: (zoom) => set({ zoom }),

        setPan: (pan) => set({ pan }),

        toggleGrid: () => set((state) => ({ gridEnabled: !state.gridEnabled })),

        // [NEW] Director Mode Action
        setDirectorMode: (enabled) => set({ isDirectorMode: enabled }),


        toggleGuides: () => set((state) => ({ guidesEnabled: !state.guidesEnabled })),

        // ===== Integration Actions =====
        loadFromStation: (stationData: { scene?: Scene; scenes?: Scene[]; playlist: any[]; activeSceneId?: string }) => set((state) => {
            // Check for multi-scene project data
            if (stationData.scenes && stationData.scenes.length > 0) {
                const loadedScenes = stationData.scenes.map((s: any) => ({
                    ...createDefaultScene(),
                    ...s,
                    id: s.id || uuidv4(),
                    layers: (s.layers || []).map((l: any) => ({ ...l, id: l.id || uuidv4() })),
                    playlist: (s.playlist || []).map((p: any) => ({
                        ...p,
                        id: p.id || uuidv4(),
                        src: p.src || p.file_path || '',
                        duration: p.duration || 0,
                    }))
                }));

                return {
                    scenes: loadedScenes,
                    activeSceneId: stationData.activeSceneId || loadedScenes[0].id,
                    currentTrackId: null,
                    playbackState: 'stopped'
                };
            }

            // Fallback: Single Scene (Legacy)
            const loadedScene = stationData.scene || createDefaultScene();
            const loadedPlaylist = stationData.playlist || [];
            const sceneId = loadedScene.id || uuidv4();

            // Ensure layers have valid IDs
            const hydratedLayers = (loadedScene.layers || []).map((l: any) => ({
                ...l,
                id: l.id || uuidv4()
            }));

            // Hydrate playlist
            const hydratedPlaylist = loadedPlaylist.map((p: any) => ({
                ...p,
                id: p.id || uuidv4(),
                src: p.src || p.file_path || '',
                duration: p.duration || 0,
                volume: 1,
                fadeIn: 0,
                fadeOut: 0
            }));

            const newScene: Scene = {
                ...createDefaultScene(),
                ...loadedScene,
                id: sceneId,
                layers: hydratedLayers,
                playlist: hydratedPlaylist
            };

            return {
                scenes: [newScene],
                activeSceneId: sceneId,
                currentTrackId: null,
                playbackState: 'stopped'
            };
        }),

        loadFromTemplate: (templateData: any) => set((state) => {
            if (!templateData) return state;

            const fixLayerSrc = (layer: any) => {
                if ((layer.type !== 'image' && layer.type !== 'video') || !layer.filePath) return layer;

                try {
                    // Normalize path separators
                    const normalizedPath = layer.filePath.replace(/\\/g, '/');
                    if (normalizedPath.includes('studio_uploads')) {
                        const parts = normalizedPath.split('/');
                        const filename = parts[parts.length - 1];
                        // Reconstruct persistent URL
                        // Ensure we don't break if it's already correct, but enforcing proper encoding is good.
                        // Assuming backend serves at /files/studio_uploads/
                        const fixedSrc = `/files/studio_uploads/${encodeURIComponent(filename)}`;
                        return { ...layer, src: fixedSrc };
                    }
                } catch (e) {
                    console.warn("Failed to fix layer src", e);
                }
                return layer;
            };

            // Validate scenes
            const loadedScenes = Array.isArray(templateData.scenes)
                ? templateData.scenes.map((s: any) => ({
                    ...s,
                    id: s.id || uuidv4(),
                    layers: (s.layers || []).map((l: any) => fixLayerSrc({ ...l, id: l.id || uuidv4() })),
                    playlist: (s.playlist || []).map((t: any) => ({ ...t, id: t.id || uuidv4() }))
                }))
                : [createDefaultScene()];

            return {
                scenes: loadedScenes,
                activeSceneId: loadedScenes[0]?.id || null,
                widgets: templateData.widgets ? { ...state.widgets, ...templateData.widgets } : state.widgets,
                brandKit: templateData.brandKit || state.brandKit,
                currentTrackId: null,
                playbackState: 'stopped'
            };
        }),

        resetStudio: (skipCleanup = false) => {
            const state = get();

            if (!skipCleanup) {
                // Perform Cleanup
                const allScenes = state.scenes;
                const filePaths: string[] = [];

                allScenes.forEach(scene => {
                    // Layers
                    scene.layers.forEach(layer => {
                        if (layer.filePath && layer.filePath.includes('studio_uploads')) {
                            filePaths.push(layer.filePath);
                        }
                    });
                    // Playlist
                    scene.playlist.forEach(track => {
                        if (track.filePath && track.filePath.includes('studio_uploads')) {
                            filePaths.push(track.filePath);
                        }
                    });
                    // Background
                    if (scene.backgroundVideo && scene.backgroundVideo.includes('studio_uploads')) {
                        filePaths.push(scene.backgroundVideo);
                    }
                });

                // Cleanup Call
                if (filePaths.length > 0) {
                    fetch('/api/studio/cleanup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ file_paths: filePaths })
                    }).catch(console.error);
                }
            }

            // Reset State
            const newId = uuidv4();
            set({
                scenes: [{
                    id: newId,
                    name: 'Scene 1',
                    thumbnail: '',
                    duration: null,
                    layers: [],
                    playlist: [],
                    playbackOrder: 'random',
                    transition: defaultSceneTransition,
                    backgroundVideo: null,
                    crossfadeDuration: 0.2,
                }],
                activeSceneId: newId,
                selectedLayerIds: [],
                currentTrackId: null,
                playbackState: 'stopped'
            });
        },
    }))
);

// ===== Helper Functions =====

export const getActiveScene = (): Scene | null => {
    const state = useLofiStudioStore.getState();
    return state.scenes.find(s => s.id === state.activeSceneId) || null;
};

export const getActiveSceneLayers = (): Layer[] => {
    const scene = getActiveScene();
    return scene?.layers || [];
};

export const getActiveScenePlaylist = (): Track[] => {
    const scene = getActiveScene();
    return scene?.playlist || [];
};
// Expose store for Puppeteer Hydration
if (typeof window !== 'undefined') {
    (window as any).lofiStudioStore = useLofiStudioStore;
}
