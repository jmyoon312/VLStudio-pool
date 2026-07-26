import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { apiLong } from '@/lib/api';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
    Loader2, ImageIcon, Music, Film, Upload, Download, Clapperboard, Plus, Trash2,
    Sparkles, Copy, ChevronDown, ChevronUp, RefreshCw, Save, Wand2, RotateCcw, Play,
    MonitorPlay, Smartphone, Eye, EyeOff, Mic, DollarSign, Globe
} from "lucide-react";
import TTSSettingsDialog from '@/components/TTSSettingsDialog';
import MotionSettingsDialog from '@/components/MotionSettingsDialog';
import SubtitleSettingsDialog, { SubtitleConfig } from '@/components/SubtitleSettingsDialog';
import AudioSettingsDialog, { AudioConfig } from '@/components/AudioSettingsDialog';
import { v4 as uuidv4 } from 'uuid';
import AIModelSelector from '@/components/shared/AIModelSelector';
import { StyleGalleryModal } from '@/components/shared/StyleGalleryModal';
import { ExportModal } from '../features/flow2capcut/components/ExportModal';
import { generateCapcutProject } from '../features/flow2capcut/exporters/capcutLocalGenerator';
import { generateSRT } from '../features/flow2capcut/exporters/capcut';

interface SceneSegment {
    id: string; // Unique ID for frontend tracking
    scene_id: number; // Display number (1-based index)
    script: string;
    visual_prompt: string;
    video_prompt?: string; // [NEW] Prompt strictly for video motion
    is_continuous_motion?: boolean; // [NEW] Flag to use previous scene's last frame
    media_url?: string; // Source Image URL
    media_path?: string; // Absolute path on server (Image)
    task_id?: string;
    status?: 'idle' | 'generating' | 'completed' | 'failed';
    progress?: number;
    audio_url?: string;
    audio_path?: string; // Absolute path on server (Audio)
    video_url?: string; // Rendered Video URL
    video_path?: string; // Absolute path on server (Video)

    // Decoupled Statuses
    audioStatus?: 'idle' | 'generating' | 'completed' | 'failed';
    visualStatus?: 'idle' | 'generating' | 'completed' | 'failed';
    renderStatus?: 'idle' | 'generating' | 'completed' | 'failed';

    // View State
    viewMode?: 'source' | 'render'; // Controls which media is shown

    // Manual Asset Override
    is_manual_asset?: boolean;
    frozen_effect?: string; // static, zoom, pan_left, pan_right
    asset_score?: number;
}

interface ScriptStyle {
    id: number;
    name: string;
    system_instruction: string;
    sample_text?: string;
}

const DEFAULT_MODEL_OPTIONS = {
    // Legacy: Kept for reference if needed, but AIModelSelector uses its own.
};

