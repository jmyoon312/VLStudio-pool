import React, { useState, useEffect, useMemo } from 'react';
import { Node, useReactFlow, useNodes } from 'reactflow';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wand2, Sparkles, Plus, Trash2, ChevronLeft, ChevronRight, Play, Zap, BrainCircuit, RotateCw, AlertTriangle, Lock, Edit, Settings, Database, History, Eye, RefreshCcw, Globe, Image as ImageIcon, Link as LinkIcon, ExternalLink, Download } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { ScriptStyle } from '@/lib/api';
import { useToast } from "@/components/ui/use-toast";
import AIModelSelector from '@/components/shared/AIModelSelector';
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AIAgentInspectorProps {
    node: Node;
    updateData: (data: any) => void;
}


const AIAgentInspector = ({ node, updateData }: AIAgentInspectorProps) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { getNodes, getEdges, setNodes } = useReactFlow();

    // --- Advanced Settings State ---
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showDebugContext, setShowDebugContext] = useState(false);
    const [debugContextData, setDebugContextData] = useState<any>(null); // For View Context modal

    // --- Style Management State ---
    const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
    const [editingStyle, setEditingStyle] = useState<any | null>(null);
    const [styleFormName, setStyleFormName] = useState("");
    const [styleFormInstruction, setStyleFormInstruction] = useState("");
    const [styleFormSample, setStyleFormSample] = useState("");

    // --- Style Mutations ---
    const createStyleMutation = useMutation({
        mutationFn: async (data: any) => (await api.post('/script/styles', data)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scriptStyles'] });
            setIsStyleModalOpen(false);
            resetStyleForm();
            toast({ title: "저장 완료", description: "스타일이 저장되었습니다." });
        }
    });

    const updateStyleMutation = useMutation({
        mutationFn: async (data: any) => (await api.put(`/script/styles/${editingStyle?.id}`, data)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scriptStyles'] });
            setIsStyleModalOpen(false);
            resetStyleForm();
            toast({ title: "수정 완료", description: "스타일이 수정되었습니다." });
        }
    });



    const handleSaveStyle = () => {
        const data = {
            name: styleFormName,
            system_instruction: styleFormInstruction,
            sample_text: styleFormSample
        };
        if (editingStyle) updateStyleMutation.mutate(data);
        else createStyleMutation.mutate(data);
    };

    const handleEditStyle = (style: any) => {
        setEditingStyle(style);
        setStyleFormName(style.name);
        setStyleFormInstruction(style.system_instruction);
        setStyleFormSample(style.sample_text || "");
        setIsStyleModalOpen(true);
    };

    const resetStyleForm = () => {
        setEditingStyle(null);
        setStyleFormName("");
        setStyleFormInstruction("");
        setStyleFormSample("");
    };

    // --- Data Pipeline State ---
    const [inputAssets, setInputAssets] = useState<any[]>([]);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const [assetsError, setAssetsError] = useState<boolean>(false);

    // --- Config State ---
    const [provider, setProvider] = useState(node.data.config?.provider || 'groq'); // Default to Groq
    const [model, setModel] = useState(node.data.config?.model || 'llama-3.3-70b-versatile');
    const [selectedStyleId, setSelectedStyleId] = useState<string>(String(node.data.presetId || ""));
    const [systemPrompt, setSystemPrompt] = useState(node.data.systemPrompt || "");
    const [isAutoRun, setIsAutoRun] = useState(node.data.isAutoRun || false);

    // Persistent Engine Settings
    const [useSmartCache, setUseSmartCache] = useState(node.data.config?.useSmartCache ?? true); // Default True
    const [useMemory, setUseMemory] = useState(node.data.config?.useMemory ?? false); // Default False

    // Research Tools State
    const [useWebSearch, setUseWebSearch] = useState(node.data.config?.useWebSearch ?? false);
    const [includeImages, setIncludeImages] = useState(node.data.config?.includeImages ?? true);
    const [showResearch, setShowResearch] = useState(false);

    // --- Batch State ---
    const [currentIndex, setCurrentIndex] = useState(0);
    const [activeTab, setActiveTab] = useState("source");
    const currentAsset = inputAssets[currentIndex] || {};
    // --- Output State (HYDRATION FROM SDP) ---
    // Look for 'executionResult.items' (Standard Protocol)
    const executionItems = node.data.executionResult?.items || [];
    // If no execution items, fall back to empty.

    // Derived current output based on matching ID or Index
    const currentResultItem = executionItems.find((item: any) => {
        // Match by Source ID (preferred)
        const sourceId = item.json?.source_id;
        if (sourceId && currentAsset.id) return sourceId === currentAsset.id;
        return false;
    }) || executionItems[currentIndex]; // Fallback to index if no ID match

    // Helper: Safely extract script
    const getScriptContent = () => {
        if (currentResultItem?.json?.script) return currentResultItem.json.script;
        if (currentResultItem?.json?.generated_text) return currentResultItem.json.generated_text;
        // Legacy fallback
        if (node.data.outputScript) return node.data.outputScript;
        return "";
    };

    // --- Output State (Local + Sync) ---
    const initialScript = getScriptContent();
    const [outputScript, setOutputScript] = useState(initialScript);

    // Sync local state when matching upstream item changes
    const resultSignature = currentResultItem ? JSON.stringify(currentResultItem) : 'null';
    useEffect(() => {
        const fresh = getScriptContent();
        // Only update if fresh content is actually different and we have a new result signature
        // This prevents overwriting manual edits/test runs when other node props update
        if (fresh && fresh !== outputScript) setOutputScript(fresh);
    }, [resultSignature]);

    // --- Source Script State (Editable) ---
    const [sourceScript, setSourceScript] = useState("");

    // Helper to format source
    const formatSource = (text: string) => {
        if (!text) return "";
        return text.replace(/(\r\n|\n|\r)/gm, " ")
            .split(/(?<=[.?!])\s+/)
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0)
            .join("\n");
    };

    // Effect: Sync sourceScript when currentAsset changes
    useEffect(() => {
        const rawContent = currentAsset.transcript || currentAsset.content || currentAsset.text || currentAsset.script || currentAsset.generated_text || "";
        // Only format if it looks like raw text
        if (typeof rawContent === 'string') {
            setSourceScript(formatSource(rawContent));
        } else {
            setSourceScript(JSON.stringify(rawContent, null, 2));
        }
    }, [currentAsset]);

    // --- Fetch Upstream Data (The Pipe) ---
    // --- Fetch Upstream Data (The Pipe) ---
    // Optimization: Memoize upstream source data to prevent infinite loops in useEffect
    const nodes = useNodes();
    const edges = getEdges();

    // Find upstream source node *during render*
    const upstreamData = useMemo(() => {
        const incomingEdge = edges.find(e => e.target === node.id);
        if (!incomingEdge) return null;
        const sourceNode = nodes.find(n => n.id === incomingEdge.source);
        return sourceNode ? {
            id: sourceNode.id,
            executionResult: sourceNode.data.executionResult,
            selectedIds: sourceNode.data.selectedIds
        } : null;
    }, [nodes, edges, node.id]);

    useEffect(() => {
        const fetchUpstreamData = async () => {
            if (!upstreamData) {
                if (inputAssets.length > 0) setInputAssets([]);
                return;
            }

            // PRIORITY 1: Check if Source Node already has executionResult (Hydrated State)
            const sourceExecution = upstreamData.executionResult;
            if (sourceExecution?.items) {
                const hydratedAssets = sourceExecution.items.map((item: any) => item.json || item);
                if (JSON.stringify(hydratedAssets) !== JSON.stringify(inputAssets)) {
                    setInputAssets(hydratedAssets);
                    updateData({ assets: hydratedAssets });
                    setAssetsError(false);
                }
                return; // Skip API call
            }

            // PRIORITY 2: Fallback to API Fetch using selectedIds
            if (upstreamData.selectedIds) {
                const ids: number[] = upstreamData.selectedIds;
                if (Array.isArray(ids) && ids.length > 0) {
                    // Check if we already have these assets loaded to prevent refetch loop
                    if (inputAssets.length !== ids.length || !inputAssets[0]?.id) { // Simple heuristic
                        setLoadingAssets(true);
                        try {
                            const res = await api.post('/videos/batch-details', { ids });
                            const loadedAssets = res.data;
                            setInputAssets(loadedAssets);
                            updateData({ assets: loadedAssets });
                            setAssetsError(false);
                        } catch (err) {
                            console.error("Failed to fetch batch details", err);
                            setAssetsError(true);
                        } finally {
                            setLoadingAssets(false);
                        }
                    }
                } else {
                    if (inputAssets.length > 0) setInputAssets([]);
                }
            }
        };

        fetchUpstreamData();
        // Use stringified upstream data to break reference cycle
    }, [JSON.stringify(upstreamData), node.id]);

    // --- Fetch Presets & Models ---
    const { data: scriptStyles } = useQuery({
        queryKey: ['scriptStyles'],
        queryFn: async () => (await api.get('/creative/script-styles')).data
    });



    // --- Preset Selection ---
    useEffect(() => {
        if (selectedStyleId && scriptStyles) {
            const style = scriptStyles.find((s: any) => String(s.id) === selectedStyleId);
            if (style) {
                setSystemPrompt(style.system_instruction);
            }
        }
    }, [selectedStyleId, scriptStyles]);

    // --- Action: Test Run (Single) ---
    // [NEW] Asset Import Logic
    const handleSaveAsset = async (imageUrl: string, title: string) => {
        try {
            toast({ title: "자산 저장 중...", description: "이미지를 다운로드하고 있습니다." });
            await api.post('/assets/import-url', { url: imageUrl, title });
            toast({ title: "성공", description: "이미지가 자산 라이브러리에 저장되었습니다." });
        } catch (e: any) {
            toast({ title: "저장 실패", description: e.message, variant: "destructive" });
        }
    };

    const handleTestRun = async () => {
        const textContent = sourceScript || currentAsset.transcript || currentAsset.text || currentAsset.script;
        if (!textContent) {
            toast({ title: "실행 불가", description: "입력 데이터(자막/텍스트)가 없습니다.", variant: "destructive" });
            return;
        }
        if (!systemPrompt) {
            toast({ title: "실행 불가", description: "시스템 프롬프트가 비어있습니다.", variant: "destructive" });
            return;
        }

        try {
            toast({ title: "테스트 실행 중...", description: `[${provider}/${model}] 응답 생성 중...` });

            // Construct Strict Payload for Backend
            // Matches GenerateScriptRequest schema
            const payload = {
                provider: provider,
                model: model,
                system_instruction: systemPrompt,
                input_text: textContent,
                node_id: node.id || "test_run",
                config: {
                    use_web_search: useWebSearch,
                    include_images: includeImages,
                    use_memory: useMemory,
                    use_smart_cache: useSmartCache
                }
            };

            const res = await api.post('/creative/generate-script', payload);

            let cleanScript = res.data.script.replace(/<think>[\s\S]*?<\/think>/gi, '');
            cleanScript = cleanScript.replace(/\*\*/g, '');
            cleanScript = cleanScript.replace(/\([^)]*\)/g, '').trim();
            setOutputScript(cleanScript);
            setActiveTab("output");
            toast({ title: "생성 완료", description: "AI 응답이 도착했습니다." });
        } catch (e: any) {
            console.error("Test Run Failed:", e);
            const errorDetail = e.response?.data?.detail || e.message;
            toast({
                variant: "destructive",
                title: "생성 실패 (Server Error)",
                description: `오류가 발생했습니다: ${errorDetail}`
            });
        }
    };

    // --- Action: Reset Memory/Cache ---
    const handleResetData = async (type: 'memory' | 'cache') => {
        const workflowId = window.location.pathname.split('/workflows/')[1];
        if (!workflowId) return;

        try {
            await api.delete(`/workflows/${workflowId}/nodes/${node.id}/${type}`);
            toast({
                title: `${type === 'memory' ? '기억' : '캐시'} 초기화 완료`,
                description: `이 노드의 ${type === 'memory' ? '대화 내역' : '임시 저장 데이터'}가 삭제되었습니다.`
            });
        } catch (e: any) {
            toast({ variant: "destructive", title: "초기화 실패", description: e.message });
        }
    };

    // --- Debug Context Logic ---
    const handleViewContext = async () => {
        // Prepare Static Context
        const staticContext = {
            system: systemPrompt,
            user_input: sourceScript,
            upstream_meta: currentAsset,
            config: { useSmartCache, useMemory }
        };
        setDebugContextData(staticContext);

        // Fetch Dynamic Memory Context
        if (useMemory) {
            const workflowId = window.location.pathname.split('/workflows/')[1];
            if (workflowId) {
                try {
                    const res = await api.get(`/workflows/${workflowId}/nodes/${node.id}/memory`);
                    setDebugContextData((prev: any) => ({ ...prev, memory: res.data }));
                } catch (e) {
                    console.error("Failed to fetch memory", e);
                    setDebugContextData((prev: any) => ({ ...prev, memory: { error: "Failed to load memory" } }));
                }
            }
        }

        setShowDebugContext(true);
    };

    const handleRefreshMemory = async () => {
        const workflowId = window.location.pathname.split('/workflows/')[1];
        if (workflowId) {
            try {
                const res = await api.get(`/workflows/${workflowId}/nodes/${node.id}/memory`);
                setDebugContextData((prev: any) => ({ ...prev, memory: res.data }));
                toast({ title: "새로고침 완료", description: "기억 컨텍스트가 갱신되었습니다." });
            } catch (e) {
                toast({ title: "갱신 실패", variant: "destructive" });
            }
        }
    };

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
                        title="전체 노드 실행 (Batch Run)"
                        onClick={async () => {
                            // REVERSE EXECUTION TRIGGER
                            // 1. Find Upstream Source
                            const edges = getEdges();
                            const nodes = getNodes();
                            const incoming = edges.find(e => e.target === node.id);
                            if (!incoming) {
                                toast({ title: "실행 불가", description: "연결된 이전 노드(입력)가 없습니다.", variant: "destructive" });
                                return;
                            }
                            const sourceNode = nodes.find(n => n.id === incoming.source);
                            // 2. Resolve IDs
                            // If source has 'selectedIds' (AssetLoader), use them.
                            // Else, warn.
                            const selectedIds = sourceNode?.data?.selectedIds || [];
                            if (!selectedIds.length && !inputAssets.length) {
                                toast({ title: "실행 불가", description: "이전 노드에서 선택된 자산이 없습니다.", variant: "destructive" });
                                return;
                            }

                            // 3. Trigger Run
                            const workflowId = window.location.pathname.split('/workflows/')[1];
                            if (!workflowId) return;

                            // Use Upstream IDs if available, else relying on what we have (not optimal for fresh run)
                            // Assuming AssetLoader holds the truth.
                            try {
                                toast({ title: "설정 저장 및 실행 중...", description: `${selectedIds.length}개 자산 처리 시작` });

                                // [FIX] Save current config to backend before running
                                // This ensures the backend uses the latest Prompt/Model
                                await api.put(`/workflows/${workflowId}/nodes/${node.id}`, {
                                    data: {
                                        ...node.data,
                                        config: {
                                            provider,
                                            model,
                                            useSmartCache,
                                            useMemory,
                                            useWebSearch,
                                            includeImages
                                        },
                                        systemPrompt,
                                        presetId: selectedStyleId
                                    }
                                });

                                const res = await api.post(`/workflows/${workflowId}/run`, {
                                    selected_ids: selectedIds,
                                    target_node_id: node.id // [FIX] Partial Execution: Only run up to THIS node
                                });

                                // [FIX] MANUAL HYDRATION & SOURCE UPDATE
                                const outputs = res.data.node_outputs || {};

                                // 1. Update Graph State (Global)
                                setNodes((nds) => nds.map((n) => {
                                    if (outputs[n.id]) {
                                        return { ...n, data: { ...n.data, executionResult: outputs[n.id], timestamp: Date.now(), status: 'success' } };
                                    }
                                    return n;
                                }));

                                // 2. Update Local Inspector State (Immediate Feedback)
                                const upstreamEdge = getEdges().find(e => e.target === node.id);
                                if (upstreamEdge) {
                                    const upstreamResult = outputs[upstreamEdge.source];
                                    if (upstreamResult && upstreamResult.items) {
                                        // Explicitly update input assets from the FRESH result
                                        const freshAssets = upstreamResult.items.map((item: any) => item.json || item);
                                        setInputAssets(freshAssets);
                                        // Also ensure we are looking at the same index
                                        if (currentIndex >= freshAssets.length) setCurrentIndex(0);
                                    }
                                }

                                toast({ title: "실행 완료", description: "결과가 업데이트되었습니다." });
                                setActiveTab("output"); // [FIX] Auto-switch to result tab
                            } catch (e: any) {
                                console.error(e);
                                toast({ title: "실행 실패", description: e.message, variant: "destructive" });
                            }
                        }}
                    >
                        <Play className="w-3 h-3 fill-current" />
                    </Button>
                </div>
            </div>

            {/* 2. Configuration Panel (Locked on Auto-Run) */}
            <div className={`p-4 border-b space-y-4 bg-slate-50 relative group transition-all duration-300 ${isAutoRun ? 'bg-slate-100' : ''}`}>
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
                        <BrainCircuit className="w-4 h-4 text-purple-600" />
                        <Label className="font-bold text-slate-700">AI 구성 (Configuration)</Label>
                    </div>
                    <div className="flex items-center gap-2 z-30 relative">
                        <Label htmlFor="autorun" className="text-xs font-medium text-slate-600 cursor-pointer">⚡ 자동 실행</Label>
                        <Switch id="autorun" checked={isAutoRun} onCheckedChange={setIsAutoRun} className="scale-75" />
                    </div>
                </div>

                <AIModelSelector
                    provider={provider || 'groq'}
                    onProviderChange={setProvider}
                    model={model}
                    onModelChange={setModel}
                    presetId={selectedStyleId} // Revert cast if possible, or keep as string
                    onPresetChange={(val) => setSelectedStyleId(val === "none" ? "" : val)}
                    showPreset={true}
                    compact={true}
                    disabled={isAutoRun}
                    onCreatePreset={() => { resetStyleForm(); setIsStyleModalOpen(true); }}
                    onEditPreset={(style: any) => {
                        const s = scriptStyles?.find((st: any) => String(st.id) === String(style.id));
                        if (s) handleEditStyle(s);
                    }}
                />

                {/* Manual System Prompt Override if no preset */}
                {(!selectedStyleId || selectedStyleId === "none") && (
                    <div className="pt-2">
                        <Label className="text-[10px] text-slate-500 mb-1 block">직접 입력 (System Prompt)</Label>
                        <Textarea
                            className="h-20 text-[10px] resize-none bg-white"
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder="AI에게 내릴 지침을 입력하세요."
                            disabled={isAutoRun}
                        />
                    </div>
                )}


                {/* Advanced Settings Toggle */}
                <div className="pt-2 border-t border-slate-200 mt-2">
                    <div
                        className="flex items-center justify-between cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            <Settings className="w-3 h-3" />
                            고급 설정 (Advanced)
                        </div>
                        <ChevronRight className={`w-3 h-3 text-slate-600 transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                    </div>

                    {showAdvanced && (
                        <div className="mt-3 space-y-3 pl-1 animate-in slide-in-from-top-2 duration-200">
                            {/* Toggles */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Database className="w-3 h-3 text-emerald-600" />
                                    <Label className="text-[10px] text-slate-600">스마트 캐시 (Smart Cache)</Label>
                                </div>
                                <Switch checked={useSmartCache} onCheckedChange={setUseSmartCache} disabled={isAutoRun} className="scale-75" />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <History className="w-3 h-3 text-blue-600" />
                                    <Label className="text-[10px] text-slate-600">기억 유지 (Conversation Memory)</Label>
                                </div>
                                <Switch checked={useMemory} onCheckedChange={setUseMemory} disabled={isAutoRun} className="scale-75" />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1" onClick={() => handleResetData('cache')}>
                                    <RefreshCcw className="w-3 h-3 mr-1" /> 캐시 초기화
                                </Button>
                                <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1" onClick={() => handleResetData('memory')}>
                                    <Trash2 className="w-3 h-3 mr-1" /> 기억 삭제
                                </Button>
                            </div>

                            <Button variant="ghost" size="sm" className="h-6 text-[10px] w-full text-slate-500" onClick={handleViewContext}>
                                <Eye className="w-3 h-3 mr-1" /> 디버그: 컨텍스트 보기
                            </Button>
                        </div>
                    )}
                </div>

                {/* Research Tools Toggle */}
                <div className="pt-2 border-t border-slate-200 mt-2">
                    <div
                        className="flex items-center justify-between cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors"
                        onClick={() => setShowResearch(!showResearch)}
                    >
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            <Globe className="w-3 h-3 text-sky-600" />
                            도구 및 리서치 (Research Tools)
                        </div>
                        <ChevronRight className={`w-3 h-3 text-slate-600 transform transition-transform ${showResearch ? 'rotate-90' : ''}`} />
                    </div>

                    {showResearch && (
                        <div className="mt-3 space-y-3 pl-1 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-[10px] text-slate-600">최신 정보 검색 (Web Search)</Label>
                                        <Badge variant="outline" className="text-[9px] h-4 px-1 text-slate-600 font-normal">Tavily</Badge>
                                    </div>
                                    <p className="text-[10px] text-slate-600 leading-tight">AI가 검색어를 판단하여 정보를 찾습니다.</p>
                                </div>
                                <Switch checked={useWebSearch} onCheckedChange={setUseWebSearch} disabled={isAutoRun} className="scale-75" />
                            </div>

                            {useWebSearch && (
                                <div className="flex items-center gap-2 pl-2 border-l-2 border-slate-100">
                                    <input
                                        type="checkbox"
                                        id="includeImages"
                                        checked={includeImages}
                                        onChange={(e) => setIncludeImages(e.target.checked)}
                                        className="rounded border-slate-300 w-3 h-3 text-sky-600 focus:ring-0"
                                    />
                                    <Label htmlFor="includeImages" className="text-[10px] text-slate-500 cursor-pointer flex items-center gap-1">
                                        <ImageIcon className="w-3 h-3" />
                                        관련 이미지 찾기 (Include Images)
                                    </Label>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>


            {/* 3. Split View (Source vs Output) */}
            <div className="flex-1 flex flex-col min-h-0 bg-slate-100">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <div className="bg-white px-3 py-2 border-b flex items-center justify-between shrink-0">
                        <TabsList className="h-7 bg-slate-100 p-0.5">
                            <TabsTrigger value="source" className="text-[10px] h-6 px-3">📄 원본 (Source)</TabsTrigger>
                            <TabsTrigger value="output" className="text-[10px] h-6 px-3">✨ 결과 (Result)</TabsTrigger>
                        </TabsList>

                        {/* Execution Meta Badge Removed */}

                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-6 text-[10px] px-2 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 gap-1.5 shadow-sm"
                            onClick={handleTestRun}
                            disabled={isAutoRun}
                        >
                            <Zap className="w-3 h-3 fill-indigo-500 text-indigo-500" />
                            AI 결과 미리보기
                        </Button>
                    </div>

                    <TabsContent value="source" className="flex-1 p-0 m-0 relative overflow-hidden h-full data-[state=active]:flex flex-col min-h-0">
                        {(!currentAsset.transcript && !currentAsset.text && !currentAsset.script && !currentAsset.content && !currentAsset.generated_text && !loadingAssets && !sourceScript) && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 p-6 text-center z-10 pointer-events-none">
                                <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
                                <span className="font-semibold text-xs">⚠️ 자막 데이터 없음</span>
                                <span className="text-[10px] mt-1 text-slate-600">이 자산에는 사용할 수 있는 텍스트가 없습니다.</span>
                            </div>
                        )}
                        <Textarea
                            className="w-full h-full resize-none border-0 p-4 text-xs font-mono leading-relaxed focus-visible:ring-0 text-slate-800 pb-8"
                            placeholder="원본 텍스트가 여기에 표시됩니다. 필요시 수정할 수 있습니다."
                            value={loadingAssets ? "데이터 불러오는 중..." : sourceScript}
                            onChange={(e) => setSourceScript(e.target.value)}
                        />
                        {/* Character Count Overlay */}
                        <div className="absolute bottom-2 right-4 text-[10px] text-slate-600 bg-white/80 px-1.5 py-0.5 rounded pointer-events-none">
                            {sourceScript.length.toLocaleString()} 자
                        </div>
                    </TabsContent>

                    <TabsContent value="output" className="flex-1 p-0 m-0 overflow-hidden bg-white h-full data-[state=active]:flex flex-col min-h-0 relative">
                        <Textarea
                            className="w-full h-full resize-none border-0 p-4 text-xs font-mono leading-relaxed focus-visible:ring-0 text-slate-800 pb-8"
                            placeholder="실행 버튼을 누르면 결과가 여기에 표시됩니다..."
                            value={outputScript}
                            onChange={(e) => setOutputScript(e.target.value)}
                        />
                        {/* Character Count Overlay */}
                        <div className="absolute bottom-2 right-4 text-[10px] text-slate-600 bg-white/80 px-1.5 py-0.5 rounded pointer-events-none border border-slate-100 shadow-sm">
                            {outputScript.length.toLocaleString()} 자
                        </div>

                        {/* Research Results (Citations & Images) */}
                        {currentResultItem?.json?._execution_meta?.tool_data && (
                            <div className="border-t bg-slate-50 p-3 space-y-3 overflow-y-auto max-h-[200px] shrink-0">

                                {/* Images Carousel */}
                                {currentResultItem.json._execution_meta.tool_data.images?.length > 0 && (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                                            <ImageIcon className="w-3 h-3" />
                                            발견된 이미지 (Research Images)
                                        </div>
                                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
                                            {currentResultItem.json._execution_meta.tool_data.images.map((img: string, idx: number) => (
                                                <div key={idx} className="relative w-24 h-16 shrink-0 rounded overflow-hidden border bg-white group hover:ring-2 ring-sky-400 transition-all">
                                                    <img src={img} className="w-full h-full object-cover cursor-pointer" alt={`Res ${idx}`} onClick={() => window.open(img, '_blank')} />

                                                    {/* Convert/Save Button Overlay */}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none group-hover:pointer-events-auto">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSaveAsset(img, `Web Image ${idx + 1}`);
                                                            }}
                                                            className="bg-white/90 hover:bg-white text-black rounded-full p-1.5 shadow-sm transform scale-90 hover:scale-100 transition-transform"
                                                            title="자산으로 저장 (Save to Assets)"
                                                        >
                                                            <Download className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Citations List */}
                                {currentResultItem.json._execution_meta.tool_data.results?.length > 0 && (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                                            <LinkIcon className="w-3 h-3" />
                                            참고 문헌 (Sources)
                                        </div>
                                        <div className="space-y-1">
                                            {currentResultItem.json._execution_meta.tool_data.results.map((res: any, idx: number) => (
                                                <a key={idx} href={res.url} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-start gap-2 p-1.5 rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all group">
                                                    <div className="bg-white p-1 rounded border text-[8px] font-mono text-slate-600 group-hover:text-sky-500 min-w-[20px] text-center">{idx + 1}</div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[10px] font-medium text-slate-700 truncate group-hover:text-sky-700">{res.title}</div>
                                                        <div className="text-[9px] text-slate-600 truncate">{res.url}</div>
                                                    </div>
                                                    <ExternalLink className="w-3 h-3 text-slate-700 group-hover:text-sky-400 opacity-0 group-hover:opacity-100" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div >


            {/* Zone 3: Style Management Modal */}
            < Dialog open={isStyleModalOpen} onOpenChange={setIsStyleModalOpen} >
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingStyle ? '스타일 수정' : '새 스타일 추가'}</DialogTitle>
                        <DialogDescription>
                            AI가 대본을 생성할 때 따를 규칙과 예시를 정의합니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">스타일 이름 (Name)</Label>
                            <Input
                                value={styleFormName}
                                onChange={(e) => setStyleFormName(e.target.value)}
                                placeholder="예: 쇼츠용, 뉴스용"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">프롬프트 (Instruction)</Label>
                            <Textarea
                                value={styleFormInstruction}
                                onChange={(e) => setStyleFormInstruction(e.target.value)}
                                placeholder="이 스타일이 적용될 때 AI에게 전달할 지시사항을 입력하세요."
                                className="h-32 resize-none text-sm leading-relaxed"
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex justify-between sm:justify-between">
                        {editingStyle ? (
                            <div className="text-xs text-slate-600 p-2">수정 모드</div>
                        ) : <div></div>}
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsStyleModalOpen(false)}>취소</Button>
                            <Button onClick={handleSaveStyle}>저장</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>

            </Dialog >

            {/* Zone 4: Debug Context Modal */}
            {/* Zone 4: Debug Context Modal */}
            <Dialog open={showDebugContext} onOpenChange={setShowDebugContext}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="w-5 h-5 text-slate-500" />
                            실행 컨텍스트 (Debug View)
                        </DialogTitle>
                        <DialogDescription>
                            AI에게 전달되는 실제 데이터와 설정을 확인합니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6">
                        {/* Section A: System */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                <Settings className="w-4 h-4 text-purple-600" />
                                시스템 프롬프트 (System Persona)
                            </Label>
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 font-mono whitespace-pre-wrap max-h-[150px] overflow-y-auto leading-relaxed">
                                {debugContextData?.system || "설정된 프롬프트가 없습니다."}
                            </div>
                        </div>

                        {/* Section B: Memory (New) */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                    <Database className="w-4 h-4 text-blue-600" />
                                    기억 컨텍스트 (Memory Context)
                                    {debugContextData?.memory?.turn_count > 0 && (
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px] h-5">
                                            {debugContextData.memory.turn_count} / {debugContextData.memory.max_limit || 10} Turns
                                        </Badge>
                                    )}
                                </Label>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleRefreshMemory}>
                                    <RefreshCcw className="w-3 h-3 text-slate-600 hover:text-blue-500" />
                                </Button>
                            </div>

                            {!useMemory ? (
                                <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded text-center text-xs text-slate-600">
                                    기억 기능이 비활성화되어 있습니다. (Memory Disabled)
                                </div>
                            ) : (
                                <div className="border rounded-md bg-white h-[250px] flex flex-col">
                                    {/* Chat Log View */}
                                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50">
                                        {debugContextData?.memory?.history?.length > 0 ? (
                                            debugContextData.memory.history.map((msg: any, idx: number) => (
                                                <div key={idx} className={`flex flex-col gap-1 max-w-[90%] ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                                                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider px-1">
                                                        {msg.role === 'user' ? 'User Input' : 'AI Output'}
                                                    </span>
                                                    <div className={`text-xs px-3 py-2 rounded-lg leading-relaxed shadow-sm ${msg.role === 'user'
                                                        ? 'bg-blue-600 text-white rounded-br-none'
                                                        : 'bg-white border text-slate-700 rounded-bl-none'
                                                        }`}>
                                                        {msg.content}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                                                <History className="w-6 h-6 opacity-20" />
                                                <span className="text-xs">이전 대화 기억이 없습니다. (First Run)</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-slate-100 px-3 py-1.5 border-t text-[10px] text-slate-500 flex justify-between">
                                        <span>Backend State</span>
                                        <span className="font-mono">{debugContextData?.memory?.node_id}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Section C: Current Input */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-500" />
                                현재 입력 데이터 (Current Input)
                            </Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-md border text-xs">
                                    <div className="font-semibold mb-1 text-slate-500">Config Snapshot</div>
                                    <pre className="text-[10px] text-slate-600 overflow-hidden text-ellipsis">
                                        {JSON.stringify(debugContextData?.config, null, 2)}
                                    </pre>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-md border text-xs">
                                    <div className="font-semibold mb-1 text-slate-500">Meta Snapshot</div>
                                    <div className="space-y-1 text-[10px] text-slate-600">
                                        <div>Title: {debugContextData?.upstream_meta?.title || 'Unknown'}</div>
                                        <div>ID: {debugContextData?.upstream_meta?.video_id || 'Unknown'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog >
        </div >
    );
};

export default AIAgentInspector;
