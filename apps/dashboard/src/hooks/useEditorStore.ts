import { create } from 'zustand';
import { temporal } from 'zundo';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// --- Types ---

export type TrackType = 'video' | 'audio' | 'image' | 'text' | 'caption' | 'sticker';

export interface Keyframe {
    id: string;
    time: number; // Relative to clip start
    value: any;
    easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

export interface TransformData {
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
    rotation: number;
    opacity: number;
    flipX: boolean;
    flipY: boolean;
}

export interface Clip {
    id: string;
    trackId: string;
    type: TrackType;
    source: string; // URL or file path
    path?: string; // Absolute path for backend
    name: string;
    start: number; // Start time on timeline (seconds)
    duration: number; // Duration of the clip (seconds)
    trimStart: number; // Start time within the source media
    speed: number;
    layer: number; // Z-index for rendering

    // Visual Properties
    transform: TransformData;

    style: {
        blendMode: string;
        stroke: { width: number; color: string };
        shadow: { blur: number; color: string; offset: number };
        // Text specific
        fontFamily?: string;
        fontSize?: number;
        fontWeight?: string;
        fontStyle?: string;
        textAlign?: 'left' | 'center' | 'right';
        color?: string;
        backgroundColor?: string;
        letterSpacing?: number;
        lineHeight?: number;
        // Animation & Position
        animationEntrance?: string;
        animationExit?: string;
        animationEmphasis?: string;
        marginV?: number;
        positionPreset?: 'top' | 'middle' | 'bottom';
    };

    filter: {
        brightness: number;
        contrast: number;
        saturation: number;
        hue: number;
        blur: number;
    };

    chromakey?: {
        enabled: boolean;
        color: string;
        similarity: number;
        blend: number;
    };

    // Audio Properties
    audio: {
        volume: number;
        muted: boolean;
        pan: number; // -1 to 1
        fadeIn: number;
        fadeOut: number;
        denoise?: boolean;
        voiceEffect?: string; // 'none', 'chipmunk', 'robot', 'pitch_low', 'pitch_high'
        ducking?: boolean;
        waveform?: number[]; // Array of peaks [0-100]
    };

    stabilization?: boolean;

    // Transitions & Animation
    transitionIn?: { type: string; duration: number };
    transitionOut?: { type: string; duration: number };
    keyframes: Keyframe[];

    // Crop Data
    crop?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    sourceDimensions?: {
        width: number;
        height: number;
    };

    content?: string; // For text/caption clips
    motion?: any;
}

export interface Track {
    id: string;
    type: TrackType;
    label: string;
    clips: Clip[];
    muted: boolean;
    hidden: boolean;
    locked: boolean;
    isMagnetic: boolean; // True for main video track
    isDefault?: boolean;
}

export interface Template {
    id: string;
    name: string;
    tracks: Track[];
    thumbnail?: string;
    duration: number;
    aspectRatio: '9:16' | '16:9';
    createdAt?: string;
    updatedAt?: string;
}

export interface Asset {
    id: string;
    type: TrackType;
    source: string; // URL for frontend display
    path?: string; // Absolute path for backend operations
    name: string;
    thumbnail?: string;
}

interface EditorState {
    tracks: Track[];
    currentTime: number;
    duration: number; // Total timeline duration
    scale: number;    // Zoom level (pixels per second)
    isPlaying: boolean;
    selectedClipId: string | null;
    templates: Template[];
    assets: Asset[]; // Project Assets
    aspectRatio: '9:16' | '16:9';
    canvasMode: 'shorts' | 'wide';
    previewScale: number; // Workspace Zoom Level (1.0 = fit)

    // Track Actions
    updateTrack: (trackId: string, updates: Partial<Track>) => void;
    toggleTrackMute: (trackId: string) => void;
    toggleTrackLock: (trackId: string) => void;
    toggleTrackHide: (trackId: string) => void;
    toggleMagnetic: (trackId: string) => void;
    addTrack: (type: TrackType, index?: number) => void;
    removeTrack: (trackId: string) => void;

    // Copy/Paste
    copiedClip: Clip | null;
    copyClip: (clipId: string) => void;
    pasteClip: () => void;

    // Clip Actions
    addClip: (targetTrackIdArg: string | null, file: File | null, path: string | null, type: TrackType | 'auto', startTime?: number, durationArg?: number, contentArg?: string, styleArg?: any, sourceArg?: string) => { id: string; trackId: string };
    addClipFromUrl: (url: string, type: TrackType) => void;
    removeClip: (trackId: string, clipId: string) => void;
    moveClip: (trackId: string, clipId: string, newStart: number, newTrackId?: string) => void;
    resizeClip: (trackId: string, clipId: string, newStart: number, newDuration: number, newTrimStart: number) => void;
    splitClip: (trackId: string, clipId: string, time: number) => void;
    updateClip: (trackId: string, clipId: string, updates: Partial<Clip>) => void;

    setClipSpeed: (trackId: string, clipId: string, speed: number) => void;
    detachAudio: (trackId: string, clipId: string) => void;
    updateClipWaveform: (trackId: string, clipId: string, waveform: number[]) => void;
    addTransition: (trackId: string, clipId: string, transition: any) => void;
    applyFilter: (trackId: string, clipId: string, filterConfig: any) => void;
    syncVideoToAudio: (videoClipId: string, audioClipId: string) => void;

    // Asset Actions
    addAsset: (asset: Asset) => void;
    removeAsset: (assetId: string) => void;

    // Global Settings
    setCurrentTime: (time: number | ((prev: number) => number)) => void;
    setIsPlaying: (isPlaying: boolean) => void;
    setScale: (scale: number) => void;
    setSelectedClipId: (id: string | null) => void;
    setAspectRatio: (ratio: '9:16' | '16:9') => void;
    setCanvasMode: (mode: 'shorts' | 'wide') => void;
    setPreviewScale: (scale: number) => void;

    // Fonts
    availableFonts: Record<string, string[]>;
    fetchAvailableFonts: () => Promise<void>;

    // Subtitle/TTS Config
    subtitleConfig: any;
    ttsConfig: any;
    setSubtitleConfig: (config: any) => void;
    setTTSConfig: (config: any) => void;
    captionConfig: any;
    setCaptionConfig: (config: any) => void;
    applyToAllCaptions: boolean;
    setApplyToAllCaptions: (apply: boolean) => void;

    generateCaptionsFromAudio: (audioClipId: string, language?: string, model?: string, script?: string) => Promise<void>;