const CreativeStudio = () => {
    const [selectedPresetId, setSelectedPresetId] = useState<string>("");
    const [presetName, setPresetName] = useState("");
    const [stylePrompt, setStylePrompt] = useState("");
    const [negativePrompt, setNegativePrompt] = useState("");
    const queryClient = useQueryClient();

    // Fetch Presets
    const { data: presets } = useQuery({
        queryKey: ['stylePresets'],
        queryFn: async () => (await api.get('/creative/styles')).data
    });

    // Mutations
    const createPresetMutation = useMutation({
        mutationFn: async (data: any) => (await api.post('/creative/styles', data)).data,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['stylePresets'] });
            setSelectedPresetId(String(data.id));
            toast.success("스타일 프리셋 저장 완료!");
        }
    });

    const updatePresetMutation = useMutation({
        mutationFn: async (data: any) => (await api.put(`/creative/styles/${selectedPresetId}`, data)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stylePresets'] });
            toast.success("스타일 프리셋 수정 완료!");
        }
    });

    const deletePresetMutation = useMutation({
        mutationFn: async (id: number) => (await api.delete(`/creative/styles/${id}`)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stylePresets'] });
            handleNewPreset();
            toast.success("스타일 프리셋 삭제 완료!");
        }
    });

    // Handlers
    const handleSelectPreset = (val: string) => {
        if (val === "new") {
            handleNewPreset();
            return;
        }
        const preset = presets.find((p: any) => String(p.id) === val);
        if (preset) {
            setSelectedPresetId(String(preset.id));
            setPresetName(preset.name);
            setStylePrompt(preset.positive_prompt);
            setNegativePrompt(preset.negative_prompt || "");
        }
    };

    const handleNewPreset = () => {
        setSelectedPresetId("new");
        setPresetName("");
        setStylePrompt("");
        setNegativePrompt("");
    };

    const handleSavePreset = () => {
        const payload = {
            name: presetName,
            positive_prompt: stylePrompt,
            negative_prompt: negativePrompt
        };

        if (selectedPresetId && selectedPresetId !== "new") {
            updatePresetMutation.mutate(payload);
        } else {
            createPresetMutation.mutate(payload);
        }
    };

    const handleDeletePreset = (id: number) => {
        if (confirm("정말 이 프리셋을 삭제하시겠습니까?")) {
            deletePresetMutation.mutate(id);
        }
    };

    // Style Analysis
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const analyzeStyleMutation = useMutation({
        mutationFn: async (data: { file: File, provider: string, model: string }) => {
            const formData = new FormData();
            formData.append('file', data.file);
            formData.append('provider', data.provider);
            formData.append('model', data.model);

            const res = await api.post('/creative/analyze-style', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return res.data;
        },
        onSuccess: (data) => {
            setStylePrompt(data.style_prompt);
            setNegativePrompt(data.negative_prompt);
            toast.success("스타일 분석 완료!");
        },
        onError: (err) => {
            toast.error("스타일 분석 실패: " + err);
        }
    });

    const handleAnalyzeStyle = (file: File) => {
        setIsAnalyzing(true);
        analyzeStyleMutation.mutate({
            file,
            provider: scriptProvider,
            model: scriptModel
        }, {
            onSettled: () => setIsAnalyzing(false)
        });
    };

    // State: Script Workspace
    const [scriptMode, setScriptMode] = useState("manual"); // Default to Manual
    const [fullScript, setFullScript] = useState(() => {
        return localStorage.getItem('viral_loop_creative_full_script') || "";
    });
    const [scriptProvider, setScriptProvider] = useState<string>("groq");
    const [scriptModel, setScriptModel] = useState<string>("llama-3.3-70b-versatile");

    // State: Script Styles
    const [scriptStyles, setScriptStyles] = useState<ScriptStyle[]>([]);
    const [selectedStyleId, setSelectedStyleId] = useState<string>("");
    const [scriptInput, setScriptInput] = useState(() => {
        return localStorage.getItem('viral_loop_creative_script_input') || "";
    });
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [useWebSearchCreative, setUseWebSearchCreative] = useState<boolean>(true);

    // Auto-save script drafts to localStorage
    useEffect(() => {
        localStorage.setItem('viral_loop_creative_full_script', fullScript);
    }, [fullScript]);

    useEffect(() => {
        localStorage.setItem('viral_loop_creative_script_input', scriptInput);
    }, [scriptInput]);

    // Style Management Dialog
    const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false);
    const [editingStyle, setEditingStyle] = useState<Partial<ScriptStyle>>({ name: "", system_instruction: "", sample_text: "" });

    // Fetch Script Styles
    const { data: fetchedScriptStyles, refetch: refetchScriptStyles } = useQuery({
        queryKey: ['scriptStyles'],
        queryFn: async () => {
            const res = await api.get('/creative/script-styles');
            return res.data;
        }
    });

    // Fetch Available Models


    useEffect(() => {
        if (fetchedScriptStyles) {
            setScriptStyles(fetchedScriptStyles);
        }
    }, [fetchedScriptStyles]);

    // Create/Update Style Mutation
    const saveStyleMutation = useMutation({
        mutationFn: async (style: Partial<ScriptStyle>) => {
            if (style.id) {
                const res = await api.put(`/creative/script-styles/${style.id}`, style);
                return res.data;
            } else {
                const res = await api.post('/creative/script-styles', style);
                return res.data;
            }
        },
        onSuccess: () => {
            toast.success("스타일 저장 완료");
            setIsStyleDialogOpen(false);
            refetchScriptStyles();
        },
        onError: (err: any) => toast.error("스타일 저장 실패: " + err)
    });

    // Delete Style Mutation
    const deleteStyleMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/creative/script-styles/${id}`);
        },
        onSuccess: () => {
            toast.success("스타일 삭제 완료");
            refetchScriptStyles();
            if (selectedStyleId) setSelectedStyleId("");
        },
        onError: (err: any) => toast.error("스타일 삭제 실패: " + err)
    });

    const generateScriptMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post('/creative/generate-script', {
                input_text: scriptInput,
                style_id: selectedStyleId ? Number(selectedStyleId) : null,
                model_name: scriptModel,
                config: { use_web_search: useWebSearchCreative }
            });
            return res.data;
        },
        onSuccess: (data) => {
            setFullScript(data.script);
            toast.success("대본 생성 완료!");
        },
        onError: (err: any) => toast.error("대본 생성 실패: " + err)
    });

    const handleSaveStyle = () => {
        if (!editingStyle.name || !editingStyle.system_instruction) {
            toast.error("이름과 지침을 입력해주세요.");
            return;
        }
        saveStyleMutation.mutate(editingStyle);
    };

    const handleEditStyle = () => {
        if (!selectedStyleId) return;
        const style = scriptStyles.find(s => s.id === Number(selectedStyleId));
        if (style) {
            setEditingStyle(style);
            setIsStyleDialogOpen(true);
        }
    };

    const handleCreateStyle = () => {
        setEditingStyle({ name: "", system_instruction: "", sample_text: "" });
        setIsStyleDialogOpen(true);
    };

    const handleGenerateScript = () => {
        if (!scriptInput) {
            toast.error("입력 내용을 작성해주세요.");
            return;
        }
        setIsGeneratingScript(true);
        generateScriptMutation.mutate(undefined, {
            onSettled: () => setIsGeneratingScript(false)
        });
    };



    // State: Scene Board
    const [scenes, setScenes] = useState<SceneSegment[]>(() => {
        try {
            const saved = localStorage.getItem('viral_loop_creative_scenes');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {
            console.error("Failed to load saved creative scenes:", e);
        }
        return [];
    });
    const [isSegmenting, setIsSegmenting] = useState(false);
    const [splitMethod, setSplitMethod] = useState("ai_smart");
    const [segmentMode, setSegmentMode] = useState(() => {
        return localStorage.getItem('viral_loop_segment_mode') || 'shorts';
    });

    useEffect(() => {
        localStorage.setItem('viral_loop_segment_mode', segmentMode);
    }, [segmentMode]);

    // Auto-save creative scene board to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('viral_loop_creative_scenes', JSON.stringify(scenes));
        } catch (e) {
            console.error("Failed to save creative scenes:", e);
        }
    }, [scenes]);

    // Auto-update aspect ratio in existing prompts when segmentMode changes
    useEffect(() => {
        setScenes(prev => prev.map(scene => {
            if (!scene.visual_prompt) return scene;
            const targetPrefix = segmentMode === 'shorts' ? '9:16' : '16:9';
            const oldPrefix = segmentMode === 'shorts' ? '16:9' : '9:16';
            
            if (scene.visual_prompt.startsWith(oldPrefix)) {
                return {
                    ...scene,
                    visual_prompt: scene.visual_prompt.replace(oldPrefix, targetPrefix)
                };
            }
            return scene;
        }));
    }, [segmentMode]);

    // State: TTS Config
    const [isTTSDialogOpen, setIsTTSDialogOpen] = useState(false);
    const [ttsConfig, setTTSConfig] = useState<any>(() => {
        const defaults = {
            engine: "kokoro",
            language: "ko",
            voice_id: "af_heart",
            speed: 1.0,
            pitch: 0,
            emotion: "normal"
        };
    });

    useEffect(() => {
        localStorage.setItem('viral_loop_tts_config', JSON.stringify(ttsConfig));
    }, [ttsConfig]);

    const [isMotionDialogOpen, setIsMotionDialogOpen] = useState(false);
    const [motionConfig, setMotionConfig] = useState<any>(() => {
        const defaults = {
            enable: true,
            direction: 'random',
            speed: 1.0,
            shake: false
        };
        const saved = localStorage.getItem('viral_loop_motion_config');
        if (saved) {
            try { return { ...defaults, ...JSON.parse(saved) }; } catch (e) { console.error(e); }
        }
        return defaults;
    });

    useEffect(() => {
        localStorage.setItem('viral_loop_motion_config', JSON.stringify(motionConfig));
    }, [motionConfig]);

    // State: Subtitle Config
    const [isSubtitleDialogOpen, setIsSubtitleDialogOpen] = useState(false);
    const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(() => {
        const defaults = {
            enabled: true,
            font: 'Arial',
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
            position: 'bottom',
            marginV: 50,
            customX: 0,
            customY: 0,
            animation: 'none',
            splitLimit: 20,
            maxLines: 2
        };
        const saved = localStorage.getItem('viral_loop_subtitle_config');
        if (saved) {
            try { return { ...defaults, ...JSON.parse(saved) }; } catch (e) { console.error(e); }
        }
        return defaults;
    });

    useEffect(() => {
        localStorage.setItem('viral_loop_subtitle_config', JSON.stringify(subtitleConfig));
    }, [subtitleConfig]);

    const [isAudioDialogOpen, setIsAudioDialogOpen] = useState(false);
    const [audioConfig, setAudioConfig] = useState<AudioConfig>(() => {
        const defaults = {
            keepOriginalAudio: true,
            originalVolume: 50,
        };
        const saved = localStorage.getItem('viral_loop_audio_config');
        if (saved) {
            try { return { ...defaults, ...JSON.parse(saved) }; } catch (e) { console.error(e); }
        }
        return defaults;
    });

    useEffect(() => {
        localStorage.setItem('viral_loop_audio_config', JSON.stringify(audioConfig));
    }, [audioConfig]);

    // State: UI Toggles
    const [isStyleCollapsed, setIsStyleCollapsed] = useState(false);
    const [isScriptCollapsed, setIsScriptCollapsed] = useState(false);
    const [isStyleGalleryOpen, setIsStyleGalleryOpen] = useState(false);
    
    // [NEW] CapCut Export States
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [exportPhase, setExportPhase] = useState<'launching' | 'processing'>('processing');

    // [NEW] Auto-Gen Options
    const [autoGenerateImages, setAutoGenerateImages] = useState(false);
    const [autoGenerateAudio, setAutoGenerateAudio] = useState(false);

    // [NEW] Pacing Options
    const [pacingStrategy, setPacingStrategy] = useState<'ai' | 'rule'>('ai');
    const [pacingUnit, setPacingUnit] = useState<'sentence' | 'time'>('sentence');
    const [pacingValue, setPacingValue] = useState(2);

    // Effect: Set defaults based on Segment Mode (Shorts vs Video)
    useEffect(() => {
        if (segmentMode === 'shorts') {
            // Shorts: 1-2 sentences per image
            setPacingUnit('sentence');
            setPacingValue(2);
        } else {
            // Long-form: ~30s per image
            setPacingUnit('time');
            setPacingValue(30);
        }
    }, [segmentMode]);

    const cleanupMutation = useMutation({
        mutationFn: async (paths: string[]) => {
            await api.post('/creative/cleanup', { file_paths: paths });
        }
    });

    const handleResetScenes = () => {
        if (scenes.length === 0) return;
        if (confirm("정말 모든 씬을 초기화하시겠습니까? 생성된 이미지와 영상 정보가 사라집니다.")) {
            // Collect all paths to clean up
            const pathsToClean: string[] = [];
            scenes.forEach(s => {
                if (s.media_path) pathsToClean.push(s.media_path);
                if (s.audio_path) pathsToClean.push(s.audio_path);
                if (s.video_path) pathsToClean.push(s.video_path);
            });

            if (pathsToClean.length > 0) {
                cleanupMutation.mutate(pathsToClean);
            }

            setScenes([]);
            toast.success("씬 보드가 초기화되었습니다 (파일 정리 완료).");
        }
    };

    // Polling for Video Generation
    useEffect(() => {
        const interval = setInterval(async () => {
            const activeTasks = scenes.filter(s => s.visualStatus === 'generating' && s.task_id);
            if (activeTasks.length === 0) return;

            for (const scene of activeTasks) {
                try {
                    const res = await api.get(`/video/status/${scene.task_id}`);
                    const { status, url, progress } = res.data;

                    if (status === 'succeeded') {
                        updateScene(scene.id, { visualStatus: 'completed', media_url: url, progress: 100 });
                        toast.success(`Scene #${scene.scene_id} 영상 생성 완료!`);
                    } else if (status === 'failed') {
                        updateScene(scene.id, { visualStatus: 'failed', progress: 0 });
                        toast.error(`Scene #${scene.scene_id} 영상 생성 실패.`);
                    } else {
                        updateScene(scene.id, { progress: progress || 0 });
                    }
                } catch (err) {
                    console.error("Polling error:", err);
                }
            }
        }, 5000); // Poll every 5 seconds

        return () => clearInterval(interval);
    }, [scenes]);

    const updateScene = (id: string, updates: Partial<SceneSegment>) => {
        setScenes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    // Mutations
    const segmentScriptMutation = useMutation({
        mutationFn: async (data: { text: string, mode: string, provider: string, model: string, stylePrompt: string, auto_generate_images: boolean, auto_generate_audio: boolean, pacing_config?: any }) => {
            const res = await api.post('/creative/split-script', {
                text: data.text,
                mode: data.mode,
                provider: data.provider,
                model: data.model,
                style_prompt: data.stylePrompt,
                auto_generate_images: data.auto_generate_images,
                auto_generate_audio: data.auto_generate_audio,
                pacing_config: data.pacing_config
            });
            return res.data;
        },
        onSuccess: (data) => {
            setScenes(data.map((s: any) => ({
                ...s,
                id: uuidv4(),
                audioStatus: 'idle',
                visualStatus: 'idle',
                renderStatus: 'idle',
                viewMode: 'source'
            })));
            toast.success(`${data.length}개의 씬으로 분할되었습니다.`);
        },
        onError: (err) => {
            toast.error("씬 분할 실패: " + err);
        }
    });

    const generateVideoMutation = useMutation({
        mutationFn: async (data: { id: string, sceneId: number, prompt: string, model: string, is_continuous_motion?: boolean }) => {
            const aspectRatio = segmentMode === 'shorts' ? "9:16" : "16:9";
            const res = await api.post('/video/generate', {
                prompt: data.prompt,
                model: data.model,
                aspect_ratio: aspectRatio,
                is_continuous_motion: data.is_continuous_motion,
                scene_id: data.sceneId // Send scene_id so backend can fetch previous scene if needed
            });
            return { id: data.id, sceneId: data.sceneId, taskId: res.data.task_id };
        },
        onSuccess: ({ id, sceneId, taskId }) => {
            updateScene(id, { visualStatus: 'generating', task_id: taskId, progress: 0 });
            toast.info(`Scene #${sceneId} 영상 생성을 시작했습니다.`);
        },
        onError: (err, variables) => {
            updateScene(variables.id, { visualStatus: 'failed' });
            toast.error("영상 생성 요청 실패: " + err);
        }
    });

    const uploadVideoMutation = useMutation({
        mutationFn: async (data: { id: string, sceneId: number, file: File }) => {
            const formData = new FormData();
            formData.append('file', data.file);
            const res = await api.post('/video/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return { id: data.id, sceneId: data.sceneId, url: res.data.web_url, path: res.data.server_path };
        },
        onSuccess: ({ id, sceneId, url, path }) => {
            // FIX: Only update media_url/path, DO NOT trigger render
            updateScene(id, { 
                visualStatus: 'completed', 
                media_url: url, 
                media_path: path, 
                viewMode: 'source',
                is_manual_asset: true // [NEW] Flag as manual
            });
            toast.success(`Scene #${sceneId} 영상 업로드 완료!`);
        },
        onError: (err, variables) => {
            updateScene(variables.id, { visualStatus: 'failed' });
            toast.error("업로드 실패: " + err);
        }
    });

    const generateImageMutation = useMutation({
        mutationFn: async (data: { id: string, sceneId: number, prompt: string }) => {
            const res = await api.post('/creative/generate-image', {
                prompt: data.prompt,
                provider: "openai",
                model: "dall-e-3"
            });
            return {
                id: data.id,
                sceneId: data.sceneId,
                url: res.data.web_url,
                path: res.data.server_path
            };
        },
        onSuccess: ({ id, sceneId, url, path }) => {
            updateScene(id, { visualStatus: 'completed', media_url: url, media_path: path, viewMode: 'source' });
            toast.success(`Scene #${sceneId} 이미지 생성 완료!`);
        },
        onError: (err, variables) => {
            updateScene(variables.id, { visualStatus: 'failed' });
            toast.error("이미지 생성 실패: " + err);
        }
    });


    const handleGenerateImage = (sceneId: number, id: string, prompt: string) => {
        const finalPrompt = `${prompt}${negativePrompt ? " --no " + negativePrompt : ""}`;
        updateScene(id, { visualStatus: 'generating' });
        generateImageMutation.mutate({ id, sceneId, prompt: finalPrompt });
    };

    const handleSegmentScript = () => {
        if (!fullScript.trim()) {
            toast.error("대본을 입력해주세요.");
            return;
        }
        setIsSegmenting(true);
        segmentScriptMutation.mutate({
            text: fullScript,
            mode: segmentMode,
            provider: scriptProvider,
            model: scriptModel,
            stylePrompt: stylePrompt,
            auto_generate_images: autoGenerateImages,
            auto_generate_audio: autoGenerateAudio,
            pacing_config: pacingStrategy === 'rule' ? {
                strategy: 'rule',
                unit: pacingUnit,
                value: pacingValue
            } : undefined
        }, {
            onSettled: () => setIsSegmenting(false)
        });
    };

    const handleGenerateVideo = (scene: SceneSegment) => {
        // Validation: If continuous motion, check if previous scene has a video
        if (scene.is_continuous_motion) {
            const prevScene = scenes.find(s => s.scene_id === scene.scene_id - 1);
            if (!prevScene || !prevScene.video_url) {
                toast.error("이전 씬과 연결 모드입니다. 선행 씬의 영상 생성을 먼저 완료해 주세요.");
                return;
            }
        }
        
        // Validation: If NOT continuous, ensure we have an image
        if (!scene.is_continuous_motion && !scene.media_url) {
            toast.error("영상을 생성하기 전에 반드시 이미지를 먼저 생성해야 합니다.");
            return;
        }

        const promptBase = scene.video_prompt || scene.visual_prompt;
        const finalPrompt = `${promptBase}${negativePrompt ? " --no " + negativePrompt : ""}`;
        
        // Pass continuous flag to mutation
        generateVideoMutation.mutate({ 
            id: scene.id, 
            sceneId: scene.scene_id, 
            prompt: finalPrompt, 
            model: "kling-v1",
            is_continuous_motion: scene.is_continuous_motion
        });
    };

    const handleVideoUpload = (sceneId: number, id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            updateScene(id, { visualStatus: 'generating' });
            uploadVideoMutation.mutate({ id, sceneId, file: e.target.files[0] });
        }
    };

    // Batch Mutations
    const batchImageMutation = useMutation({
        mutationFn: async (scenes: SceneSegment[]) => {
            const res = await api.post('/creative/batch-image', {
                scenes: scenes,
                provider: "openai",
                model: "dall-e-3"
            });
            return res.data;
        },
        onSuccess: (updatedScenes) => {
            setScenes(prev => prev.map(s => {
                const updated = updatedScenes.find((u: any) => u.scene_id === s.scene_id);
                return updated ? {
                    ...s,
                    media_url: updated.media_url,
                    media_path: updated.media_path,   // 로컬 경로도 저장 → batch-render 에서 직접 사용
                    visualStatus: 'completed',
                    viewMode: 'source'
                } : s;
            }));
            toast.success("전체 이미지 생성 완료!");
        },

        onError: (err) => {
            toast.error("배치 이미지 생성 실패: " + err);
        }
    });

    const handleBatchImageGen = () => {
        if (scenes.length === 0) return;
        if (!confirm("모든 씬에 대해 이미지를 생성하시겠습니까? (기존 이미지는 덮어씌워집니다)")) return;
        setScenes(prev => prev.map(s => ({ ...s, visualStatus: 'generating' })));
        batchImageMutation.mutate(scenes);
    };

    const batchRenderMutation = useMutation({
        mutationFn: async (scenes: SceneSegment[]) => {
            // 전체 씬 렌더링은 씬 수 × 씬당 시간 → 5분 타임아웃 인스턴스 사용
            const currentAspectRatio = segmentMode === 'shorts' ? "9:16" : "16:9";
            const res = await apiLong.post('/creative/batch-render', {
                scenes: scenes,
                voice_id: "af_heart",
                speed: 1.0,
                aspect_ratio: currentAspectRatio,
                motion_config: motionConfig,
                subtitle_config: subtitleConfig,
                audio_config: audioConfig
            });
            return res.data;
        },
        onSuccess: (updatedScenes) => {
            setScenes(prev => prev.map(s => {
                const updated = updatedScenes.find((u: any) => u.scene_id === s.scene_id);
                return updated ? { 
                    ...s, 
                    video_url: updated.video_url, 
                    video_path: updated.video_path, 
                    renderStatus: 'completed', 
                    viewMode: 'render' 
                } : s;
            }));
            toast.success("전체 영상 렌더링 완료!");
        },
        onError: (err) => {
            toast.error("배치 렌더링 실패: " + err);
        }
    });

    const handleBatchRender = () => {
        if (scenes.length === 0) return;
        if (!confirm("모든 씬을 영상으로 렌더링하시겠습니까? (이미지가 생성되어 있어야 합니다)")) return;
        setScenes(prev => prev.map(s => ({ ...s, renderStatus: 'generating' })));
        batchRenderMutation.mutate(scenes);
    };

    const handleRoughCut = () => {
        if (scenes.length === 0) return;

        // 사전 검증: 이미지가 없는 씬 확인
        const scenesWithoutImage = scenes.filter(s => !s.media_path && !s.media_url);
        if (scenesWithoutImage.length > 0) {
            toast.error(
                `씬 ${scenesWithoutImage.map(s => `#${s.scene_id}`).join(', ')}에 이미지가 없습니다. ` +
                `"전체 이미지 생성" 또는 각 씬의 "이미지 생성" 버튼을 먼저 눌러주세요.`
            );
            return;
        }

        if (!confirm("✨ 원클릭 러프컷: 모든 씬을 렌더링하고 하나로 합칩니다. 진행하시겠습니까?")) return;

        setScenes(prev => prev.map(s => ({ ...s, renderStatus: 'generating' })));

        // Chain: Batch Render -> Merge
        batchRenderMutation.mutate(scenes, {
            onSuccess: (updatedScenes) => {
                // Ensure state is updated before merge? 
                // Passed 'updatedScenes' contains the paths, so we can pass it directly.
                setIsMerging(true);
                mergeScenesMutation.mutate(updatedScenes, {
                    onSettled: () => setIsMerging(false)
                });
            }
        });
    };

    // Merge Scenes
    const [isMerging, setIsMerging] = useState(false);
    const [fullVideoPath, setFullVideoPath] = useState<string | null>(null);
    const mergeScenesMutation = useMutation({
        mutationFn: async (scenes: SceneSegment[]) => {
            // 영상 머지도 오래 걸리므로 5분 타임아웃 인스턴스 사용
            const res = await apiLong.post('/creative/merge-scenes', { scenes });
            return res.data;
        },
        onSuccess: (data) => {
            setFullVideoPath(data.server_path);
            toast.success("씬 영상 통합 완료! (ZIP 다운로드)", {
                action: {
                    label: "다운로드",
                    onClick: () => window.open(data.web_url, '_blank')
                }
            });
            // Optional: Automatically trigger download
            // window.open(data.web_url, '_blank');
        },
        onError: (err: any) => {
            const msg = err.response?.data?.detail || err.message || "알 수 없는 오류";
            toast.error("영상 통합 실패: " + msg);
        }
    });

    const handleMergeScenes = () => {
        // Filter scenes that have a video_path
        const validScenes = scenes.filter(s => s.video_path);
        if (validScenes.length === 0) {
            toast.error("통합할 렌더링된 영상이 없습니다. 먼저 씬 영상을 렌더링하세요.");
            return;
        }

        if (validScenes.length < scenes.length) {
            if (!confirm(`전체 ${scenes.length}개 씬 중 ${validScenes.length}개만 렌더링되었습니다. 이대로 통합하시겠습니까?`)) {
                return;
            }
        }

        setIsMerging(true);
        mergeScenesMutation.mutate(scenes, {
            onSettled: () => setIsMerging(false)
        });
    };
    const renderSceneMutation = useMutation({
        mutationFn: async (data: { id: string, sceneId: number, image_path: string, audio_path: string, aspect_ratio: string, script: string, old_file_path?: string }) => {
            // 영상 렌더링은 오래 걸리므로 5분 타임아웃 인스턴스 사용
            const res = await apiLong.post('/creative/render-scene', {
                scene_id: data.sceneId,
                image_path: data.image_path,
                audio_path: data.audio_path,
                aspect_ratio: data.aspect_ratio,
                motion_config: motionConfig,
                subtitle_config: subtitleConfig,
                audio_config: audioConfig,
                script: data.script,
                old_file_path: data.old_file_path
            });
            return {
                id: data.id,
                sceneId: data.sceneId,
                url: res.data.web_url,
                path: res.data.server_path
            };
        },
        onSuccess: ({ id, sceneId, url, path }) => {
            // FIX: Update video_url, NOT media_url, and switch viewMode to 'render'
            updateScene(id, { renderStatus: 'completed', video_url: url, video_path: path, viewMode: 'render' });
            toast.success(`Scene #${sceneId} 영상 렌더링 완료!`);
        },
        onError: (err: any, variables) => {
            console.error("Render Failed:", err);
            updateScene(variables.id, { renderStatus: 'failed' });
            const msg = err.response?.data?.detail || err.message || "알 수 없는 오류";
            toast.error(`씬 렌더링 실패: ${msg}`);
        }
    });

    const handleRenderScene = (scene: SceneSegment) => {
        if (!scene.media_path) {
            toast.error("이미지 경로가 없습니다. 이미지를 먼저 생성하세요.");
            return;
        }
        if (!scene.audio_path) {
            toast.error("오디오 경로가 없습니다. TTS를 먼저 생성하세요.");
            return;
        }

        console.log(`[Render] Scene #${scene.scene_id} - Image: ${scene.media_path}, Audio: ${scene.audio_path}`);

        updateScene(scene.id, { renderStatus: 'generating' });
        const aspectRatio = segmentMode === 'shorts' ? "9:16" : "16:9";

        const payload = {
            id: scene.id,
            sceneId: scene.scene_id,
            image_path: scene.media_path,
            audio_path: scene.audio_path,
            aspect_ratio: aspectRatio,
            script: scene.script,
            old_file_path: scene.video_path
        };
        console.log("[Render] Sending Payload:", payload);

        renderSceneMutation.mutate(payload);
    };

    const generateTTSMutation = useMutation({
        mutationFn: async (data: { id: string, sceneId: number, script: string }) => {
            const res = await api.post('/creative/scene-tts', {
                scene_id: data.sceneId,
                script: data.script,
                image_url: "",
                tts_config: ttsConfig,
                // @ts-ignore
                old_file_path: scenes.find(s => s.id === data.id)?.audio_path
            });
            return {
                id: data.id,
                sceneId: data.sceneId,
                url: res.data.web_url,
                path: res.data.server_path
            };
        },
        onSuccess: ({ id, sceneId, url, path }) => {
            updateScene(id, { audio_url: url, audio_path: path, audioStatus: 'completed' });
            toast.success(`Scene #${sceneId} TTS 생성 완료!`);
        },
        onError: (err: any, variables) => {
            updateScene(variables.id, { audioStatus: 'failed' });
            toast.error("TTS 생성 실패: " + err.message);
        }
    });

    const handleGenerateTTS = (scene: SceneSegment) => {
        if (!scene.script) {
            toast.error("대본이 없습니다.");
            return;
        }
        updateScene(scene.id, { audioStatus: 'generating' });
        generateTTSMutation.mutate({ id: scene.id, sceneId: scene.scene_id, script: scene.script });
    };

    const batchTTSMutation = useMutation({
        mutationFn: async (scenes: SceneSegment[]) => {
            // 배치 TTS는 씬 수만큼 순차 처리하므로 5분 타임아웃 사용
            const promises = scenes.map(s =>
                apiLong.post('/creative/scene-tts', {
                    scene_id: s.scene_id,
                    script: s.script,
                    image_url: "",
                    tts_config: ttsConfig
                }).then(res => ({
                    id: s.id,
                    scene_id: s.scene_id,
                    audio_url: res.data.web_url,    // 서버가 반환하는 필드명
                    audio_path: res.data.server_path
                }))
            );
            return Promise.all(promises);
        },
        onSuccess: (results) => {
            setScenes(prev => prev.map(s => {
                const res = results.find(r => r.scene_id === s.scene_id);
                return res ? { ...s, audio_url: res.audio_url, audio_path: res.audio_path, audioStatus: 'completed' } : s;
            }));
            toast.success("전체 TTS 생성 완료!");
        },
        onError: (err) => {
            toast.error("배치 TTS 생성 실패: " + err);
        }
    });

    const handleBatchTTS = () => {
        if (scenes.length === 0) return;
        if (!confirm("모든 씬에 대해 TTS를 생성하시겠습니까?")) return;
        setScenes(prev => prev.map(s => ({ ...s, audioStatus: 'generating' })));
        batchTTSMutation.mutate(scenes);
    };

    const triggerDownload = async (url: string, filename: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Download failed:', error);
            toast.error('다운로드 실패');
        }
    };

    // Keyboard Shortcuts Handler (Split/Merge)
    const handleScriptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => {
        // Ctrl + Enter: Split Scene
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            const target = e.target as HTMLTextAreaElement;
            const cursorPosition = target.selectionStart;
            const currentScript = scenes[index].script;

            const partA = currentScript.substring(0, cursorPosition).trim();
            const partB = currentScript.substring(cursorPosition).trim();

            // 1. Update current scene with Part A
            updateScene(scenes[index].id, { script: partA });

            // 2. Insert new scene with Part B after current scene
            const newScene: SceneSegment = {
                id: uuidv4(),
                scene_id: 0, // Will be re-indexed
                script: partB,
                visual_prompt: `${segmentMode === 'shorts' ? '9:16' : '16:9'}, Cinematic scene, ${stylePrompt}`,
                audioStatus: 'idle',
                visualStatus: 'idle',
                renderStatus: 'idle',
                viewMode: 'source'
            };

            setScenes(prev => {
                const newScenes = [...prev];
                newScenes.splice(index + 1, 0, newScene);
                // Re-index scene_ids
                return newScenes.map((s, i) => ({ ...s, scene_id: i + 1 }));
            });

            toast.success("씬이 분할되었습니다.");
        }
        // Ctrl + Backspace: Merge with Previous
        else if (e.ctrlKey && e.key === 'Backspace') {
            const target = e.target as HTMLTextAreaElement;
            // Only merge if cursor is at the beginning (or very close to it)
            if (target.selectionStart <= 1 && index > 0) {
                e.preventDefault();
                const currentScript = scenes[index].script;
                const prevScene = scenes[index - 1];

                // 1. Append current script to previous scene
                const mergedScript = (prevScene.script + " " + currentScript).trim();
                updateScene(prevScene.id, { script: mergedScript });

                // 2. Remove current scene
                setScenes(prev => {
                    const newScenes = prev.filter((_, i) => i !== index);
                    return newScenes.map((s, i) => ({ ...s, scene_id: i + 1 }));
                });

                toast.success("이전 씬과 병합되었습니다.");
            }
        }
    };

    const handleBatchDownload = async (type: string) => {
        try {
            toast.info(`${type === 'visual' ? '이미지' : '영상'} ZIP 다운로드 시작...`);
            const response = await api.post('/creative/batch-download', {
                scenes: scenes,
                target_type: type,
                full_video_path: type === 'video' ? fullVideoPath : undefined
            }, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/zip' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `batch_${type}_${Date.now()}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("다운로드 완료!");
        } catch (error) {
            console.error('Batch download failed:', error);
            toast.error('배치 다운로드 실패 (파일이 없거나 오류 발생)');
        }
    };

    const getAudioDuration = (url: string): Promise<number> => {
        return new Promise((resolve) => {
            if (!url || url.startsWith('file://')) {
                resolve(3000);
                return;
            }
            const audio = new Audio(url);
            let resolved = false;
            const finish = (duration: number) => {
                if (!resolved) {
                    resolved = true;
                    resolve(duration);
                }
            };
            audio.addEventListener('loadedmetadata', () => finish(audio.duration * 1000));
            audio.addEventListener('error', () => finish(3000));
            
            // Timeout after 500ms to prevent UI freezing
            setTimeout(() => finish(3000), 500);
        });
    };

    const handleCapCutExport = async (settings: any) => {
        let currentScenes = scenes;

        // TTS 누락 씬 감지 및 자동 생성 프로세스
        const missingTTSScenes = currentScenes.filter(seg => !seg.audio_url && !seg.audio_path && seg.script);
        if (missingTTSScenes.length > 0) {
            if (!confirm(`일부 씬(${missingTTSScenes.length}개)에 TTS 음성이 없습니다.\n음성이 없으면 해당 씬은 강제로 3초로 지정되며 소리가 나지 않습니다.\n\n내보내기 전에 누락된 씬의 TTS를 일괄 생성하시겠습니까?`)) {
                return; // 취소를 누르면 내보내기 진행 자체를 중단
            }
            
            setIsExportModalOpen(false); // 진행 상황을 볼 수 있게 모달을 닫음
            toast.info("누락된 TTS를 자동 생성합니다. 완료되면 캡컷 내보내기가 즉시 이어집니다.", { duration: 5000 });
            setScenes(prev => prev.map(s => missingTTSScenes.some(m => m.id === s.id) ? { ...s, audioStatus: 'generating' } : s));
            
            try {
                const results = await batchTTSMutation.mutateAsync(missingTTSScenes);
                
                // Read-only React state를 직접 수정하지 않고 새로운 배열로 매핑하여 내보내기 로직에 사용
                currentScenes = currentScenes.map(s => {
                    const res = results.find((r: any) => r.scene_id === s.scene_id);
                    return res ? { ...s, audio_url: res.audio_url, audio_path: res.audio_path, audioStatus: 'completed' } : s;
                });
                
                // UI용 상태 업데이트
                setScenes(currentScenes);
                toast.success("TTS 자동 생성 완료! 이어서 캡컷 내보내기를 시작합니다.");
            } catch (e: any) {
                console.error("Batch TTS Error:", e);
                toast.error("TTS 생성 중 오류가 발생하여 내보내기가 취소되었습니다.");
                return;
            }
        }

        setIsExportModalOpen(true); // 만약 모달이 닫혔었다면 다시 로딩창을 띄우기 위해 (혹은 그대로 유지)
        setExportLoading(true);
        setExportPhase('processing');
        try {
            const aspectRatio = segmentMode === 'shorts' ? "9:16" : "16:9";
            
            const mappedScenes = [];
            const voiceFiles = [];
            let cumulativeTime = 0;

            for (let idx = 0; idx < currentScenes.length; idx++) {
                const seg = currentScenes[idx];
                
                let audioDurationMs = 3000;
                const audioSrc = seg.audio_url || (seg.audio_path ? `file://${seg.audio_path}` : null);
                if (audioSrc) {
                    audioDurationMs = await getAudioDuration(audioSrc);
                }

                const sceneDurationSec = audioDurationMs / 1000;

                mappedScenes.push({
                    id: `scene_${idx}`,
                    duration: sceneDurationSec,
                    image_duration: sceneDurationSec,
                    media_path: seg.media_path,
                    video_path: seg.video_path,
                    subtitle_ko: seg.script,
                    subtitle_en: seg.script,
                    subtitle: seg.script,
                    image_size: { width: aspectRatio === '9:16' ? 1080 : 1920, height: aspectRatio === '9:16' ? 1920 : 1080 }
                });

                if (seg.audio_path || audioSrc) {
                    voiceFiles.push({
                        filename: `narrator_scene_${idx}.mp3`,
                        path: seg.audio_path || audioSrc,
                        durationMs: audioDurationMs,
                        timecodeMs: cumulativeTime
                    });
                }
                
                cumulativeTime += audioDurationMs;
            }

            // Map segments to CapCut project payload
            const projectData = {
                format: aspectRatio === '9:16' ? 'portrait' : 'landscape',
                aspectRatio: aspectRatio,
                scenes: mappedScenes
            };

            const audioPackage = {
                voices: voiceFiles.length > 0 ? [
                    {
                        character: "NARRATOR",
                        files: voiceFiles
                    }
                ] : []
            };

            // Call generator directly to bypass any cloud wrappers
            const generatorOptions = {
                targetPath: settings.capcutProjectNumber,
                projectName: "CreativeStudio_Project",
                subtitleOption: settings.subtitleOption,
                subtitleConfig: subtitleConfig,
                subtitleFontSize: subtitleConfig.fontSize,
                audioPackage: audioPackage,
                scaleMode: settings.scaleMode,
                kenBurns: settings.kenBurns,
                kenBurnsMode: settings.kenBurnsMode,
                kenBurnsCycle: settings.kenBurnsCycle,
                kenBurnsScaleMin: settings.kenBurnsScaleMin,
                kenBurnsScaleMax: settings.kenBurnsScaleMax
            };

            const { draftContent, draftMetaInfo, timelineLayout, extraFiles, mediaFiles } = await generateCapcutProject(projectData, generatorOptions);

            let srtContent = null;
            let srtFilename = null;
            if (settings.subtitleOption !== 'none') {
                srtContent = generateSRT(projectData, settings.subtitleOption || 'ko');
                srtFilename = `subtitles_${settings.subtitleOption || 'ko'}.srt`;
            }

            // Write files via Electron IPC directly
            const writeResult = await window.electronAPI.writeCapcutProject({
                targetPath: settings.capcutProjectNumber,
                draftInfo: draftContent,
                draftMetaInfo,
                timelineLayout,
                extraFiles,
                mediaFiles,
                srtContent,
                srtFilename
            });

            if (!writeResult.success) {
                throw new Error(writeResult.error || "Failed to write local CapCut project");
            }

            toast.success('CapCut 내보내기 완료!');
            
            if (window.electronAPI?.openCapcut) {
                try {
                    const openResult = await window.electronAPI.openCapcut(settings.capcutProjectNumber);
                    if (openResult && openResult.success) {
                        toast.info('CapCut 앱이 실행되었습니다.', 5000);
                    } else {
                        toast.warning('CapCut을 자동으로 실행하지 못했습니다. 수동으로 열어주세요.');
                    }
                } catch (e) {
                    toast.warning('CapCut을 자동으로 실행하지 못했습니다. 수동으로 열어주세요.');
                }
            }

            setIsExportModalOpen(false);
        } catch (error: any) {
            console.error('CapCut Export error:', error);
            toast.error(`CapCut 내보내기 실패: ${error.message}`);
        } finally {
            setExportLoading(false);
        }
    };

    // Manual Scene Management
    const handleAddScene = () => {
        const newScene: SceneSegment = {
            id: uuidv4(),
            scene_id: scenes.length + 1,
            script: "",
            visual_prompt: "",
            audioStatus: 'idle',
            visualStatus: 'idle',
            renderStatus: 'idle',
            viewMode: 'source'
        };
        setScenes(prev => [...prev, newScene]);
        toast.success(`Scene #${newScene.scene_id} 추가됨`);
    };

    const handleDeleteScene = (id: string) => {
        if (!confirm(`해당 씬을 삭제하시겠습니까? (관련 파일도 함께 삭제됩니다)`)) return;

        // Find the scene to get file paths
        const sceneToDelete = scenes.find(s => s.id === id);
        if (sceneToDelete) {
            const pathsToClean: string[] = [];
            if (sceneToDelete.media_path) pathsToClean.push(sceneToDelete.media_path);
            if (sceneToDelete.audio_path) pathsToClean.push(sceneToDelete.audio_path);
            if (sceneToDelete.video_path) pathsToClean.push(sceneToDelete.video_path);

            if (pathsToClean.length > 0) {
                cleanupMutation.mutate(pathsToClean);
            }
        }

        setScenes(prev => {
            const filtered = prev.filter(s => s.id !== id);
            // Renumber
            return filtered.map((s, i) => ({ ...s, scene_id: i + 1 }));
        });
        toast.success("씬 및 관련 파일 삭제 완료");
    };

    const handleInsertScene = (index: number) => {
        const newScene: SceneSegment = {
            id: uuidv4(),
            scene_id: 0, // Will be renumbered
            script: "",
            visual_prompt: "",
            audioStatus: 'idle',
            visualStatus: 'idle',
            renderStatus: 'idle',
            viewMode: 'source'
        };
        const updatedScenes = [...scenes];
        // Insert AT index (before the current scene at index)
        updatedScenes.splice(index, 0, newScene);

        // Renumber
        const renumbered = updatedScenes.map((s, i) => ({ ...s, scene_id: i + 1 }));
        setScenes(renumbered);
        toast.success("새로운 씬이 추가되었습니다.");
    };

    const handleMoveScene = (index: number, direction: number) => {
        if (index + direction < 0 || index + direction >= scenes.length) return;
        const updatedScenes = [...scenes];
        const temp = updatedScenes[index];
        updatedScenes[index] = updatedScenes[index + direction];
        updatedScenes[index + direction] = temp;

        // Renumber
        const renumbered = updatedScenes.map((s, i) => ({ ...s, scene_id: i + 1 }));
        setScenes(renumbered);
    };

    // AI Prompt Generation
    const generatePromptMutation = useMutation({
        mutationFn: async (data: { id: string, sceneId: number, script: string }) => {
            const res = await api.post('/creative/generate-prompt', {
                script: data.script,
                style_context: stylePrompt,
                provider: scriptProvider, // Use AI Writer settings
                model: scriptModel        // Use AI Writer settings
            });
            return { id: data.id, sceneId: data.sceneId, prompt: res.data.prompt };
        },
        onSuccess: ({ id, sceneId, prompt }) => {
            updateScene(id, { visual_prompt: prompt });
            toast.success(`Scene #${sceneId} 프롬프트 생성 완료!`);
        },
        onError: (err) => {
            toast.error("프롬프트 생성 실패: " + err);
        }
    });

    const handleGeneratePrompt = (scene: SceneSegment) => {
        if (!scene.script) {
            toast.error("대본을 먼저 입력해주세요.");
            return;
        }
        generatePromptMutation.mutate({ id: scene.id, sceneId: scene.scene_id, script: scene.script });
    };

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col gap-6 p-6 overflow-y-auto">
            <div className="flex items-center justify-between shrink-0">
                <div />
            </div>

            {/* Zone 1: Style Presets (Collapsible) */}
            <Card className="border-l-4 border-l-purple-500 shadow-sm">
                <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/5 transition-colors border-b" onClick={() => setIsStyleCollapsed(!isStyleCollapsed)}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Wand2 className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Style & Configuration</span>
                        </div>
                        {isStyleCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </div>
                </CardHeader>
                {!isStyleCollapsed && (
                    <CardContent className="space-y-4 pt-0">
                        {/* Row 1: Preset Controls */}
                        <div className="flex items-end gap-4">
                            <div className="flex-1 space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">스타일 프리셋 (Style Preset)</Label>
                                <div className="flex gap-2">
                                    <Select value={selectedPresetId} onValueChange={handleSelectPreset}>
                                        <SelectTrigger className="flex-1 h-9 text-sm">
                                            <SelectValue placeholder="프리셋 선택..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="new">+ 새 프리셋 만들기</SelectItem>
                                            {presets?.map((p: any) => (
                                                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedPresetId && selectedPresetId !== "new" && (
                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => handleDeletePreset(Number(selectedPresetId))}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button variant="outline" size="sm" className="h-9 whitespace-nowrap bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200" onClick={() => setIsStyleGalleryOpen(true)}>
                                        🎨 갤러리에서 찾기
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-[1.5] space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">프리셋 이름</Label>
                                <div className="flex gap-2">
                                    <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="예: Cyberpunk Style" className="h-9 text-sm" />
                                    <Button onClick={handleSavePreset} disabled={!presetName} size="sm" className="h-9 px-4">
                                        <Save className="w-4 h-4 mr-2" /> 저장
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Analysis & Prompts */}
                        <div className="flex flex-col md:flex-row gap-4 h-auto md:h-32">
                            {/* Analysis Drop Zone */}
                            <div className="w-full md:w-1/4 relative border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center p-2 hover:bg-muted/50 transition-colors cursor-pointer bg-muted/10 group min-h-[100px]">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={(e) => e.target.files?.[0] && handleAnalyzeStyle(e.target.files[0])}
                                />
                                <Label className="absolute top-2 left-2 text-[10px] font-bold text-muted-foreground pointer-events-none">스타일 분석</Label>
                                {isAnalyzing ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                        <span className="text-xs text-muted-foreground">분석 중...</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors">
                                        <Sparkles className="w-6 h-6 mb-1" />
                                        <span className="text-xs font-medium">이미지 업로드</span>
                                        <span className="text-[10px] opacity-70">클릭 또는 드래그</span>
                                    </div>
                                )}
                            </div>

                            {/* Prompts */}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 flex flex-col h-full">
                                    <Label className="text-xs font-medium text-muted-foreground">긍정 프롬프트 (Positive)</Label>
                                    <Textarea
                                        value={stylePrompt}
                                        onChange={(e) => setStylePrompt(e.target.value)}
                                        className="flex-1 resize-none text-xs font-mono bg-muted/30 min-h-[80px]"
                                        placeholder="Describe the visual style..."
                                    />
                                </div>
                                <div className="space-y-1.5 flex flex-col h-full">
                                    <Label className="text-xs font-medium text-muted-foreground">부정 프롬프트 (Negative)</Label>
                                    <Textarea
                                        value={negativePrompt}
                                        onChange={(e) => setNegativePrompt(e.target.value)}
                                        className="flex-1 resize-none text-xs font-mono bg-muted/30 min-h-[80px]"
                                        placeholder="What to avoid..."
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Zone 2: Script Workspace (Collapsible) */}
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
                <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/5 transition-colors border-b" onClick={() => setIsScriptCollapsed(!isScriptCollapsed)}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Clapperboard className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Script Workspace</span>
                        </div>
                        {isScriptCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </div>
                </CardHeader>
                {!isScriptCollapsed && (
                    <CardContent className="space-y-4 pt-0">
                        <Tabs value={scriptMode} onValueChange={setScriptMode} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-lg h-9">
                                <TabsTrigger value="manual" className="text-xs px-2">📝 직접 입력</TabsTrigger>
                                <TabsTrigger value="creative" className="text-xs px-2">✨ AI 작가</TabsTrigger>
                            </TabsList>
                            <TabsContent value="creative" className="space-y-4">
                                <div className="col-span-3"> {/* Expanded to full width of grid -> actually it was 3 cols, so we just use full space */}
                                    <AIModelSelector
                                        provider={scriptProvider}
                                        onProviderChange={setScriptProvider}
                                        model={scriptModel}
                                        onModelChange={setScriptModel}
                                        presetId={selectedStyleId}
                                        onPresetChange={setSelectedStyleId}
                                        showPreset={true}
                                        onCreatePreset={handleCreateStyle}
                                        onEditPreset={handleEditStyle}
                                    />
                                </div>

                                <div className="flex items-center gap-2 pl-1">
                                    <Switch
                                        id="creative-web-search"
                                        checked={useWebSearchCreative}
                                        onCheckedChange={setUseWebSearchCreative}
                                    />
                                    <Label htmlFor="creative-web-search" className="cursor-pointer flex items-center gap-1.5 text-sm font-medium">
                                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                                        웹 검색 활용
                                    </Label>
                                    <Badge variant={useWebSearchCreative ? "default" : "outline"} className="text-[10px] px-1.5 py-0 ml-1">
                                        {useWebSearchCreative ? "ON" : "OFF"}
                                    </Badge>
                                </div>

                                <div className="space-y-2">
                                    <Label>입력 (Input)</Label>
                                    <Textarea
                                        value={scriptInput}
                                        onChange={(e) => setScriptInput(e.target.value)}
                                        placeholder="키워드, 문장, 또는 참고할 텍스트를 입력하세요..."
                                        className="min-h-[100px]"
                                    />
                                </div>

                                <div className="flex justify-end">
                                    <Button onClick={handleGenerateScript} disabled={isGeneratingScript || !scriptInput}>
                                        {isGeneratingScript ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                                        AI 대본 생성
                                    </Button>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="space-y-2">
                            <Label>전체 대본 (Full Script)</Label>
                            <Textarea
                                value={fullScript}
                                onChange={(e) => setFullScript(e.target.value)}
                                className="min-h-[150px] font-mono text-sm leading-relaxed"
                                placeholder="여기에 전체 대본을 입력하세요..."
                            />
                        </div>

                        <div className="flex flex-col gap-3 pt-2 bg-muted/10 p-3 rounded-lg border">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> 씬 분할 전략 (Segmentation Strategy)
                                </Label>
                                <div className="flex bg-muted rounded-md p-0.5">
                                    <Button
                                        variant={pacingStrategy === 'ai' ? 'secondary' : 'ghost'}
                                        size="sm" className="h-6 text-[10px] px-2"
                                        onClick={() => { setPacingStrategy('ai'); setSplitMethod('ai_smart'); }}
                                    >
                                        AI 스마트 (권장)
                                    </Button>
                                    <Button
                                        variant={pacingStrategy === 'rule' ? 'secondary' : 'ghost'}
                                        size="sm" className="h-6 text-[10px] px-2"
                                        onClick={() => { setPacingStrategy('rule'); setSplitMethod('custom_rule'); }}
                                    >
                                        커스텀 규칙
                                    </Button>
                                </div>
                            </div>

                            {pacingStrategy === 'ai' ? (
                                <Select value={splitMethod} onValueChange={setSplitMethod}>
                                    <SelectTrigger className="w-full h-9 text-xs">
                                        <SelectValue placeholder="AI 분석 방식" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ai_smart">✨ AI 스마트 분석 (Visual Flow)</SelectItem>
                                        <SelectItem value="visual_change">🎥 시각 전환 기준</SelectItem>
                                        <SelectItem value="semantic">🧠 의미/길이 자동 최적화</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Select value={pacingUnit} onValueChange={(v: any) => setPacingUnit(v)}>
                                        <SelectTrigger className="w-[120px] h-9 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sentence">📝 문장 단위 (Sentences)</SelectItem>
                                            <SelectItem value="time">⏱️ 시간 단위 (Duration)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <div className="flex-1 flex items-center gap-2 bg-background border rounded-md px-3 h-9">
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {pacingUnit === 'sentence' ? '씬 당 문장 수:' : '씬 당 예상 시간:'}
                                        </span>
                                        <Input
                                            type="number"
                                            value={pacingValue}
                                            onChange={(e) => setPacingValue(Number(e.target.value))}
                                            className="h-6 w-16 text-xs text-right border-none shadow-none focus-visible:ring-0 p-0"
                                            min={1}
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            {pacingUnit === 'sentence' ? '개' : '초'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end items-center pt-2 gap-2">

                            {/* [NEW] Auto-Gen Checkboxes */}
                            <div className="flex items-center gap-3 px-2 bg-muted/30 h-10 rounded-md border border-input">
                                <Label className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary">
                                    <input type="checkbox" checked={autoGenerateImages} onChange={e => setAutoGenerateImages(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary" />
                                    <span>이미지 자동생성</span>
                                </Label>
                                <div className="w-px h-4 bg-muted-foreground/30" />
                                <Label className="flex items-center gap-2 text-xs cursor-pointer hover:text-primary">
                                    <input type="checkbox" checked={autoGenerateAudio} onChange={e => setAutoGenerateAudio(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary" />
                                    <span>TTS 자동생성</span>
                                </Label>
                            </div>

                            <Button onClick={handleSegmentScript} disabled={isSegmenting || !fullScript}>
                                {isSegmenting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Clapperboard className="w-4 h-4 mr-2" />}
                                AI 씬 분할 및 분석
                            </Button>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Zone 3: Scene Board */}
            <div className="space-y-4">
                {/* Scene Controls Header (Split into 2 rows) */}
                <div className="bg-card p-4 rounded-lg border shadow-sm sticky top-0 z-10 space-y-3">
                    {/* Row 1: Title & Segment Mode */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Film className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Scene Board</span>
                                <Badge variant="secondary" className="ml-2 h-5 text-[10px]">{scenes.length} Scenes</Badge>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex items-center space-x-2 bg-muted/30 p-1 rounded-md">
                                <Label className="text-xs font-medium px-2">화면 비율:</Label>
                                <Select value={segmentMode} onValueChange={setSegmentMode}>
                                    <SelectTrigger className="w-[140px] h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="shorts">📱 쇼츠 (9:16)</SelectItem>
                                        <SelectItem value="video">📺 비디오 (16:9)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleMergeScenes} disabled={isMerging}>
                                {isMerging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Film className="w-3 h-3" />}
                                씬 영상 통합
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={handleResetScenes} title="초기화">
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Row 2: Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleBatchTTS}>
                            <Mic className="w-3 h-3 mr-1" /> 전체 TTS 생성
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleBatchImageGen}>
                            <ImageIcon className="w-3 h-3 mr-1" /> 전체 이미지 생성
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleBatchRender}>
                            <Clapperboard className="w-3 h-3 mr-1" /> 전체 렌더링
                        </Button>
                        <Button variant="default" size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600" onClick={handleRoughCut}>
                            <Film className="w-3 h-3 mr-1" /> ⚡ 원클릭 러프컷
                        </Button>

                        <div className="h-4 w-px bg-border mx-2" />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-xs">
                                    <Download className="w-4 h-4 mr-2" /> 다운로드
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => handleBatchDownload('visual')}>
                                    이미지/영상 소스 (ZIP)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleBatchDownload('video')}>
                                    최종 렌더링 결과 (ZIP)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* [NEW] CapCut Export Button */}
                        <Button variant="outline" size="sm" className="h-8 text-xs bg-black text-white hover:bg-zinc-800 border-black" onClick={() => setIsExportModalOpen(true)}>
                            ✂️ CapCut 내보내기
                        </Button>

                        <div className="flex-1" />

                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsTTSDialogOpen(true)}>
                            ⚙️ TTS 설정
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsMotionDialogOpen(true)}>
                            🎥 모션 설정
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsAudioDialogOpen(true)}>
                            🔊 오디오 설정
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsSubtitleDialogOpen(true)}>
                            📝 자막 설정
                        </Button>


                    </div>
                </div>

                {/* Scene List */}
                <div className="space-y-6 pb-20">
                    {scenes.map((scene, index) => (
                        <React.Fragment key={scene.id}>
                            {/* Insert Button between scenes */}
                            <div className="flex justify-center py-2 group">
                                <Button variant="ghost" size="sm" className="rounded-full h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-muted" onClick={() => handleInsertScene(index)} title="이 위치에 씬 추가">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Compact Scene Card (Flex Row) */}
                            <div className="flex flex-col md:flex-row border rounded-xl shadow-sm overflow-hidden bg-card">
                                {/* Left Panel: Inputs (Flex-1) */}
                                <div className="flex-1 p-4 space-y-4 border-r">
                                    {/* Header: Scene # + Trash */}
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">Scene #{scene.scene_id}</Badge>
                                            <Badge variant="secondary" className="text-xs">{segmentMode === 'shorts' ? '9:16' : '16:9'}</Badge>
                                            {scene.is_manual_asset && (
                                                <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-[10px] h-5 gap-1">
                                                    <DollarSign className="w-3 h-3" /> 비용 절감됨
                                                </Badge>
                                            )}
                                        
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveScene(index, -1)}><ChevronUp className="w-3 h-3" /></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveScene(index, 1)}><ChevronDown className="w-3 h-3" /></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteScene(scene.id)}><Trash2 className="w-3 h-3" /></Button>
                                        </div>
                                    </div>

                                    {/* Script Section */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-xs font-bold text-muted-foreground">대본 (SCRIPT / AUDIO)</Label>
                                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleGenerateTTS(scene)} disabled={scene.audioStatus === 'generating'}>
                                                {scene.audioStatus === 'generating' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Music className="w-3 h-3 mr-1" />}
                                                {scene.audio_url ? "TTS 재생성" : "TTS 생성"}
                                            </Button>
                                        </div>
                                        <Textarea
                                            value={scene.script}
                                            onChange={(e) => updateScene(scene.id, { script: e.target.value })}
                                            onKeyDown={(e) => handleScriptKeyDown(e, index)}
                                            className="min-h-[80px] text-[13px] leading-relaxed resize-y"
                                            placeholder="대본을 입력하세요... (Ctrl+Enter: 분할, Ctrl+Backspace: 병합)"
                                        />
                                        {scene.audio_url && (
                                            <div className="flex items-center gap-2 mt-1 bg-muted/20 p-1 rounded">
                                                <audio controls src={scene.audio_url} className="h-6 w-full" />
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => triggerDownload(scene.audio_url!, `scene_${scene.scene_id}_audio.mp3`)}>
                                                    <Download className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Visual/Video Prompt Section */}
                                    <div className="space-y-3 flex-1 flex flex-col">
                                        <div className="space-y-1 flex-1 flex flex-col">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-xs font-bold text-muted-foreground">이미지 프롬프트 (IMAGE PROMPT)</Label>
                                                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleGeneratePrompt(scene)}>
                                                    <Sparkles className="w-3 h-3 mr-1" /> AI 프롬프트 생성
                                                </Button>
                                            </div>
                                            <Textarea
                                                value={scene.visual_prompt}
                                                onChange={(e) => updateScene(scene.id, { visual_prompt: e.target.value })}
                                                className="flex-[0.5] min-h-[60px] text-[13px] font-mono leading-relaxed resize-y bg-muted/10"
                                                placeholder="이미지 생성을 위한 구도, 배경, 피사체 묘사..."
                                                disabled={scene.is_continuous_motion}
                                            />
                                        </div>
                                        <div className="space-y-1 flex-1 flex flex-col">
                                            <Label className="text-xs font-bold text-muted-foreground">영상 프롬프트 (VIDEO/MOTION PROMPT)</Label>
                                            <Textarea
                                                value={scene.video_prompt || ''}
                                                onChange={(e) => updateScene(scene.id, { video_prompt: e.target.value })}
                                                className="flex-[0.5] min-h-[50px] text-[13px] font-mono leading-relaxed resize-y bg-muted/10"
                                                placeholder="카메라 워크 및 피사체 움직임 묘사..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Panel: Visual Source (Fixed Width) */}
                                <div className="w-full md:w-[320px] bg-muted/5 p-3 flex flex-col gap-3 shrink-0">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-bold text-muted-foreground flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <ImageIcon className="w-3 h-3" /> 비주얼 소스
                                            </div>
                                            {index > 0 && (
                                                <Label className="flex items-center gap-1.5 mt-1 cursor-pointer hover:text-primary transition-colors">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={scene.is_continuous_motion || false} 
                                                        onChange={(e) => updateScene(scene.id, { is_continuous_motion: e.target.checked })}
                                                        className="rounded border-gray-400 text-primary focus:ring-primary w-3 h-3" 
                                                    />
                                                    <span className="text-[10.5px] whitespace-nowrap">이전 씬 마지막 프레임 연결</span>
                                                </Label>
                                            )}
                                        </div>
                                        {(scene.video_url && scene.media_url) && (
                                            <div className="flex bg-muted rounded-md p-0.5">
                                                <Button
                                                    variant={scene.viewMode === 'source' ? 'secondary' : 'ghost'}
                                                    size="sm"
                                                    className="h-5 text-[10px] px-2"
                                                    onClick={() => updateScene(scene.id, { viewMode: 'source' })}
                                                >
                                                    Source
                                                </Button>
                                                <Button
                                                    variant={scene.viewMode === 'render' ? 'secondary' : 'ghost'}
                                                    size="sm"
                                                    className="h-5 text-[10px] px-2"
                                                    onClick={() => updateScene(scene.id, { viewMode: 'render' })}
                                                >
                                                    Render
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Media Preview - Fixed Height Container to prevent expansion */}
                                    <div className="w-full h-[180px] bg-black rounded-md overflow-hidden border shadow-inner relative group flex items-center justify-center">
                                        {/* Render Logic: Based on viewMode */}
                                        {scene.viewMode === 'render' && scene.video_url ? (
                                            <video src={scene.video_url} controls className="w-full h-full object-contain" />
                                        ) : scene.media_url ? (
                                            scene.media_url.endsWith('.mp4') ?
                                                <video src={scene.media_url} controls className="w-full h-full object-contain" /> :
                                                <img src={scene.media_url} alt="Source" className="w-full h-full object-contain" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-muted-foreground/30">
                                                <ImageIcon className="w-8 h-8 mb-1" />
                                                <span className="text-[10px]">No Media</span>
                                            </div>
                                        )}

                                        {/* Contextual Download Button */}
                                        {(scene.video_url || scene.media_url) && (
                                            <Button variant="secondary" size="icon" className="absolute top-2 right-2 h-7 w-7 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => triggerDownload(scene.video_url || scene.media_url!, `scene_${scene.scene_id}_media`)}>
                                                <Download className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>

                                    {/* Control Grid (2x2) */}
                                    <div className="grid grid-cols-2 gap-2 mt-auto">
                                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleGenerateImage(scene.scene_id, scene.id, scene.visual_prompt)} disabled={scene.visualStatus === 'generating' || scene.is_continuous_motion}>
                                            {scene.visualStatus === 'generating' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3 mr-1" />} 이미지 생성
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleGenerateVideo(scene)} disabled={scene.visualStatus === 'generating'}>
                                            {scene.visualStatus === 'generating' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Film className="w-3 h-3 mr-1" />} 영상 생성
                                        </Button>
                                        
                                        {/* [NEW] Frozen Effect Selector for Manual Assets */}
                                        <div className="col-span-2 space-y-1">
                                            <Label className="text-[10px] text-muted-foreground">마지막 프레임 효과 (영상 부족 시)</Label>
                                            <Select 
                                                value={scene.frozen_effect || "static"} 
                                                onValueChange={(v) => updateScene(scene.id, { frozen_effect: v })}
                                            >
                                                <SelectTrigger className="h-7 text-[10px] bg-muted/20">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="static">⏸️ 정지화면 (Static)</SelectItem>
                                                    <SelectItem value="zoom">🔍 서서히 확대 (Zoom)</SelectItem>
                                                    <SelectItem value="pan_left">⬅️ 왼쪽 이동 (Pan Left)</SelectItem>
                                                    <SelectItem value="pan_right">➡️ 오른쪽 이동 (Pan Right)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>


                                        <div className="relative">
                                            <Button variant="outline" size="sm" className={`w-full h-8 text-xs ${scene.is_manual_asset ? 'border-green-500 bg-green-500/10' : ''}`}>
                                                <Upload className="w-3 h-3 mr-1" /> {scene.is_manual_asset ? '수동 에셋 변경' : '수동 에셋 업로드'}
                                            </Button>
                                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleVideoUpload(scene.scene_id, scene.id, e)} />
                                        </div>

                                        {/* Render Button (Primary) */}
                                        <Button
                                            className="w-full h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-sm col-span-2"
                                            onClick={() => handleRenderScene(scene)}
                                            disabled={scene.renderStatus === 'generating'}
                                        >
                                            {scene.renderStatus === 'generating' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Clapperboard className="w-4 h-4 mr-2" />}
                                            씬 영상 렌더링
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </React.Fragment>
                    ))}

                    {/* Add Scene Button */}
                    <Button
                        variant="outline"
                        className="w-full h-16 border-dashed border-2 hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors"
                        onClick={handleAddScene}
                    >
                        <Plus className="w-6 h-6 mr-2" /> 새로운 씬 추가하기
                    </Button>
                </div>

                {/* TTS Dialog & Modals */}
                <TTSSettingsDialog
                    open={isTTSDialogOpen}
                    onOpenChange={setIsTTSDialogOpen}
                    initialConfig={ttsConfig}
                    onSave={(cfg) => {
                        setTTSConfig(cfg);
                        toast.success("TTS 설정이 저장되었습니다.");
                    }}
                />

                <MotionSettingsDialog
                    open={isMotionDialogOpen}
                    onOpenChange={setIsMotionDialogOpen}
                    initialConfig={motionConfig}
                    onSave={(cfg) => {
                        setMotionConfig(cfg);
                        toast.success("모션 설정이 저장되었습니다.");
                    }}
                />

                <SubtitleSettingsDialog
                    open={isSubtitleDialogOpen}
                    onOpenChange={setIsSubtitleDialogOpen}
                    initialConfig={subtitleConfig}
                    onSave={(cfg) => {
                        setSubtitleConfig(cfg);
                        toast.success("자막 설정이 저장되었습니다.");
                    }}
                />

                <AudioSettingsDialog
                    open={isAudioDialogOpen}
                    onOpenChange={setIsAudioDialogOpen}
                    initialConfig={audioConfig}
                    onSave={(newConfig) => {
                        setAudioConfig(newConfig);
                        toast.success("오디오 설정이 저장되었습니다.");
                    }}
                />

                {/* Style Management Dialog */}
                <Dialog open={isStyleDialogOpen} onOpenChange={setIsStyleDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingStyle.id ? "지침서 수정" : "새 지침서 만들기"}</DialogTitle>
                            <DialogDescription>AI 작가에게 부여할 역할과 지침을 설정합니다.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>이름 (Name)</Label>
                                <Input value={editingStyle.name} onChange={(e) => setEditingStyle({ ...editingStyle, name: e.target.value })} placeholder="예: 영화 요약 작가" />
                            </div>
                            <div className="space-y-2">
                                <Label>시스템 지침 (System Instruction)</Label>
                                <Textarea
                                    value={editingStyle.system_instruction}
                                    onChange={(e) => setEditingStyle({ ...editingStyle, system_instruction: e.target.value })}
                                    placeholder="AI에게 부여할 역할과 규칙을 상세히 적어주세요."
                                    className="min-h-[150px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>예시 출력 (Sample Output) - 선택사항</Label>
                                <Textarea
                                    value={editingStyle.sample_text}
                                    onChange={(e) => setEditingStyle({ ...editingStyle, sample_text: e.target.value })}
                                    placeholder="AI가 참고할 예시 출력 형식을 적어주세요."
                                    className="min-h-[100px]"
                                />
                            </div>
                        </div>
                        <div className="flex justify-between w-full">
                            {editingStyle.id ? (
                                <Button variant="destructive" onClick={() => {
                                    if (confirm("정말 이 지침서를 삭제하시겠습니까?")) {
                                        deleteStyleMutation.mutate(Number(editingStyle.id));
                                        setIsStyleDialogOpen(false);
                                    }
                                }}>
                                    <Trash2 className="w-4 h-4 mr-2" /> 삭제
                                </Button>
                            ) : <div></div>}
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setIsStyleDialogOpen(false)}>취소</Button>
                                <Button onClick={handleSaveStyle}>저장</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
            
            <StyleGalleryModal
                open={isStyleGalleryOpen}
                onOpenChange={setIsStyleGalleryOpen}
                onSelectStyle={(style) => {
                    // "웹툰/만화" 키워드가 들어가면 글자나 말풍선이 생성될 확률이 높으므로 방지 키워드 추가
                    const antiTextModifier = ", textless, no text, no speech bubbles, no comic panels";
                    setStylePrompt(style.prompt_en + antiTextModifier);
                    setPresetName(style.name_ko);
                    
                    // 부정 프롬프트가 비어있다면 글자 방지 기본값 세팅
                    setNegativePrompt(prev => prev || "text, words, fonts, speech bubbles, dialog, comic panels, watermark, signature, UI");
                }}
            />
            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                onExport={handleCapCutExport}
                projectName="creative_studio"
                loading={exportLoading}
                exportPhase={exportPhase}
                hasSubtitles={scenes.some(seg => seg.script && seg.script.trim().length > 0)}
                onUpgradeClick={() => { /* Handled elsewhere if needed */ }}
            />
        </div >
    );
};

export default CreativeStudio;