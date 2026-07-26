import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { ScriptStyle, ScriptGenerationRequest, ScriptGenerationResponse, ScriptRefinementRequest, TrendItem, TrendKeyword } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Sparkles, Wand2, ShieldAlert, Copy, Check, Trash2, Edit, Plus, Mic, Globe, Search, TrendingUp, ChevronDown, ChevronRight, FileText, ExternalLink, Zap, Activity, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { formatTextWithLineBreaks } from "@/lib/utils";
import AIModelSelector from '@/components/shared/AIModelSelector';


const ScriptWriter = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selectedStyleId, setSelectedStyleId] = useState<string>("");
    const [glossary, setGlossary] = useState<string>("");
    const [niche, setNiche] = useState<string>("");
    const [useWebSearch, setUseWebSearch] = useState<boolean>(true);
    const [scriptProvider, setScriptProvider] = useState<string>("groq");
    const [scriptModel, setScriptModel] = useState<string>("groq/llama-3.3-70b-versatile");
    const [inputText, setInputText] = useState<string>(() => {
        return localStorage.getItem('viral_loop_script_writer_input') || "";
    });
    const [resultText, setResultText] = useState<string>(() => {
        return localStorage.getItem('viral_loop_script_writer_result') || "";
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);

    const [editingStyle, setEditingStyle] = useState<ScriptStyle | null>(null);
    const [styleFormName, setStyleFormName] = useState("");
    const [styleFormInstruction, setStyleFormInstruction] = useState("");
    const [styleFormSample, setStyleFormSample] = useState("");

    const [lastResponse, setLastResponse] = useState<ScriptGenerationResponse | null>(null);
    const [showResearch, setShowResearch] = useState(false);

    // Auto-save texts to localStorage for session durability
    useEffect(() => {
        localStorage.setItem('viral_loop_script_writer_input', inputText);
    }, [inputText]);

    useEffect(() => {
        localStorage.setItem('viral_loop_script_writer_result', resultText);
    }, [resultText]);

    useEffect(() => {
        if (location.state?.initialScript) {
            setInputText(location.state.initialScript);
            toast.success("자막을 불러왔습니다.");
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Fetch Styles
    const { data: styles, isLoading: isLoadingStyles } = useQuery<ScriptStyle[]>({
        queryKey: ['scriptStyles'],
        queryFn: async () => (await api.get('/script/styles')).data
    });

    // Fetch Trends (only when niche is provided)
    const { data: trends } = useQuery<TrendItem[]>({
        queryKey: ['trends', niche],
        queryFn: async () => (await api.get('/trends', { params: { category: niche, limit: 5 } })).data,
        enabled: !!niche,
        staleTime: 1000 * 60 * 2
    });
    const [showTrends, setShowTrends] = useState(false);

    // Mutations
    const generateMutation = useMutation({
        mutationFn: async (data: ScriptGenerationRequest) => {
            console.log(" Sending generation request...", data);
            const response = await api.post('/script/generate', data, { timeout: 180000 });
            console.log(" Response received:", response.status, response.data);
            return response.data;
        },
        onSuccess: (data: ScriptGenerationResponse) => {
            setResultText(data.script);
            setLastResponse(data);
            if (data.research_used || data.trend_used) {
                setShowResearch(true);
            }
            if (data.warning) {
                toast.warning("모델 자동 전환됨", {
                    description: data.warning,
                    duration: 5000
                });
            } else {
                let msg = `대본 생성 완료! (${data.model_used})`;
                if (data.research_used) msg += " 웹검색 ON";
                if (data.trend_used) msg += ` 트렌드+${data.trend_count}`;
                toast.success(msg);
            }
        },
        onError: (error: any) => {
            console.error(" Generation failed:", error);
            let errorMessage = "대본 생성 실패";
            if (error.code === 'ECONNABORTED') {
                errorMessage = "요청 시간이 초과되었습니다. (Timeout)";
            } else if (error.response?.data?.detail) {
                errorMessage = `오류: ${error.response.data.detail}`;
            } else if (error.message) {
                errorMessage = `오류: ${error.message}`;
            }
            toast.error(errorMessage, { duration: 5000 });
        }
    });

    const refineMutation = useMutation({
        mutationFn: async (data: ScriptRefinementRequest) => {
            console.log(" Sending refinement request...", data);
            const response = await api.post('/script/refine', data, { timeout: 180000 });
            console.log(" Response received:", response.status, response.data);
            return response.data;
        },
        onSuccess: (data: any) => {
            setResultText(data.script);
            if (data.warning) {
                toast.warning("모델 자동 전환됨", {
                    description: data.warning,
                    duration: 5000
                });
            } else {
                toast.success(`대본 수정 완료! (${data.model_used})`);
            }
        },
        onError: (error: any) => {
            console.error(" Refinement failed:", error);
            let errorMessage = "대본 수정 실패";
            if (error.code === 'ECONNABORTED') {
                errorMessage = "요청 시간이 초과되었습니다. (Timeout)";
            } else if (error.response?.data?.detail) {
                errorMessage = `오류: ${error.response.data.detail}`;
            } else if (error.message) {
                errorMessage = `오류: ${error.message}`;
            }
            toast.error(errorMessage, { duration: 5000 });
        }
    });

    const createStyleMutation = useMutation({
        mutationFn: async (data: any) => (await api.post('/script/styles', data)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scriptStyles'] });
            setIsStyleModalOpen(false);
            resetStyleForm();
            toast.success("스타일이 저장되었습니다.");
        }
    });

    const updateStyleMutation = useMutation({
        mutationFn: async (data: any) => (await api.put(`/script/styles/${editingStyle?.id}`, data)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scriptStyles'] });
            setIsStyleModalOpen(false);
            resetStyleForm();
            toast.success("스타일이 수정되었습니다.");
        }
    });

    const deleteStyleMutation = useMutation({
        mutationFn: async (id: number) => (await api.delete(`/script/styles/${id}`)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scriptStyles'] });
            toast.success("스타일이 삭제되었습니다.");
            if (selectedStyleId === String(editingStyle?.id)) {
                setSelectedStyleId("");
            }
        }
    });

    // Handlers
    const handleGenerate = () => {
        if (!inputText.trim()) {
            toast.error("원본 텍스트를 입력해주세요.");
            return;
        }

        setIsGenerating(true);
        generateMutation.mutate({
            input_text: inputText,
            style_id: selectedStyleId && selectedStyleId !== "none" ? parseInt(selectedStyleId) : 0,
            glossary: glossary,
            niche: niche || undefined,
            provider: scriptProvider,
            model: scriptModel,
            use_web_search: useWebSearch
        }, {
            onSettled: () => setIsGenerating(false)
        });
    };

    const handleRefine = (instruction: string) => {
        if (!resultText.trim()) return;

        setIsGenerating(true);
        refineMutation.mutate({
            current_text: resultText,
            instruction: instruction,
            style_id: selectedStyleId && selectedStyleId !== "none" ? parseInt(selectedStyleId) : 0,
            provider: scriptProvider,
            model: scriptModel
        }, {
            onSettled: () => setIsGenerating(false)
        });
    };

    const handleSaveStyle = () => {
        const data = {
            name: styleFormName,
            system_instruction: styleFormInstruction,
            sample_text: styleFormSample
        };

        if (editingStyle) {
            updateStyleMutation.mutate(data);
        } else {
            createStyleMutation.mutate(data);
        }
    };

    const handleEditStyle = (style: ScriptStyle) => {
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

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setInputText(text);
            toast.success("클립보드에서 붙여넣었습니다.");
        } catch (err) {
            toast.error("클립보드 접근 권한이 필요합니다.");
        }
    };

    const handleCopyResult = async () => {
        try {
            await navigator.clipboard.writeText(resultText);
            toast.success("결과가 복사되었습니다.");
        } catch (err) {
            toast.error("복사 실패");
        }
    };

    return (
        <div className="flex-1 flex flex-col gap-4 min-h-0">

            {/* Zone 1: Control Bar */}
            <Card className="flex-shrink-0">
                <CardContent className="p-4">
                    <AIModelSelector
                        provider={scriptProvider}
                        onProviderChange={(p) => setScriptProvider(p)}
                        model={scriptModel}
                        onModelChange={(m) => setScriptModel(m)}
                        presetId={selectedStyleId}
                        onPresetChange={setSelectedStyleId}
                        showPreset={true}
                        onCreatePreset={() => { resetStyleForm(); setIsStyleModalOpen(true); }}
                        onEditPreset={(style) => handleEditStyle(style)}
                    />

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>주제 분야 (Niche) - 선택사항</Label>
                            <Input
                                placeholder="예: Tech, Gaming, Health, Food"
                                value={niche}
                                onChange={(e) => setNiche(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>용어집 (Glossary) - 선택사항</Label>
                            <Input
                                placeholder="예: AI=인공지능, LLM=대규모언어모델"
                                value={glossary}
                                onChange={(e) => setGlossary(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2 flex items-end pb-1">
                            <div className="flex items-center gap-3 w-full">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="web-search"
                                        checked={useWebSearch}
                                        onCheckedChange={setUseWebSearch}
                                    />
                                    <Label htmlFor="web-search" className="cursor-pointer flex items-center gap-1.5 text-sm font-medium">
                                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                                        웹 검색 활용
                                    </Label>
                                </div>
                                <Badge variant={useWebSearch ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
                                    {useWebSearch ? "ON" : "OFF"}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Trend Insights Panel (collapsible, visible when niche is set) */}
            {niche && trends && trends.length > 0 && (
                <Card className="flex-shrink-0 border-amber-200 dark:border-amber-900">
                    <button
                        onClick={() => setShowTrends(!showTrends)}
                        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">트렌드 인사이트</span>
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                                {trends.length}개 카테고리
                            </Badge>
                        </div>
                        {showTrends ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    {showTrends && (
                        <CardContent className="px-4 pb-4 pt-2 border-t border-amber-100 dark:border-amber-900 space-y-3">
                            {trends.map((trend) => (
                                <div key={trend.id}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{trend.keyword}</span>
                                        <span className="text-[10px] text-slate-500">{trend.keyword_count}개 키워드</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {trend.top_keywords.map((kw, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-2 p-1.5 rounded hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer transition-colors group"
                                                onClick={() => {
                                                    setNiche(trend.category);
                                                    setInputText(prev => prev ? `${prev}\n\n# ${kw.ko} (${kw.en})` : `# ${kw.ko} (${kw.en})`);
                                                    toast.success(`"${kw.ko}" 키워드 반영됨`);
                                                }}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-medium truncate">{kw.ko}</span>
                                                        {kw.en && <span className="text-[10px] text-slate-400 truncate">({kw.en})</span>}
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[9px] px-1 py-0 ml-auto flex-shrink-0 ${
                                                                kw.velocity === 'Explosive' ? 'border-red-300 text-red-600 bg-red-50' :
                                                                kw.velocity === 'Rising' ? 'border-amber-300 text-amber-600 bg-amber-50' :
                                                                'border-slate-300 text-slate-500'
                                                            }`}
                                                        >
                                                            <Zap className="w-2.5 h-2.5 mr-0.5" />
                                                            {kw.velocity}
                                                        </Badge>
                                                    </div>
                                                    <Progress value={kw.score} className="h-1 mt-1" />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 w-8 text-right">{kw.score}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    )}
                </Card>
            )}

            {/* Research Context Panel (collapsible) */}
            {lastResponse && (lastResponse.research_used || lastResponse.trend_used) && (
                <Card className="flex-shrink-0 border-emerald-200 dark:border-emerald-900">
                    <button
                        onClick={() => setShowResearch(!showResearch)}
                        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">리서치 컨텍스트</span>
                            <div className="flex gap-1.5">
                                {lastResponse.research_used && (
                                    <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                        웹검색 {lastResponse.research_sources?.length || 0}건
                                    </Badge>
                                )}
                                {lastResponse.trend_used && (
                                    <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                        트렌드 {lastResponse.trend_count}건
                                    </Badge>
                                )}
                            </div>
                        </div>
                        {showResearch ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    {showResearch && (
                        <CardContent className="px-4 pb-4 pt-2 border-t border-emerald-100 dark:border-emerald-900">
                            {lastResponse.research_used && lastResponse.research_sources && lastResponse.research_sources.length > 0 && (
                                <div className="mb-3">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">웹 검색 결과</span>
                                    </div>
                                    <ul className="space-y-1">
                                        {lastResponse.research_sources.map((src, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                                                <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                <span>{src}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {lastResponse.trend_used && lastResponse.trend_count > 0 && (
                                <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">트렌드 데이터</span>
                                        <span className="text-[10px] text-slate-500">({lastResponse.trend_count}개 키워드 분석)</span>
                                    </div>
                                </div>
                            )}

                            {lastResponse.research_summary && (
                                <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900 rounded text-xs text-slate-500 dark:text-slate-400 italic leading-relaxed border border-slate-200 dark:border-slate-700">
                                    {lastResponse.research_summary}
                                </div>
                            )}
                        </CardContent>
                    )}
                </Card>
            )}

            {/* Zone 2: Workspace */}
            <div className="flex-1 flex gap-4 min-h-[700px]">
                {/* Left Pane: Source */}
                <Card className="flex-1 flex flex-col min-h-0">
                    <CardHeader className="py-3 px-4 border-b bg-muted/30">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base">원본 자막/스크립트 (Source)</CardTitle>
                            <Button variant="ghost" size="sm" onClick={handlePaste} className="h-8 text-xs">
                                <Copy className="w-3 h-3 mr-1" />
                                붙여넣기
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 relative">
                        <Textarea
                            className="w-full h-full resize-none border-0 focus-visible:ring-0 p-4 rounded-none"
                            placeholder="번역 및 변환할 원본 텍스트를 여기에 입력하거나 붙여넣으세요..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                        />
                    </CardContent>
                </Card>

                {/* Center Action */}
                <div className="flex flex-col justify-center gap-2">
                    <Button
                        size="lg"
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                    >
                        {isGenerating ? (
                            <Wand2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Sparkles className="w-5 h-5" />
                        )}
                    </Button>
                </div>

                {/* Right Pane: Result */}
                <Card className="flex-1 flex flex-col min-h-0 border-blue-200 dark:border-blue-900 shadow-sm">
                    <CardHeader className="py-3 px-4 border-b bg-blue-50/50 dark:bg-blue-950/20">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base text-blue-900 dark:text-blue-100">생성된 대본 (Result)</CardTitle>
                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => navigate('/multi-tts', { state: { importedScript: formatTextWithLineBreaks(resultText) } })}
                                    disabled={!resultText}
                                    className="h-8 text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-100"
                                >
                                    <Mic className="w-3 h-3 mr-1" />
                                    TTS 생성
                                </Button>
                                <Button variant="ghost" size="sm" onClick={handleCopyResult} className="h-8 text-xs">
                                    <Copy className="w-3 h-3 mr-1" />
                                    복사하기
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 relative flex flex-col">
                        <Textarea
                            className="flex-1 resize-none border-0 focus-visible:ring-0 p-4 rounded-none font-medium leading-relaxed"
                            placeholder="AI가 생성한 대본이 여기에 표시됩니다..."
                            value={resultText}
                            onChange={(e) => setResultText(e.target.value)}
                        />

                        <div className="p-2 border-t bg-muted/20 flex gap-2 overflow-x-auto">
                            <Button variant="outline" size="sm" onClick={() => handleRefine("기존 스타일을 유지하면서 전체 내용을 더 짧고 간결하게 줄여줘.")} disabled={isGenerating || !resultText}>
                                <Wand2 className="w-3 h-3 mr-1" /> 더 짧게
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleRefine("기존 스타일을 유지하면서 내용을 더 재미있고 활기차게 만들어줘.")} disabled={isGenerating || !resultText}>
                                <Sparkles className="w-3 h-3 mr-1" /> 더 재미있게
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleRefine("기존 스타일을 유지하면서 모든 표현을 안전하고 부드러운 순화된 언어로 수정해줘.")} disabled={isGenerating || !resultText}>
                                <ShieldAlert className="w-3 h-3 mr-1" /> 안전 표현 수정
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Zone 3: Style Management Modal */}
            <Dialog open={isStyleModalOpen} onOpenChange={setIsStyleModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingStyle ? '스타일 수정' : '새 스타일 추가'}</DialogTitle>
                        <DialogDescription>
                            AI가 대본을 생성할 때 따를 규칙과 예시를 정의합니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">스타일 이름</Label>
                            <Input
                                value={styleFormName}
                                onChange={(e) => setStyleFormName(e.target.value)}
                                placeholder="예: 쇼츠용, 뉴스용"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">프롬프트 (지시사항)</Label>
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
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    if (confirm("정말 삭제하시겠습니까?")) {
                                        if (editingStyle) deleteStyleMutation.mutate(editingStyle.id);
                                        setIsStyleModalOpen(false);
                                    }
                                }}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                삭제
                            </Button>
                        ) : <div></div>}
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsStyleModalOpen(false)}>취소</Button>
                            <Button onClick={handleSaveStyle}>저장</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog >
        </div >
    );
};

export default ScriptWriter;