    // Template Actions
    saveTemplate: (name: string) => void;
    applyTemplate: (templateId: string) => void;
    fetchTemplates: () => Promise<void>;
    saveTemplateRemote: (name: string) => Promise<void>;
    deleteTemplateRemote: (templateId: string) => Promise<void>;

    // Bulk Actions
    setClips: (trackId: string, clips: Clip[]) => void;
    resetEditor: () => void;
}

// --- Store Implementation ---

export const useEditorStore = create<EditorState>()(
    temporal(
        persist(
            (set, get) => ({
                tracks: [
                    { id: uuidv4(), type: 'text', label: '자막', clips: [], muted: false, hidden: false, locked: false, isMagnetic: false, isDefault: true },
                    { id: uuidv4(), type: 'text', label: '텍스트', clips: [], muted: false, hidden: false, locked: false, isMagnetic: false, isDefault: true },
                    { id: uuidv4(), type: 'image', label: '이미지', clips: [], muted: false, hidden: false, locked: false, isMagnetic: false, isDefault: true },
                    { id: 'main-video', type: 'video', label: '메인 동영상', clips: [], muted: false, hidden: false, locked: false, isMagnetic: true, isDefault: true },
                    { id: uuidv4(), type: 'audio', label: '오디오', clips: [], muted: false, hidden: false, locked: false, isMagnetic: false, isDefault: true },
                ],
                currentTime: 0,
                duration: 60,
                scale: 50,
                isPlaying: false,
                selectedClipId: null,
                templates: [],
                assets: [],
                aspectRatio: '9:16',
                canvasMode: 'shorts',
                previewScale: 1,
                availableFonts: {},
                fetchAvailableFonts: async () => {
                    try {
                        const res = await fetch('/api/tools/fonts');
                        const data = await res.json();
                        if (Array.isArray(data)) {
                            set({ availableFonts: { "Other": data } });
                        } else {
                            set({ availableFonts: data });
                        }
                    } catch (e) {
                        console.error("Failed to fetch fonts", e);
                    }
                },
                subtitleConfig: {},
                ttsConfig: {},
                captionConfig: {
                    enabled: true,
                    font: 'Malgun Gothic',
                    fontSize: 40,
                    isBold: true,
                    isItalic: false,
                    textColor: '#ffffff',
                    outlineSize: 2,
                    outlineColor: '#000000',
                    shadowSize: 2,
                    shadowColor: '#000000',
                    useBox: false,
                    boxColor: '#000000',
                    boxOpacity: 50,
                    position: 'bottom',
                    marginV: 50,
                    customX: 0,
                    customY: 0,
                    splitLimit: 20
                },
                applyToAllCaptions: true,
                setCaptionConfig: (config) => set((state) => {
                    const newState = { captionConfig: { ...state.captionConfig, ...config } };

                    if (state.applyToAllCaptions) {
                        const activeConfig = newState.captionConfig; // Use merged config
                        const newTracks = state.tracks.map(track => {
                            // Target both 'text' tracks labeled '자막' AND specifically created caption tracks if any
                            if ((track.type === 'text' && track.label === '자막') || track.type === 'caption') {
                                const newClips = track.clips.map(clip => ({
                                    ...clip,
                                    transform: {
                                        ...clip.transform,
                                        // Use pixel coordinates based on aspect ratio (assuming defaults)
                                        y: (() => {
                                            const stageH = state.aspectRatio === '9:16' ? 1920 : 1080;
                                            const margin = activeConfig.marginV || 0; // Margin in pixels

                                            // Assume default height for centering if unknown, or just use center point?
                                            // Text anchor is usually center or top-left.
                                            // Let's target the *center* of the element to be at the target Y?
                                            // Or top edge? 
                                            // Standard: "Top" = margin from top. "Bottom" = margin from bottom.
                                            // If anchor is top-left:
                                            // Top: y = margin
                                            // Bottom: y = stageH - height - margin
                                            // Middle: y = (stageH - height) / 2

                                            // BUT we don't know height here easily (clip.transform.height might be 0 or default).
                                            // Let's assume height ~ 100 for text? Or use clip.transform.height.
                                            const h = clip.transform.height || 100;

                                            if (activeConfig.position === 'top') return margin + 100; // slightly down from top? or just margin. Let's say margin.
                                            if (activeConfig.position === 'middle') return (stageH - h) / 2;
                                            if (activeConfig.position === 'bottom') return stageH - h - margin - 100; // Extra padding from bottom
                                            return clip.transform.y;
                                        })(),
                                        x: (() => {
                                            // Also enforce X if customX is set, or keep centered? 
                                            // For now, if activeConfig has customX (and position is custom?), use it.
                                            if (activeConfig.position === 'custom') return activeConfig.customX;
                                            return clip.transform.x;
                                        })()
                                    },
                                    style: {
                                        ...clip.style,
                                        fontFamily: activeConfig.font,
                                        fontSize: activeConfig.fontSize,
                                        color: activeConfig.textColor,
                                        backgroundColor: activeConfig.useBox ? activeConfig.boxColor : 'transparent',
                                        stroke: { width: activeConfig.outlineSize, color: activeConfig.outlineColor },
                                        shadow: { blur: activeConfig.shadowSize, color: activeConfig.shadowColor, offset: 2 },
                                        isBold: activeConfig.isBold,
                                        isItalic: activeConfig.isItalic,
                                        // New Properties
                                        animationEntrance: activeConfig.animationEntrance,
                                        animationExit: activeConfig.animationExit,
                                        animationEmphasis: activeConfig.animationEmphasis,
                                        marginV: activeConfig.marginV,
                                        positionPreset: activeConfig.position as 'top' | 'middle' | 'bottom',
                                    }
                                }));
                                return { ...track, clips: newClips };
                            }
                            return track;
                        });
                        return { ...newState, tracks: newTracks };
                    }

                    return newState;
                }),
                setApplyToAllCaptions: (apply) => set({ applyToAllCaptions: apply }),

                addTrack: (type: TrackType, index?: number) => set((state) => {
                    const newTrack: Track = {
                        id: uuidv4(),
                        type,
                        label: `${type === 'video' ? '비디오' : type === 'audio' ? '오디오' : type === 'text' ? '텍스트' : type === 'caption' ? '자막' : type === 'image' ? '이미지' : '트랙'} ${state.tracks.filter(t => t.type === type).length + 1}`,
                        clips: [],
                        muted: false,
                        hidden: false,
                        locked: false,
                        isMagnetic: false
                    };

                    const newTracks = [...state.tracks];
                    if (index !== undefined && index >= 0) {
                        newTracks.splice(index, 0, newTrack);
                    } else {
                        newTracks.push(newTrack);
                    }

                    return { tracks: newTracks };
                }),

                removeTrack: (trackId: string) => set((state) => {
                    const track = state.tracks.find(t => t.id === trackId);
                    // Prevent deleting the main video track
                    if (track && track.id === 'main-video') return {};
                    return { tracks: state.tracks.filter(t => t.id !== trackId) };
                }),

                // Copy/Paste Implementation
                copiedClip: null,
                copyClip: (clipId: string) => set((state) => {
                    const track = state.tracks.find(t => t.clips.some(c => c.id === clipId));
                    if (!track) return {};
                    const clip = track.clips.find(c => c.id === clipId);
                    return { copiedClip: clip || null };
                }),
                pasteClip: () => set((state) => {
                    if (!state.copiedClip) return {};

                    const newClip = { ...state.copiedClip, id: uuidv4() };
                    const targetType = newClip.type;

                    const tracks = [...state.tracks];
                    let trackIndex = tracks.findIndex(t => t.type === targetType);

                    if (trackIndex === -1) {
                        const newTrack: Track = {
                            id: uuidv4(),
                            type: targetType,
                            label: `${targetType === 'video' ? '비디오' : targetType === 'audio' ? '오디오' : targetType === 'text' ? '텍스트' : targetType === 'caption' ? '자막' : targetType === 'image' ? '이미지' : '트랙'} ${tracks.filter(t => t.type === targetType).length + 1}`,
                            clips: [],
                            muted: false,
                            hidden: false,
                            locked: false,
                            isMagnetic: false
                        };
                        tracks.push(newTrack);
                        trackIndex = tracks.length - 1;
                    }

                    const track = tracks[trackIndex];
                    let start = state.currentTime;
                    const duration = newClip.duration;

                    const sortedClips = [...track.clips].sort((a, b) => a.start - b.start);
                    let hasCollision = sortedClips.some(c => {
                        const cEnd = c.start + c.duration;
                        const newEnd = start + duration;
                        return (start < cEnd && newEnd > c.start);
                    });

                    if (hasCollision) {
                        start = state.currentTime;
                        for (const clip of sortedClips) {
                            if (clip.start + clip.duration > start) {
                                let gapStart = Math.max(start, clip.start + clip.duration);
                                const nextClip = sortedClips.find(c => c.start >= gapStart);
                                if (!nextClip || nextClip.start >= gapStart + duration) {
                                    start = gapStart;
                                    hasCollision = false;
                                    break;
                                }
                            }
                        }
                        if (hasCollision) {
                            const lastClip = sortedClips[sortedClips.length - 1];
                            start = lastClip ? lastClip.start + lastClip.duration : 0;
                        }
                    }

                    newClip.start = start;
                    newClip.trackId = track.id;

                    const newClips = [...track.clips, newClip];
                    tracks[trackIndex] = { ...track, clips: newClips };

                    return { tracks };
                }),

                updateTrack: (trackId: string, updates: Partial<Track>) => set((state) => {
                    const trackIndex = state.tracks.findIndex(t => t.id === trackId);
                    if (trackIndex === -1) return {};
                    const newTracks = [...state.tracks];
                    newTracks[trackIndex] = { ...newTracks[trackIndex], ...updates };
                    return { tracks: newTracks };
                }),

                toggleTrackMute: (trackId: string) => set((state) => {
                    const trackIndex = state.tracks.findIndex(t => t.id === trackId);
                    if (trackIndex === -1) return {};
                    const newTracks = [...state.tracks];
                    newTracks[trackIndex] = { ...newTracks[trackIndex], muted: !newTracks[trackIndex].muted };
                    return { tracks: newTracks };
                }),

                toggleTrackLock: (trackId: string) => set((state) => {
                    const trackIndex = state.tracks.findIndex(t => t.id === trackId);
                    if (trackIndex === -1) return {};
                    const newTracks = [...state.tracks];
                    newTracks[trackIndex] = { ...newTracks[trackIndex], locked: !newTracks[trackIndex].locked };
                    return { tracks: newTracks };
                }),

                toggleTrackHide: (trackId: string) => set((state) => {
                    const trackIndex = state.tracks.findIndex(t => t.id === trackId);
                    if (trackIndex === -1) return {};
                    const newTracks = [...state.tracks];
                    newTracks[trackIndex] = { ...newTracks[trackIndex], hidden: !newTracks[trackIndex].hidden };
                    return { tracks: newTracks };
                }),

                toggleMagnetic: (trackId: string) => set((state) => {
                    const trackIndex = state.tracks.findIndex(t => t.id === trackId);
                    if (trackIndex === -1) return {};
                    const newTracks = [...state.tracks];
                    newTracks[trackIndex] = { ...newTracks[trackIndex], isMagnetic: !newTracks[trackIndex].isMagnetic };
                    return { tracks: newTracks };
                }),

                addClip: (targetTrackIdArg: string | null, file: File | null, path: string | null, type: TrackType | 'auto', startTime?: number, durationArg?: number, contentArg?: string, styleArg?: any, sourceArg?: string) => {
                    const state = get();
                    let finalType = type;
                    if (!finalType && file) {
                        if (file.type.startsWith('video')) finalType = 'video';
                        else if (file.type.startsWith('audio')) finalType = 'audio';
                        else if (file.type.startsWith('image')) finalType = 'image';
                    }
                    if (!finalType) finalType = 'video';

                    const id = uuidv4();
                    const url = sourceArg || (file ? URL.createObjectURL(file) : path);

                    // Determine Stage Dimensions and Default Center
                    const [stageW, stageH] = state.aspectRatio === '9:16' ? [1080, 1920] : [1920, 1080];
                    // Defaults
                    let defaultW = (finalType === 'text' || finalType === 'caption') ? 400 : 0;
                    let defaultH = (finalType === 'text' || finalType === 'caption') ? 100 : 0;
                    let initialX = (stageW - defaultW) / 2;
                    let initialY = (stageH - defaultH) / 2;

                    // Note: For images/video, we start with 0x0 (or hidden) then expand.
                    // But to avoid jumping logic, let's keep 0x0 W/H but set X/Y to center roughly?
                    // actually, if W=0, center is stageW/2.
                    if (defaultW === 0) {
                        initialX = stageW / 2;
                        initialY = stageH / 2;
                    }

                    // Determine Target Track ID
                    let targetTrackId = targetTrackIdArg;
                    let tracks = [...state.tracks];

                    if (targetTrackId) {
                        const exists = tracks.some(t => t.id === targetTrackId);
                        if (!exists) targetTrackId = null;
                    }

                    if (!targetTrackId) {
                        const track = tracks.find(t => t.type === finalType);
                        if (track) targetTrackId = track.id;
                        else {
                            const newTrackId = uuidv4();
                            tracks.push({
                                id: newTrackId,
                                type: finalType as TrackType,
                                label: `${finalType} Track`,
                                clips: [],
                                muted: false,
                                hidden: false,
                                locked: false,
                                isMagnetic: false
                            });
                            targetTrackId = newTrackId;
                        }
                    }

                    set((state) => {
                        let currentTracks = tracks;
                        let trackIndex = currentTracks.findIndex(t => t.id === targetTrackId);
                        const track = currentTracks[trackIndex];
                        const duration = durationArg || 5;

                        // Determine start time
                        let start = startTime;
                        if (start === undefined) {
                            start = 0;
                            const sortedClips = [...track.clips].sort((a, b) => a.start - b.start);
                            for (const clip of sortedClips) {
                                if (start + duration <= clip.start) break;
                                start = Math.max(start, clip.start + clip.duration);
                            }
                        } else {
                            const hasCollision = track.clips.some(c => {
                                const cEnd = c.start + c.duration;
                                const newEnd = start! + duration;
                                return (start! < cEnd && newEnd > c.start);
                            });
                            if (hasCollision) return {};
                        }

                        const newClip: Clip = {
                            id,
                            trackId: targetTrackId!,
                            type: finalType as any,
                            source: url!,
                            path: path || (file ? undefined : url!),
                            name: file ? file.name : (contentArg || (finalType === 'text' ? 'New Text' : 'Media Asset')),
                            content: finalType === 'text' ? (contentArg || (file ? file.name : (finalType === 'text' ? 'New Text' : 'Media Asset'))) : undefined,
                            start,
                            duration,
                            trimStart: 0,
                            speed: 1.0,
                            layer: track.type === 'video' ? 0 : 10,
                            // CENTERED INITIAL POSITION
                            transform: { x: initialX, y: initialY, width: defaultW, height: defaultH, scale: 1, rotation: 0, opacity: 1, flipX: false, flipY: false },
                            style: {
                                blendMode: 'normal',
                                stroke: { width: 0, color: '#000000' },
                                shadow: { blur: 0, color: '#000000', offset: 0 },
                                fontFamily: 'Arial',
                                fontSize: 40,
                                color: '#ffffff',
                                fontWeight: 'normal',
                                fontStyle: 'normal',
                                textAlign: 'center',
                                letterSpacing: 0,
                                lineHeight: 1.2,
                                backgroundColor: 'transparent',
                                ...styleArg
                            },
                            filter: { brightness: 1, contrast: 1, saturation: 1, hue: 0, blur: 0 },
                            audio: { volume: 1, muted: false, pan: 0, fadeIn: 0, fadeOut: 0 },
                            transitionIn: { type: 'none', duration: 0.5 },
                            transitionOut: { type: 'none', duration: 0.5 },
                            keyframes: []
                        };

                        // Handle media metadata loading
                        if (finalType === 'video' || finalType === 'audio') {
                            const mediaEl = finalType === 'audio' ? document.createElement('audio') : document.createElement('video');
                            mediaEl.src = url!;
                            mediaEl.onloadedmetadata = () => {
                                set(s => {
                                    const tIndex = s.tracks.findIndex(t => t.id === targetTrackId);
                                    if (tIndex === -1) return {};
                                    const t = s.tracks[tIndex];
                                    const cIndex = t.clips.findIndex(c => c.id === id);
                                    if (cIndex === -1) return {};

                                    const w = (finalType === 'video' ? (mediaEl as HTMLVideoElement).videoWidth : 0) || 0;
                                    const h = (finalType === 'video' ? (mediaEl as HTMLVideoElement).videoHeight : 0) || 0;

                                    // Auto-Fill Logic
                                    const [sW, sH] = s.aspectRatio === '9:16' ? [1080, 1920] : [1920, 1080];
                                    let scale = 1;
                                    const cX = (sW - w) / 2;
                                    const cY = (sH - h) / 2;

                                    if (w > 0 && h > 0) {
                                        scale = Math.max(sW / w, sH / h);
                                    }

                                    const updatedClip = {
                                        ...t.clips[cIndex],
                                        duration: mediaEl.duration || t.clips[cIndex].duration,
                                        transform: { ...t.clips[cIndex].transform, width: w, height: h, scale, x: cX, y: cY }
                                    };

                                    const hasCollision = t.clips.some(c => {
                                        if (c.id === id) return false;
                                        const cEnd = c.start + c.duration;
                                        const newEnd = updatedClip.start + updatedClip.duration;
                                        return (updatedClip.start < cEnd && newEnd > c.start);
                                    });

                                    if (hasCollision) return {};

                                    const newClips = [...t.clips];
                                    newClips[cIndex] = updatedClip;
                                    const newTracks = [...s.tracks];
                                    newTracks[tIndex] = { ...t, clips: newClips };
                                    return { tracks: newTracks };
                                });
                            };
                        } else if (finalType === 'image') {
                            const img = new Image();
                            img.src = url!;
                            img.onload = () => {
                                set(s => {
                                    const tIndex = s.tracks.findIndex(t => t.id === targetTrackId);
                                    if (tIndex === -1) return {};
                                    const t = s.tracks[tIndex];
                                    const cIndex = t.clips.findIndex(c => c.id === id);
                                    if (cIndex === -1) return {};

                                    const w = img.naturalWidth || 0;
                                    const h = img.naturalHeight || 0;
                                    const [sW, sH] = s.aspectRatio === '9:16' ? [1080, 1920] : [1920, 1080];

                                    let scale = 1;
                                    let cX = (sW - w) / 2;
                                    let cY = (sH - h) / 2;

                                    if (w > 0 && h > 0) {
                                        scale = Math.max(sW / w, sH / h);
                                    }

                                    const updatedClip = {
                                        ...t.clips[cIndex],
                                        transform: { ...t.clips[cIndex].transform, width: w, height: h, scale, x: cX, y: cY }
                                    };

                                    const newClips = [...t.clips];
                                    newClips[cIndex] = updatedClip;
                                    const newTracks = [...s.tracks];
                                    newTracks[tIndex] = { ...t, clips: newClips };
                                    return { tracks: newTracks };
                                });
                            };
                        } else if (finalType === 'sticker') {
                            const img = new Image();
                            img.onload = () => {
                                set(s => {
                                    const tIndex = s.tracks.findIndex(t => t.id === targetTrackId);
                                    if (tIndex === -1) return {};
                                    const t = s.tracks[tIndex];
                                    const cIndex = t.clips.findIndex(c => c.id === id);
                                    if (cIndex === -1) return {};

                                    const w = img.naturalWidth || 0;
                                    const h = img.naturalHeight || 0;
                                    const [sW, sH] = s.aspectRatio === '9:16' ? [1080, 1920] : [1920, 1080];

                                    // Scale to Fill
                                    let scale = 1;
                                    const cX = (sW - w) / 2;
                                    const cY = (sH - h) / 2;

                                    if (w > 0 && h > 0) {
                                        scale = Math.max(sW / w, sH / h);
                                    }

                                    const updatedClip = {
                                        ...t.clips[cIndex],
                                        sourceDimensions: { width: w, height: h },
                                        transform: { ...t.clips[cIndex].transform, width: w, height: h, scale, x: cX, y: cY }
                                    };

                                    const newClips = [...t.clips];
                                    newClips[cIndex] = updatedClip;
                                    const newTracks = [...s.tracks];
                                    newTracks[tIndex] = { ...t, clips: newClips };
                                    return { tracks: newTracks };
                                });
                            };
                            img.src = url!;
                        }

                        const newTracks = [...currentTracks];
                        newTracks[trackIndex] = { ...track, clips: [...track.clips, newClip] };

                        const allClips = newTracks.flatMap(t => t.clips);
                        const maxTime = Math.max(...allClips.map(c => c.start + c.duration), 0);

                        return { tracks: newTracks, duration: Math.max(60, maxTime + 5) };
                    });

                    return { id, trackId: targetTrackId! };
                },

                addClipFromUrl: (url: string, type: TrackType) => {
                    get().addClip('main-video', null, url, type);
                },

                removeClip: (trackId: string, clipId: string) => set((state) => {
                    const trackIndex = state.tracks.findIndex(t => t.id === trackId);
                    if (trackIndex === -1) return {};
                    const track = state.tracks[trackIndex];
                    const clipToRemove = track.clips.find(c => c.id === clipId);
                    if (!clipToRemove) return {};

                    let newClips = track.clips.filter(c => c.id !== clipId);

                    if (track.isMagnetic) {
                        const gapSize = clipToRemove.duration;
                        newClips = newClips.map(c => {
                            if (c.start > clipToRemove.start) {
                                return { ...c, start: c.start - gapSize };
                            }
                            return c;
                        });
                    }

                    let newTracks = [...state.tracks];
                    newTracks[trackIndex] = { ...track, clips: newClips };

                    if (newClips.length === 0 && !track.isDefault) {
                        newTracks = newTracks.filter(t => t.id !== trackId);
                    }

                    // Recalculate duration
                    const allClips = newTracks.flatMap(t => t.clips);
                    const maxTime = Math.max(...allClips.map(c => c.start + c.duration), 0);

                    return { tracks: newTracks, selectedClipId: null, duration: Math.max(60, maxTime + 5) };
                }),

                moveClip: (trackId: string, clipId: string, newStart: number, newTrackId?: string) => set((state) => {
                    const sourceTrackIndex = state.tracks.findIndex(t => t.id === trackId);
                    if (sourceTrackIndex === -1) return {};

                    const targetTrackId = newTrackId || trackId;
                    const targetTrackIndex = state.tracks.findIndex(t => t.id === targetTrackId);
                    if (targetTrackIndex === -1) return {};

                    const sourceTrack = state.tracks[sourceTrackIndex];
                    const targetTrack = state.tracks[targetTrackIndex];

                    if (sourceTrack.type !== targetTrack.type) return {};

                    const clipIndex = sourceTrack.clips.findIndex(c => c.id === clipId);
                    if (clipIndex === -1) return {};

                    const clip = sourceTrack.clips[clipIndex];
                    const duration = clip.duration;
                    let finalStart = Math.max(0, newStart);

                    const overlappingClip = targetTrack.clips.find(c => {
                        if (c.id === clipId) return false;
                        return (finalStart < c.start + c.duration && finalStart + duration > c.start);
                    });

                    if (overlappingClip) {
                        const pushRight = overlappingClip.start + overlappingClip.duration;
                        const pushLeft = Math.max(0, overlappingClip.start - duration);
                        if (Math.abs(finalStart - pushLeft) < Math.abs(finalStart - pushRight)) {
                            finalStart = pushLeft;
                        } else {
                            finalStart = pushRight;
                        }
                    } else {
                        const SNAP_THRESHOLD = 0.5;
                        let minDiff = SNAP_THRESHOLD;
                        for (const c of targetTrack.clips) {
                            if (c.id === clipId) continue;
                            const cEnd = c.start + c.duration;
                            if (Math.abs(finalStart - cEnd) < minDiff) { finalStart = cEnd; minDiff = Math.abs(finalStart - cEnd); }
                            if (Math.abs(finalStart + duration - c.start) < minDiff) { finalStart = Math.max(0, c.start - duration); minDiff = Math.abs(finalStart + duration - c.start); }
                        }
                    }

                    const hasCollision = targetTrack.clips.some(c => {
                        if (c.id === clipId) return false;
                        return (finalStart < c.start + c.duration && finalStart + duration > c.start);
                    });
                    if (hasCollision) return {};

                    const newTracks = [...state.tracks];
                    if (trackId === targetTrackId) {
                        const newClips = [...sourceTrack.clips];
                        newClips[clipIndex] = { ...clip, start: finalStart };
                        newTracks[sourceTrackIndex] = { ...sourceTrack, clips: newClips };
                    } else {
                        const newSourceClips = sourceTrack.clips.filter(c => c.id !== clipId);
                        const newTargetClips = [...targetTrack.clips, { ...clip, trackId: targetTrackId, start: finalStart }];
                        newTracks[sourceTrackIndex] = { ...sourceTrack, clips: newSourceClips };
                        newTracks[targetTrackIndex] = { ...targetTrack, clips: newTargetClips };
                    }
                    const maxTime = Math.max(...newTracks.flatMap(t => t.clips).map(c => c.start + c.duration), 0);
                    return { tracks: newTracks, duration: Math.max(60, maxTime + 5) };
                }),

                resizeClip: (trackId: string, clipId: string, newStart: number, newDuration: number, newTrimStart: number) => set((state) => {
                    const trackIndex = state.tracks.findIndex(t => t.id === trackId);
                    if (trackIndex === -1) return {};
                    const track = state.tracks[trackIndex];
                    const clipIndex = track.clips.findIndex(c => c.id === clipId);
                    if (clipIndex === -1) return {};

                    const originalClip = track.clips[clipIndex];
                    let minAllowedStart = 0;
                    let maxAllowedEnd = Infinity;

                    for (const c of track.clips) {
                        if (c.id === clipId) continue;
                        const cEnd = c.start + c.duration;
                        if (cEnd <= originalClip.start + 0.01) {
                            minAllowedStart = Math.max(minAllowedStart, cEnd);
                        }
                        if (c.start >= originalClip.start + originalClip.duration - 0.01) {
                            maxAllowedEnd = Math.min(maxAllowedEnd, c.start);
                        }
                    }

                    const finalStart = Math.max(minAllowedStart, newStart);
                    const finalEnd = Math.min(maxAllowedEnd, finalStart + newDuration);
                    const finalDuration = Math.max(0.1, finalEnd - finalStart);

                    const updatedClip = { ...originalClip, start: finalStart, duration: finalDuration, trimStart: Math.max(0, newTrimStart) };
                    const newClips = [...track.clips];
                    newClips[clipIndex] = updatedClip;
                    const newTracks = [...state.tracks];
                    newTracks[trackIndex] = { ...track, clips: newClips };

                    const maxTime = Math.max(...newTracks.flatMap(t => t.clips).map(c => c.start + c.duration), 0);
                    return { tracks: newTracks, duration: Math.max(60, maxTime + 5) };
                }),

                splitClip: (trackId: string, clipId: string, time: number) => set((state) => {
                    const trackIndex = state.tracks.findIndex(t => t.id === trackId);
                    if (trackIndex === -1) return {};
                    const track = state.tracks[trackIndex];
                    const clipIndex = track.clips.findIndex(c => c.id === clipId);
                    if (clipIndex === -1) return {};

                    const clip = track.clips[clipIndex];
                    if (time <= clip.start || time >= clip.start + clip.duration) return {};

                    const newClip1 = { ...clip, duration: time - clip.start };
                    const newClip2 = {
                        ...clip,
                        id: uuidv4(),
                        start: time,
                        duration: clip.start + clip.duration - time,
                        trimStart: clip.trimStart + (time - clip.start) * clip.speed
                    };

                    const newClips = [...track.clips];
                    newClips.splice(clipIndex, 1, newClip1, newClip2);

                    const newTracks = [...state.tracks];
                    newTracks[trackIndex] = { ...track, clips: newClips };

                    return { tracks: newTracks, selectedClipId: newClip2.id };
                }),

                updateClip: (trackId: string, clipId: string, updates: Partial<Clip>) => set((state) => {
                    const trackIndex = state.tracks.findIndex(t => t.id === trackId);
                    if (trackIndex === -1) return {};
                    const track = state.tracks[trackIndex];
                    const clipIndex = track.clips.findIndex(c => c.id === clipId);
                    if (clipIndex === -1) return {};

                    const updatedClip = { ...track.clips[clipIndex], ...updates };
                    const newClips = [...track.clips];
                    newClips[clipIndex] = updatedClip;

                    const newTracks = [...state.tracks];
                    newTracks[trackIndex] = { ...track, clips: newClips };
                    return { tracks: newTracks };
                }),

                setClipSpeed: (trackId: string, clipId: string, speed: number) => set((state) => {
                    // Implementation for setClipSpeed
                    return {};
                }),

                detachAudio: (trackId: string, clipId: string) => set((state) => {
                    // Implementation for detachAudio
                    return {};
                }),

                updateClipWaveform: (trackId: string, clipId: string, waveform: number[]) => set((state) => {
                    // Implementation for updateClipWaveform
                    return {};
                }),

                addTransition: (trackId: string, clipId: string, transition: any) => set((state) => {
                    const trackIndex = state.tracks.findIndex(t => t.id === trackId);
                    if (trackIndex === -1) return {};
                    const track = state.tracks[trackIndex];
                    const newClips = track.clips.map(c => c.id === clipId ? { ...c, transitionIn: { ...c.transitionIn, ...transition } } : c);
                    const newTracks = [...state.tracks];
                    newTracks[trackIndex] = { ...track, clips: newClips };
                    return { tracks: newTracks };
                }),

                applyFilter: (trackId: string, clipId: string, filter: any) => set((state) => {
                    const trackIndex = state.tracks.findIndex(t => t.id === trackId);
                    if (trackIndex === -1) return {};
                    const track = state.tracks[trackIndex];
                    const newClips = track.clips.map(c => c.id === clipId ? { ...c, filter: { ...c.filter, ...filter } } : c);
                    const newTracks = [...state.tracks];
                    newTracks[trackIndex] = { ...track, clips: newClips };
                    return { tracks: newTracks };
                }),

                syncVideoToAudio: (videoTrackId: string, audioTrackId: string) => set((state) => {
                    // Placeholder for sync logic
                    return {};
                }),

                addAsset: (asset: Asset) => set((state) => ({ assets: [...state.assets, asset] })),
                removeAsset: (assetId: string) => set((state) => ({ assets: state.assets.filter(a => a.id !== assetId) })),
                setCurrentTime: (time: number | ((prev: number) => number)) => set((state) => ({
                    currentTime: typeof time === 'function' ? (time as ((prev: number) => number))(state.currentTime) : time
                })),
                setIsPlaying: (isPlaying: boolean) => set({ isPlaying }),
                setScale: (scale: number) => set({ scale }),
                setSelectedClipId: (clipId: string | null) => set({ selectedClipId: clipId }),
                setAspectRatio: (ratio: '9:16' | '16:9') => set({ aspectRatio: ratio }),
                setCanvasMode: (mode: 'shorts' | 'wide') => set({ canvasMode: mode }),
                setPreviewScale: (scale: number) => set({ previewScale: scale }),
                setSubtitleConfig: (config: any) => set((state) => ({ subtitleConfig: { ...state.subtitleConfig, ...config } })),
                setTTSConfig: (config: any) => set((state) => ({ ttsConfig: { ...state.ttsConfig, ...config } })),

                saveTemplate: (name: string) => {
                    const state = get();
                    const template: Template = {
                        id: uuidv4(),
                        name,
                        thumbnail: '',
                        tracks: state.tracks,
                        duration: state.duration,
                        aspectRatio: state.aspectRatio,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    };
                    set((state) => ({ templates: [...state.templates, template] }));
                },

                applyTemplate: (templateId: string) => {
                    const state = get();
                    const template = state.templates.find(t => t.id === templateId);
                    if (template) {
                        set({
                            tracks: template.tracks.map(t => ({ ...t, id: uuidv4(), clips: t.clips.map(c => ({ ...c, id: uuidv4(), trackId: t.id })) })),
                            duration: template.duration,
                            aspectRatio: template.aspectRatio,
                        });
                    }
                },

                fetchTemplates: async () => {
                    try {
                        const res = await axios.get('/api/editor/templates');
                        set({ templates: res.data });
                    } catch (error) { console.error('Failed to fetch templates:', error); }
                },

                saveTemplateRemote: async (name: string) => {
                    const state = get();
                    const templateData = {
                        name,
                        tracks: state.tracks,
                        duration: state.duration,
                        aspectRatio: state.aspectRatio,
                    };
                    try {
                        const res = await axios.post('/api/editor/templates', templateData);
                        set((state) => ({ templates: [...state.templates, res.data] }));
                    } catch (error) { console.error('Failed to save template:', error); }
                },

                deleteTemplateRemote: async (templateId: string) => {
                    // Implementation
                },

                generateCaptionsFromAudio: async (audioClipId: string, language: string = 'auto', model: string = 'base', script?: string) => {
                    const state = get();
                    let audioClip: Clip | undefined;
                    for (const track of state.tracks) {
                        const c = track.clips.find(c => c.id === audioClipId);
                        if (c) { audioClip = c; break; }
                    }
                    if (!audioClip) return;

                    try {
                        let res;
                        const audioPath = audioClip.path || audioClip.source;

                        // Strategy: Try Server Path first (if plausible), then fallback to specific Upload
                        let uploadNeeded = true;

                        // 1. Try Path Strategy if we have a path that looks like a file path (not a URL)
                        if (audioClip.path && !audioClip.path.startsWith('blob:') && !audioClip.path.startsWith('http')) {
                            try {
                                console.log('[Captions] Attempting server-side path extraction:', audioClip.path);
                                res = await axios.post('/api/tools/subtitle/extract-from-path', {
                                    audio_path: audioClip.path,
                                    language,
                                    model,
                                });
                                uploadNeeded = false; // Success!
                            } catch (pathError) {
                                console.warn('[Captions] Server path extraction failed (404/etc), falling back to upload:', pathError);
                                uploadNeeded = true;
                            }
                        }

                        // 2. Upload Strategy (Fallback or Primary)
                        if (uploadNeeded) {
                            console.log('[Captions] Starting file upload strategy...');
                            const source = audioClip.source || "";
                            if (!source) throw new Error("No source URL available for clip");

                            // Fetch the audio data (supports Blob URLs and standard URLs)
                            const blobRes = await fetch(source);
                            if (!blobRes.ok) throw new Error(`Failed to fetch source: ${blobRes.statusText}`);

                            const blob = await blobRes.blob();
                            // Sanitize filename
                            const safeType = blob.type.split('/')[1] || 'mp3';
                            const file = new File([blob], `audio_${audioClip.id}.${safeType}`, { type: blob.type });

                            const formData = new FormData();
                            formData.append('file', file);
                            formData.append('language', language);
                            formData.append('model', model);

                            console.log('[Captions] Uploading file to /api/tools/subtitle/extract...');
                            res = await axios.post('/api/tools/subtitle/extract', formData, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                            });
                        }

                        let finalSrt = "";
                        let finalSubtitles = [];

                        if (res?.data?.status === 'success') {
                            finalSrt = res.data.srt_content;
                            finalSubtitles = res.data.subtitles || []; // Ensure array

                            // Align if script provided
                            if (script && script.trim().length > 0) {
                                try {
                                    // Note: If we uploaded, the server response should ideally return the 'server_path' of the temp file
                                    // So we can use it for alignment.
                                    // tools.py extract returns: { status, srt_content, web_url, server_path }
                                    const tempServerPath = res.data.server_path || audioPath;

                                    const alignRes = await axios.post('/api/tools/subtitle/align', {
                                        script: script,
                                        audio_path: tempServerPath, // Use the path derived from the operation
                                        srt_content: finalSrt
                                    });
                                    if (alignRes.data.step2) {
                                        finalSrt = alignRes.data.step2;
                                    }
                                } catch (alignError) {
                                    console.warn("Alignment failed, falling back to original transcription", alignError);
                                }
                            }
                        } else {
                            throw new Error("Caption generation failed: No success status returned");
                        }

                        // 1. Find target track (Prioritize 'Caption' track, then any text track)
                        let captionTrack = state.tracks.find(t => t.label === '자막' && t.type === 'text');
                        if (!captionTrack) captionTrack = state.tracks.find(t => t.type === 'text');

                        let newTracks = [...state.tracks];

                        if (!captionTrack) {
                            const newTrackId = uuidv4();
                            captionTrack = {
                                id: newTrackId,
                                type: 'text',
                                label: '자막',
                                clips: [],
                                muted: false,
                                hidden: false,
                                locked: false,
                                isMagnetic: false,
                                isDefault: true
                            };
                            newTracks.unshift(captionTrack);
                        }

                        // 2. Base Timing Info
                        const audioStart = audioClip.start || 0;
                        const audioTrimStart = audioClip.trimStart || 0;
                        const audioDuration = audioClip.duration; // Timeline duration is the source of truth
                        // Actually, we just need to map (file_time) -> (timeline_time)
                        // timeline_time = audioStart + (file_time - audioTrimStart)

                        const captionClips: Clip[] = [];

                        const config = state.captionConfig || {}; // Define config here
                        const splitLimit = config.splitLimit || 20;

                        finalSubtitles.forEach((sub: any) => {
                            // 1. Filter out invalid times relative to audio clip
                            if (sub.end < audioTrimStart) return;

                            const relativeStart = sub.start - audioTrimStart;
                            const relativeEnd = sub.end - audioTrimStart;
                            const totalSubDuration = relativeEnd - relativeStart;

                            // Skip if invisible
                            if (totalSubDuration <= 0) return;

                            // 2. Split Logic
                            const text = sub.text || "";
                            let segments: { text: string, start: number, duration: number }[] = [];

                            if (text.length > splitLimit) {
                                // Split into chunks
                                const chunks: string[] = [];
                                let currentText = text;
                                while (currentText.length > splitLimit) {
                                    let splitIndex = currentText.lastIndexOf(' ', splitLimit);
                                    if (splitIndex === -1) splitIndex = splitLimit; // Force split

                                    chunks.push(currentText.substring(0, splitIndex).trim());
                                    currentText = currentText.substring(splitIndex).trim();
                                }
                                if (currentText) chunks.push(currentText);

                                // Distribute Duration
                                let currentRelStart = relativeStart;
                                const totalChars = text.length; // Approximate weight

                                chunks.forEach((chunk) => {
                                    // If totalChars is 0 (empty node?), prevent NaN
                                    const weight = totalChars > 0 ? (chunk.length / totalChars) : (1 / chunks.length);
                                    const chunkDuration = totalSubDuration * weight;

                                    segments.push({
                                        text: chunk,
                                        start: currentRelStart,
                                        duration: chunkDuration
                                    });
                                    currentRelStart += chunkDuration;
                                });
                            } else {
                                segments.push({
                                    text: text,
                                    start: relativeStart,
                                    duration: totalSubDuration
                                });
                            }

                            // 3. Create Clips for Segments
                            segments.forEach(seg => {
                                const clipStart = audioStart + seg.start;
                                const clipDuration = seg.duration;

                                // Calculate Position (Y in Pixels)
                                let posY = 0;
                                const stageH = state.aspectRatio === '9:16' ? 1920 : 1080;
                                const margin = config.marginV || 50;

                                if (config.position === 'top') posY = margin + 100;
                                else if (config.position === 'middle') posY = stageH / 2;
                                else posY = stageH - margin - 100; // bottom

                                const newClip: Clip = {
                                    id: uuidv4(),
                                    trackId: captionTrack!.id,
                                    type: 'caption', // Distinct type
                                    name: 'Caption',
                                    content: seg.text,
                                    source: '', // Added missing
                                    keyframes: [], // Added missing
                                    start: clipStart,
                                    duration: clipDuration,
                                    trimStart: 0,
                                    speed: 1,
                                    layer: 2,
                                    transform: {
                                        x: 0,
                                        y: posY,
                                        width: 800, // Default width
                                        height: 100,
                                        scale: 1,
                                        rotation: 0,
                                        opacity: 1,
                                        flipX: false,
                                        flipY: false
                                    },
                                    style: {
                                        fontFamily: config.font || 'Nanum Gothic',
                                        fontSize: config.fontSize || 40,
                                        color: config.textColor || '#ffffff',
                                        backgroundColor: config.useBox ? config.boxColor : 'transparent',
                                        stroke: {
                                            width: config.outlineSize || 0,
                                            color: config.outlineColor || '#000000'
                                        },
                                        shadow: {
                                            blur: config.shadowSize || 0,
                                            color: config.shadowColor || '#000000',
                                            offset: 2
                                        },
                                        fontWeight: config.isBold ? 'bold' : 'normal',
                                        fontStyle: config.isItalic ? 'italic' : 'normal',
                                        blendMode: 'normal',
                                        textAlign: 'center', // Enforce Center Default
                                        // New
                                        animationEntrance: config.animationEntrance,
                                        animationExit: config.animationExit,
                                        animationEmphasis: config.animationEmphasis,
                                        marginV: config.marginV,
                                        positionPreset: config.position as 'top' | 'middle' | 'bottom'
                                    },
                                    transitionIn: { type: config.animationEntrance || 'none', duration: 0.5 },
                                    transitionOut: { type: config.animationExit || 'none', duration: 0.5 },
                                    filter: { brightness: 1, contrast: 1, saturation: 1, hue: 0, blur: 0 },
                                    audio: { volume: 0, muted: true, pan: 0, fadeIn: 0, fadeOut: 0 },
                                    // Optional fields as per previous logic (keyframes etc)
                                };
                                captionClips.push(newClip);
                            });
                        });

                        const trackIndex = newTracks.findIndex(t => t.id === captionTrack!.id);
                        newTracks[trackIndex] = { ...captionTrack, clips: [...captionTrack.clips, ...captionClips] };
                        set({ tracks: newTracks });

                    } catch (error) {
                        console.error('Failed to generate captions:', error);
                    }
                },
                setClips: (trackId: string, clips: Clip[]) => set((state) => {
                    const trackIndex = state.tracks.findIndex(t => t.id === trackId);
                    if (trackIndex === -1) return {};
                    const newTracks = [...state.tracks];
                    newTracks[trackIndex] = { ...state.tracks[trackIndex], clips };
                    return { tracks: newTracks };
                }),
                resetEditor: () => set((state) => ({
                    tracks: [
                        { id: uuidv4(), type: 'text', label: '자막', clips: [], muted: false, hidden: false, locked: false, isMagnetic: false, isDefault: true },
                        { id: uuidv4(), type: 'text', label: '텍스트', clips: [], muted: false, hidden: false, locked: false, isMagnetic: false, isDefault: true },
                        { id: uuidv4(), type: 'image', label: '이미지', clips: [], muted: false, hidden: false, locked: false, isMagnetic: false, isDefault: true },
                        { id: 'main-video', type: 'video', label: '메인 동영상', clips: [], muted: false, hidden: false, locked: false, isMagnetic: true, isDefault: true },
                        { id: uuidv4(), type: 'audio', label: '오디오', clips: [], muted: false, hidden: false, locked: false, isMagnetic: false, isDefault: true },
                    ],
                    assets: state.assets,
                    currentTime: 0,
                    selectedClipId: null,
                    copiedClip: null
                })),
            }),
            {
                name: 'editor-storage-v2', // Changed to v2 to force reset
                storage: createJSONStorage(() => localStorage),
                partialize: (state) => ({
                    tracks: state.tracks,
                    duration: state.duration,
                    aspectRatio: state.aspectRatio,
                    templates: state.templates,
                    assets: state.assets,
                    subtitleConfig: state.subtitleConfig,
                    ttsConfig: state.ttsConfig,
                    captionConfig: state.captionConfig,
                }),
            }
        )
    )
);
