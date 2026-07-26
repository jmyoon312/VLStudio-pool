import React, { useState, useEffect, useMemo } from 'react';
import { useReactFlow, useNodes } from 'reactflow';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Lock, ChevronLeft, ChevronRight, Music, AlertTriangle, Volume2, Save, Zap, Pause, Square, Download } from 'lucide-react';
import { toast } from "sonner";
import api from '@/lib/api';
import TTSConfigPanel from '@/components/shared/TTSConfigPanel';
import { TTSConfig } from '@/types/tts';
import { cn } from "@/lib/utils";

const AIVoiceNodeInspector = ({ data, nodeId }: { data: any, nodeId: string }) => {
    const { setNodes, getNodes, getEdges } = useReactFlow();
    const nodes = useNodes();
    const edges = getEdges();

    // --- State ---
    const [isAutoRun, setIsAutoRun] = useState(data.isAutoRun || false);
    const [activeTab, setActiveTab] = useState("source");

    // Batch / Asset State
    const [inputAssets, setInputAssets] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Current Asset Proxy
    const currentAsset = inputAssets[currentIndex] || {};

    // Config Initialization
    const config: TTSConfig = data.ttsConfig || {
        engine: 'supertone-local',
        language: 'ko',
        voice_id: '',
        speed: 1.0,
        pitch: 0,
        use_silence_removal: false
    };

    // --- Upstream Data Logic ---
    const upstreamData = useMemo(() => {
        const incomingEdge = edges.find(e => e.target === nodeId);
        if (!incomingEdge) return null;
        const sourceNode = nodes.find(n => n.id === incomingEdge.source);
        return sourceNode ? {
            id: sourceNode.id,
            executionResult: (sourceNode.data as any).executionResult,
            selectedIds: (sourceNode.data as any).selectedIds
        } : null;
    }, [nodes, edges, nodeId]);

    useEffect(() => {
        const fetchUpstreamData = async () => {
            if (!upstreamData) {
                if (inputAssets.length > 0) setInputAssets([]);
                return;
            }

            // 1. Hydrated Data
            const sourceExecution = upstreamData.executionResult;
            if (sourceExecution?.items) {
                const hydratedAssets = sourceExecution.items.map((item: any) => item.json || item);
                // Use JSON string comparison to avoid loop if nothing changed
                if (JSON.stringify(hydratedAssets) !== JSON.stringify(inputAssets)) {
                    setInputAssets(hydratedAssets);
                }
                return;
            }

            // 2. Fallback execution ID fetch (if needed)
            if (upstreamData.selectedIds && upstreamData.selectedIds.length > 0) {
                if (inputAssets.length !== upstreamData.selectedIds.length) {
                    setLoadingAssets(true);
                    try {
                        const res = await api.post('/videos/batch-details', { ids: upstreamData.selectedIds });
                        setInputAssets(res.data);
                    } catch (err) {
                        console.error("Failed to fetch batch details", err);
                    } finally {
                        setLoadingAssets(false);
                    }
                }
            } else {
                if (inputAssets.length > 0) setInputAssets([]);
            }
        };

        fetchUpstreamData();
    }, [JSON.stringify(upstreamData), nodeId]);

    // --- Script & Output Logic ---
    const getSourceText = () => {
        // Try all likely fields for text
        return currentAsset.script || currentAsset.generated_text || currentAsset.transcript || currentAsset.content || currentAsset.text || "";
    };

    const [sourceScript, setSourceScript] = useState("");

    // Sync Source Script
    useEffect(() => {
        setSourceScript(getSourceText());
    }, [currentAsset]);

    // --- Handlers ---
    const audioRef = React.useRef<HTMLAudioElement>(null);

    // Auto-play when new audio is generated (if tab is active)
    useEffect(() => {
        if (activeTab === "output" && data.lastAudioResult?.audio_url && audioRef.current) {
            audioRef.current.play().catch(() => { });
        }
    }, [data.lastAudioResult, activeTab]);

    const handlePlay = () => audioRef.current?.play();
    const handlePause = () => audioRef.current?.pause();
    const handleStop = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };

    const handleConfigChange = (newConfig: TTSConfig) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            ttsConfig: newConfig,
                        },
                    };
                }
                return node;
            })
        );
    };

    const handleAutoRunChange = (checked: boolean) => {
        setIsAutoRun(checked);
        setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, isAutoRun: checked } } : n));
    };

    const handleRun = async () => {
        // Determine items to process
        const itemsToProcess = inputAssets.length > 0 ? inputAssets : (sourceScript ? [{ script: sourceScript }] : []);

        if (itemsToProcess.length === 0) {
            toast.error("변환할 텍스트가 없습니다.");
            return;
        }

        // 1. Stop current playback & Reset State
        handleStop();
        setNodes((nds) => nds.map((n) => {
            if (n.id === nodeId) {
                const newData = { ...n.data };
                delete newData.lastAudioResult;
                delete newData.executionResult; // Reset previous batch results
                return { ...n, data: newData };
            }
            return n;
        }));

        try {
            toast.info(`${itemsToProcess.length}개의 오디오 생성 시작...`);

            const results = [];

            // Loop for Batch Processing
            for (let i = 0; i < itemsToProcess.length; i++) {
                const item = itemsToProcess[i];
                // Ensure we extract text from ALL possible fields
                const text = item.script || item.generated_text || item.text || item.content || item.question || sourceScript || "";

                if (!text || text.trim().length === 0) {
                    console.warn(`Item ${i} has no text`, item);
                    results.push({ ...item, error: "No text", status: "failed" });
                    continue;
                }

                const formData = new FormData();
                formData.append("text", text);
                formData.append("engine", config.engine);
                formData.append("language", config.language); // Ensure config.language is correct
                formData.append("voice_id", config.voice_id);
                formData.append("rate", Math.round((config.speed - 1.0) * 100).toString());
                formData.append("pitch", config.pitch.toString());

                if (config.emotion) formData.append("emotion", config.emotion);
                if (config.use_silence_removal) formData.append("use_silence_removal", "true");

                try {
                    // Small delay to prevent rate limits
                    if (i > 0) await new Promise(r => setTimeout(r, 200));

                    const res = await api.post("/tools/tts/generate", formData);
                    if (res.data.status === "success" && res.data.web_url) {
                        // Must merge with original item to preserve 'script' for next node
                        results.push({
                            ...item,
                            script: text, // Normalized script key
                            audio_url: res.data.web_url,
                            duration: res.data.duration,
                            timestamp: Date.now(),
                            status: "success"
                        });
                    } else {
                        results.push({ ...item, script: text, error: "Generation failed", status: "failed" });
                    }
                } catch (e: any) {
                    console.error(`TTS Gen Error for item ${i}`, e);
                    results.push({ ...item, script: text, error: e.message || "API Error", status: "failed" });
                }
            }

            // Save Batch Results to Node Data
            setNodes((nds) => nds.map((n) => {
                if (n.id === nodeId) {
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            // CRITICAL: Ensure 'items' is the key expected by SubtitleNodeInspector
                            executionResult: { items: results },
                            lastAudioResult: results.find(r => r.status === "success") || results[0]
                        }
                    };
                }
                return n;
            }));

            const successCount = results.filter(r => r.status === "success").length;
            if (successCount === itemsToProcess.length) {
                toast.success(`전체 ${successCount}개 오디오 생성 완료`);
            } else {
                toast.warning(`${successCount} / ${itemsToProcess.length}개 성공 (일부 실패)`);
            }

            setActiveTab("output");
            // Reload current index preview if possible
        } catch (e: any) {
            console.error("Batch Run Error", e);
            toast.error(`오류: ${e.response?.data?.detail || e.message}`);
        }
    };

    const handleSaveToAsset = async () => {
        if (!data.lastAudioResult?.audio_url) return;
        setIsSaving(true);
        try {
            const title = `TTS_Audio_${new Date().getTime()}`;
            await api.post('/assets/import-url', {
                url: data.lastAudioResult.audio_url,
                title: title
            });
            toast.success("자산 라이브러리에 저장되었습니다.");
        } catch (e) {
            console.error(e);
            toast.error("저장 실패");
        } finally {
            setIsSaving(false);
        }
    };

    // --- Result Logic ---
    const getResultForCurrentIndex = () => {
        if (data.executionResult?.items && data.executionResult.items[currentIndex]) {
            return data.executionResult.items[currentIndex];
        }
        // Fallback for single run or legacy
        return data.lastAudioResult;
    };

    const currentResult = getResultForCurrentIndex();

    // Auto-play when current result changes (if valid and tab active)
    useEffect(() => {
        if (activeTab === "output" && currentResult?.audio_url && currentResult.status === "success" && audioRef.current) {
            // Only autoplay if it's a NEW generation or user just switched to it? 
            // To be safe, let's strictly check if timestamp is recent or just let it play if user navigates?
            // User navigation shouldn't auto-play usually, but standard simple UX often does. 
            // Let's stick to: if it exists, load it.
            // CAUTION: modifying src on audio tag auto-reloads.
        }
    }, [currentResult?.audio_url, activeTab]);

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* 1. Header: Batch Navigator & Run Node */}
            <div className="bg-white text-slate-800 border border-slate-200 p-2 flex items-center justify-between shrink-0 h-12">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-white"
                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentIndex === 0}>
                        <ChevronLeft className="w-4 h-4" />
                    </Button>

                    <div className="flex flex-col items-center min-w-[140px]">
                        <span className="text-xs font-mono font-bold text-blue-200">
                            Asset {inputAssets.length > 0 ? currentIndex + 1 : 0} / {inputAssets.length}
                        </span>
                        <span className="text-[10px] text-slate-600 truncate max-w-[150px]">
                            {loadingAssets ? "데이터 불러오는 중..." : (currentAsset.title || "선택된 자산 없음")}
                        </span>
                    </div>

                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-white"
                        onClick={() => setCurrentIndex(prev => Math.min(inputAssets.length - 1, prev + 1))}
                        disabled={currentIndex >= inputAssets.length - 1}>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
                    <Button
                        size="icon"
                        className="h-7 w-7 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg hover:scale-105 transition-all"
                        title="TTS 실행 (Generate)"
                        onClick={handleRun}
                        disabled={isAutoRun}
                    >
                        <Play className="w-3 h-3 fill-current" />
                    </Button>
                </div>
            </div>

            {/* 2. Configuration Panel */}
            <div className={cn("p-4 border-b space-y-4 bg-slate-50 relative group transition-all duration-300", isAutoRun && "bg-slate-100")}>
                {isAutoRun && (
                    <div className="absolute inset-0 bg-white/60 z-20 flex items-center justify-center backdrop-blur-[1px]">
                        <Badge variant="outline" className="bg-white border-orange-200 text-orange-600 shadow-sm px-3 py-1.5 flex gap-2">
                            <Lock className="w-3 h-3" />
                            설정 잠김 (자동 모드)
                        </Badge>
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Music className="w-4 h-4 text-orange-500" />
                        <Label className="font-bold text-slate-700">AI Voice 설정</Label>
                    </div>
                    <div className="flex items-center gap-2 z-30 relative">
                        <Label htmlFor="autorun" className="text-xs font-medium text-slate-600 cursor-pointer">⚡ 자동 실행</Label>
                        <Switch id="autorun" checked={isAutoRun} onCheckedChange={handleAutoRunChange} className="scale-75" />
                    </div>
                </div>

                <div className="max-h-[300px] overflow-y-auto pr-1">
                    <TTSConfigPanel
                        config={config}
                        onChange={handleConfigChange}
                        compact={true}
                    />
                </div>
            </div>

            {/* 3. Split View (Source vs Output) */}
            <div className="flex-1 flex flex-col min-h-0 bg-slate-100">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <div className="bg-white px-3 py-2 border-b flex items-center justify-between shrink-0">
                        <TabsList className="h-7 bg-slate-100 p-0.5">
                            <TabsTrigger value="source" className="text-[10px] h-6 px-3">📄 대본 (Script)</TabsTrigger>
                            <TabsTrigger value="output" className="text-[10px] h-6 px-3">🎵 결과 (Audio)</TabsTrigger>
                        </TabsList>

                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-6 text-[10px] px-2 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 gap-1.5 shadow-sm"
                            onClick={handleRun}
                            disabled={isAutoRun}
                        >
                            <Music className="w-3 h-3 fill-indigo-500 text-indigo-500" />
                            결과 미리듣기
                        </Button>
                    </div>

                    <TabsContent value="source" className="flex-1 p-0 m-0 relative overflow-hidden h-full data-[state=active]:flex flex-col min-h-0">
                        {(!sourceScript) && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 p-6 text-center z-10 pointer-events-none">
                                <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
                                <span className="font-semibold text-xs">⚠️ 대본 데이터 없음</span>
                                <span className="text-[10px] mt-1 text-slate-600">이전 노드에서 전달된 텍스트가 없습니다.</span>
                            </div>
                        )}
                        <Textarea
                            className="w-full h-full resize-none border-0 p-4 text-xs font-mono leading-relaxed focus-visible:ring-0 text-slate-800 pb-8"
                            placeholder="변환할 대본이 여기에 표시됩니다."
                            value={loadingAssets ? "데이터 불러오는 중..." : sourceScript}
                            onChange={(e) => setSourceScript(e.target.value)}
                        />
                        <div className="absolute bottom-2 right-4 text-[10px] text-slate-600 bg-white/80 px-1.5 py-0.5 rounded pointer-events-none">
                            {sourceScript.length.toLocaleString()} 자
                        </div>
                    </TabsContent>

                    <TabsContent value="output" className="flex-1 p-0 m-0 overflow-hidden bg-white h-full data-[state=active]:flex flex-col min-h-0 relative items-center justify-center">
                        {/* Audio Player Logic */}
                        {currentResult?.audio_url ? (
                            <div className="text-center space-y-3 p-4">
                                <div className="p-3 bg-orange-50 rounded-full inline-block animate-pulse">
                                    <Volume2 className="w-6 h-6 text-orange-500" />
                                </div>
                                <div className="mb-2">
                                    <h3 className="font-semibold text-sm">오디오 생성 완료 ({currentIndex + 1}/{inputAssets.length})</h3>
                                    <p className="text-[10px] text-muted-foreground">
                                        {currentResult.timestamp ? new Date(currentResult.timestamp).toLocaleTimeString() : '방금 전'} 생성됨
                                    </p>
                                    {/* Debug Info (Optional) */}
                                    {/* <p className="text-[9px] text-slate-700 mt-1">{currentResult.audio_url.split('/').pop()}</p> */}
                                </div>

                                {/* Key is important to force reload on url change */}
                                <audio
                                    key={currentResult.audio_url}
                                    ref={audioRef}
                                    controls
                                    src={currentResult.audio_url}
                                    className="hidden"
                                />

                                {/* Custom Controls */}
                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                    <Button variant="outline" size="sm" onClick={handlePlay} className="h-8 px-3 text-xs">
                                        <Play className="w-3.5 h-3.5 mr-1 ml-[-2px] fill-current" /> 재생
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handlePause} className="h-8 px-3 text-xs">
                                        <Pause className="w-3.5 h-3.5 mr-1 fill-current" /> 일시정지
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handleStop} className="h-8 px-3 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                                        <Square className="w-3.5 h-3.5 mr-1 fill-current" /> 정지
                                    </Button>
                                </div>

                                <div className="flex items-center justify-center gap-2 pt-1">
                                    <Button size="sm" variant="outline" className="h-7 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={handleSaveToAsset} disabled={isSaving}>
                                        <Save className="w-3 h-3 mr-1.5" />
                                        {isSaving ? "저장 중..." : "자산 저장"}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-[10px] text-slate-600" onClick={() => window.open(currentResult.audio_url, '_blank')}>
                                        <Download className="w-3 h-3 mr-1.5" /> 다운로드
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-slate-600">
                                {currentResult?.status === 'failed' ? (
                                    <>
                                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
                                        <p className="text-xs text-red-500">생성 실패: {currentResult.error || "알 수 없는 오류"}</p>
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        <p className="text-xs">실행 버튼을 눌러 오디오를 생성하세요.</p>
                                    </>
                                )}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default AIVoiceNodeInspector;
