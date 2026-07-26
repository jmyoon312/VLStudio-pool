import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import AIModelSelector from '@/components/shared/AIModelSelector';
import { formatTextWithLineBreaks } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderOpen, Play, FileText, Save, Loader2, Wand2, FileAudio, AlertCircle, WrapText } from 'lucide-react';

import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';

interface LogEntry {
    time: string;
    message: string;
    type: 'info' | 'error';
}

const SubtitleConverter = () => {
    const location = useLocation();
    const state = location.state as { srtContent?: string; mediaUrl?: string; serverPath?: string; originalScript?: string } | null;

    // State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [originalScript, setOriginalScript] = useState(() => {
        return state?.originalScript || localStorage.getItem('sub_conv_originalScript') || '';
    });
    const [srtContent, setSrtContent] = useState(() => {
        return state?.srtContent || localStorage.getItem('sub_conv_srtContent') || '';
    });
    const [isAlignmentMode, setIsAlignmentMode] = useState(() => {
        return localStorage.getItem('sub_conv_isAlignmentMode') !== 'false';
    });
    const [isManualMarkerMode, setIsManualMarkerMode] = useState(() => {
        return localStorage.getItem('sub_conv_isManualMarkerMode') === 'true';
    });
    const [splitLimit, setSplitLimit] = useState(() => {
        return Number(localStorage.getItem('sub_conv_splitLimit')) || 10;
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [resultStep1, setResultStep1] = useState(() => {
        return localStorage.getItem('sub_conv_resultStep1') || '';
    });
    const [resultStep2, setResultStep2] = useState(() => {
        return localStorage.getItem('sub_conv_resultStep2') || '';
    });
    const [activeTab, setActiveTab] = useState(() => {
        return localStorage.getItem('sub_conv_activeTab') || 'step2';
    });
    const [logs, setLogs] = useState<LogEntry[]>([]);

    // Auto-Save changes to localStorage
    useEffect(() => {
        localStorage.setItem('sub_conv_originalScript', originalScript);
    }, [originalScript]);

    useEffect(() => {
        localStorage.setItem('sub_conv_srtContent', srtContent);
    }, [srtContent]);

    useEffect(() => {
        localStorage.setItem('sub_conv_resultStep1', resultStep1);
    }, [resultStep1]);

    useEffect(() => {
        localStorage.setItem('sub_conv_resultStep2', resultStep2);
    }, [resultStep2]);

    useEffect(() => {
        localStorage.setItem('sub_conv_isAlignmentMode', String(isAlignmentMode));
    }, [isAlignmentMode]);

    useEffect(() => {
        localStorage.setItem('sub_conv_isManualMarkerMode', String(isManualMarkerMode));
    }, [isManualMarkerMode]);

    useEffect(() => {
        localStorage.setItem('sub_conv_splitLimit', String(splitLimit));
    }, [splitLimit]);

    useEffect(() => {
        localStorage.setItem('sub_conv_activeTab', activeTab);
    }, [activeTab]);

    // Options
    const [language, setLanguage] = useState(() => {
        return localStorage.getItem('sub_conv_language') || 'auto';
    });
    const [subtitleModel, setSubtitleModel] = useState(() => {
        return localStorage.getItem('sub_conv_subtitleModel') || 'base';
    });

    // AI Segmentation Options
    const [segmentProvider, setSegmentProvider] = useState<string>(() => {
        return localStorage.getItem('sub_conv_segmentProvider') || 'groq';
    });
    const [segmentModel, setSegmentModel] = useState<string>(() => {
        return localStorage.getItem('sub_conv_segmentModel') || 'groq/llama-3.3-70b-versatile';
    });

    useEffect(() => {
        localStorage.setItem('sub_conv_language', language);
    }, [language]);

    useEffect(() => {
        localStorage.setItem('sub_conv_subtitleModel', subtitleModel);
    }, [subtitleModel]);

    useEffect(() => {
        localStorage.setItem('sub_conv_segmentProvider', segmentProvider);
    }, [segmentProvider]);

    useEffect(() => {
        localStorage.setItem('sub_conv_segmentModel', segmentModel);
    }, [segmentModel]);



    const fileInputRef = useRef<HTMLInputElement>(null);

    // Effect to handle incoming state
    useEffect(() => {
        if (state?.srtContent) {
            setSrtContent(state.srtContent);
            addLog("MultiTTS에서 자막 데이터 수신됨");
            setActiveTab("step1");
        }
        if (state?.originalScript) {
            setOriginalScript(state.originalScript);
            addLog("MultiTTS에서 원본 대본 수신됨");
        }
    }, [state]);

    // Helpers
    const addLog = (message: string, type: 'info' | 'error' = 'info') => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { time, message, type }]);
    };

    // Handlers
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            addLog(`파일 선택됨: ${e.target.files[0].name}`);
        }
    };

    const handleExtractSrt = async () => {
        if (!selectedFile) {
            toast.error("파일을 먼저 선택해주세요.");
            addLog("파일이 선택되지 않았습니다.", "error");
            return;
        }

        setIsProcessing(true);
        setStatusMessage("SRT 추출 중... (Whisper 모델 로딩)");
        setProgress(10);
        addLog("SRT 추출 요청 시작...");

        const formData = new FormData();
        const ext = selectedFile.name.split('.').pop() || 'mp3';
        const safeName = `upload_${Date.now()}_srt.${ext}`;
        const safeFile = new File([selectedFile], safeName, { type: selectedFile.type });

        formData.append('file', safeFile);
        formData.append('language', language);
        formData.append('model', subtitleModel);

        try {
            const interval = setInterval(() => {
                setProgress(prev => Math.min(prev + 5, 90));
            }, 1000);

            const res = await api.post('/tools/subtitle/extract', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            clearInterval(interval);
            setProgress(100);
            setStatusMessage("추출 완료!");
            setSrtContent(res.data.srt_content);
            toast.success("SRT 추출이 완료되었습니다.");
            addLog("SRT 추출 성공!");

        } catch (e: any) {
            console.error(e);
            let msg = e.response?.data?.detail || e.message;
            setStatusMessage("오류 발생: " + msg);
            toast.error("SRT 추출 실패: " + msg);
            addLog(`SRT 추출 실패: ${msg}`, "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleLoadSrt = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.srt';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    setSrtContent(e.target?.result as string);
                    addLog("SRT 파일 불러오기 완료");
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };

    const handleAddMarkers = async () => {
        if (!originalScript) {
            toast.error("원본 대본을 먼저 입력해주세요.");
            addLog("원본 대본 없음", "error");
            return;
        }

        setIsProcessing(true);
        setStatusMessage("AI 의미 분절 분석 중...");
        addLog("AI 마커 추가 요청...");

        try {
            const res = await api.post('/tools/script/add-markers', {
                text: originalScript,
                provider: segmentProvider,
                model: segmentModel
            });

            if (res.data.text) {
                setOriginalScript(res.data.text);
                toast.success("의미 단위 분절 완료 (// 마커 추가됨)");
                addLog("AI 마커 추가 성공!");
            }
        } catch (e: any) {
            console.error(e);
            const msg = e.response?.data?.detail || e.message;
            toast.error("AI 분절 실패: " + msg);
            addLog(`AI 분절 오류: ${msg}`, "error");
        } finally {
            setIsProcessing(false);
            setStatusMessage("");
        }
    };

    const handleRunConversion = async () => {
        addLog("변환 요청 시작...");
        console.log("Selected Language:", language);

        if (!srtContent) {
            toast.error("SRT 자막 내용이 필요합니다.");
            addLog("SRT 내용이 없습니다.", "error");
            return;
        }
        if (isAlignmentMode && !originalScript) {
            toast.error("대조 모드에서는 원본 대본이 필요합니다.");
            addLog("원본 대본이 없습니다.", "error");
            return;
        }

        setIsProcessing(true);
        setStatusMessage("변환 처리 중...");

        try {
            const res = await api.post('/tools/subtitle/align', {
                original_text: originalScript,
                srt_text: srtContent,
                limit: splitLimit,
                use_alignment: isAlignmentMode,
                use_marker_segmentation: isManualMarkerMode,
                language: language === 'auto' ? undefined : language
            });

            setResultStep1(res.data.step1 || "1단계 결과 없음");
            setResultStep2(res.data.step2 || "");
            setActiveTab('step2');
            setStatusMessage("변환 완료!");
            toast.success("자막 변환이 완료되었습니다.");
            addLog("변환 성공!");
        } catch (e: any) {
            console.error(e);
            const msg = e.response?.data?.detail || e.message;
            toast.error("변환 실패: " + msg);
            addLog(`변환 오류: ${msg}`, "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveResult = (content: string, filename: string) => {
        if (!content) return;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        addLog(`SRT 파일 저장됨: ${filename}`);
    };

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col gap-4 p-6 max-w-[1800px] mx-auto font-sans overflow-hidden">


            {/* Zone 1: File Input & Options */}
            <Card className="shrink-0 border border-gray-100 shadow-sm rounded-xl bg-white">
                <CardContent className="p-4 flex gap-6 items-center flex-wrap">
                    <div className="flex-1 min-w-[300px] flex gap-3 items-center">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileSelect}
                            accept="audio/*,video/*"
                        />
                        <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="shrink-0 h-9 text-sm font-medium">
                            <FolderOpen className="w-4 h-4 mr-2" />
                            파일 선택
                        </Button>
                        <div className="flex-1 px-4 py-2 bg-gray-50 rounded-lg text-sm font-mono truncate flex items-center gap-2 border border-gray-100 h-9">
                            {selectedFile ? (
                                <>
                                    <FileAudio className="w-4 h-4 text-blue-500" />
                                    {selectedFile.name}
                                </>
                            ) : (
                                <span className="text-muted-foreground">선택된 파일 없음</span>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-6 items-center">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-700">언어:</span>
                            <Select value={language} onValueChange={setLanguage}>
                                <SelectTrigger className="w-[140px] h-9 border-gray-200 focus:ring-2 focus:ring-primary/20 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">자동 감지 (Auto)</SelectItem>
                                    <SelectItem value="ko">한국어 (Korean)</SelectItem>
                                    <SelectItem value="en">영어 (English)</SelectItem>
                                    <SelectItem value="ja">일본어 (Japanese)</SelectItem>
                                    <SelectItem value="zh">중국어 (Chinese)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-700">모델:</span>
                            <Select value={subtitleModel} onValueChange={setSubtitleModel}>
                                <SelectTrigger className="w-[140px] h-9 border-gray-200 focus:ring-2 focus:ring-primary/20 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="tiny">Tiny (빠름)</SelectItem>
                                    <SelectItem value="base">Base (기본)</SelectItem>
                                    <SelectItem value="small">Small (정확)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Zone 2: Main Workspace */}
            <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
                {/* Left Column: Original Script */}
                <Card className="flex flex-col h-full border border-gray-100 shadow-sm rounded-xl bg-white overflow-hidden">
                    <CardHeader className="py-2 px-4 border-b bg-gray-50/50 flex flex-row items-center justify-between space-y-0 shrink-0">
                        <div className="flex items-center gap-2 text-slate-600">
                            <FileText className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Original Script</span>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 flex flex-col">
                        {/* Toolbar */}
                        <div className="p-2 border-b bg-gray-50/30 flex flex-col gap-2">
                            {/* Row 1: Selectors */}
                            <div className="w-full">
                                <AIModelSelector
                                    provider={segmentProvider}
                                    onProviderChange={setSegmentProvider}
                                    model={segmentModel}
                                    onModelChange={setSegmentModel}
                                    compact={true}
                                    showPreset={false}
                                />
                            </div>

                            {/* Row 2: Actions */}
                            <div className="flex items-center gap-2 justify-end w-full">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 h-7 text-xs font-medium"
                                    onClick={() => {
                                        if (!originalScript) return;
                                        setOriginalScript(formatTextWithLineBreaks(originalScript));
                                        toast.success("문장 단위로 줄바꿈을 적용했습니다.");
                                    }}
                                    title="문장 끝(., ?, !)에서 줄바꿈"
                                >
                                    <WrapText className="w-3 h-3 mr-1.5" />
                                    자동 줄바꿈
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="flex-1 h-7 text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-100 font-medium transition-colors"
                                    onClick={handleAddMarkers}
                                    disabled={isProcessing}
                                >
                                    <Wand2 className="w-3 h-3 mr-1.5" />
                                    AI 분절 실행
                                </Button>
                            </div>
                        </div>
                        <Textarea
                            value={originalScript}
                            onChange={(e) => setOriginalScript(e.target.value)}
                            placeholder="여기에 원본 대본을 붙여넣으세요... (// 로 수동 분절 가능)"
                            className="h-full resize-none border-0 focus-visible:ring-0 p-4 font-sans text-base leading-relaxed text-gray-800 placeholder:text-slate-600"
                        />
                    </CardContent>
                </Card>

                {/* Right Column: SRT Source */}
                <Card className="flex flex-col h-full border border-gray-100 shadow-sm rounded-xl bg-white overflow-hidden">
                    <CardHeader className="py-2 px-4 border-b bg-gray-50/50 flex flex-row items-center justify-between space-y-0 shrink-0">
                        <div className="flex items-center gap-2 text-slate-600">
                            <Wand2 className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">SRT Source</span>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleLoadSrt}
                                className="h-7 text-xs font-medium"
                            >
                                📂 SRT 불러오기
                            </Button>
                            <Button
                                size="sm"
                                className="bg-orange-500 hover:bg-orange-600 text-white h-7 text-xs font-bold shadow-sm"
                                onClick={handleExtractSrt}
                                disabled={isProcessing}
                            >
                                {isProcessing ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Wand2 className="w-3 h-3 mr-2" />}
                                SRT 추출
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 flex flex-col">
                        <Textarea
                            value={srtContent}
                            onChange={(e) => setSrtContent(e.target.value)}
                            placeholder="SRT 자막 내용이 여기에 표시됩니다..."
                            className="flex-1 resize-none border-0 focus-visible:ring-0 p-4 font-mono text-sm leading-relaxed text-gray-800 placeholder:text-slate-600"
                        />
                        {/* Footer: Progress */}
                        <div className="h-8 border-t bg-gray-50/50 flex items-center px-4 gap-4 text-xs font-medium text-gray-500 shrink-0">
                            <div className="w-20">진행 상태:</div>
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-orange-500 transition-all duration-300 rounded-full"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="w-12 text-right font-mono">{progress}%</div>
                            <div className="w-48 truncate text-right text-gray-600">{statusMessage}</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Zone 3: Control Strip */}
            <Card className="shrink-0 bg-white border border-gray-100 shadow-sm rounded-xl">
                <CardContent className="p-3 flex items-center gap-8">
                    <div className="flex items-center gap-4">
                        <Switch
                            checked={isAlignmentMode}
                            onCheckedChange={(checked) => {
                                setIsAlignmentMode(checked);
                                if (!checked) setIsManualMarkerMode(false);
                            }}
                            id="align-mode"
                            className="data-[state=checked]:bg-primary"
                        />
                        <label htmlFor="align-mode" className="cursor-pointer select-none flex flex-col">
                            <span className="text-sm font-bold text-gray-800">대조 모드</span>
                            <span className="text-xs text-muted-foreground">원본 대본 + SRT</span>
                        </label>
                    </div>

                    <div className="h-8 w-px bg-gray-200" />

                    <div className={`flex items-center gap-4 transition-opacity ${!isAlignmentMode ? 'opacity-50' : ''}`}>
                        <Switch
                            checked={isManualMarkerMode}
                            onCheckedChange={setIsManualMarkerMode}
                            id="manual-marker-mode"
                            disabled={!isAlignmentMode}
                            className="data-[state=checked]:bg-purple-600"
                        />
                        <label htmlFor="manual-marker-mode" className={`cursor-pointer select-none flex flex-col ${!isAlignmentMode ? 'cursor-not-allowed' : ''}`}>
                            <span className="text-sm font-bold text-gray-800">수동 분절 모드</span>
                            <span className="text-xs text-muted-foreground">// 기호 기준 분리</span>
                        </label>
                    </div>

                    <div className="h-8 w-px bg-gray-200" />

                    <div className={`flex items-center gap-6 flex-1 min-w-[200px] transition-opacity ${isManualMarkerMode ? 'opacity-50 pointer-events-none' : ''}`}>
                        <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">분할 기준:</span>
                        <Slider
                            value={[splitLimit]}
                            onValueChange={(vals) => setSplitLimit(vals[0])}
                            min={5}
                            max={50}
                            step={1}
                            className="flex-1"
                            disabled={isManualMarkerMode}
                        />
                        <span className="text-sm font-mono font-bold w-12 text-right text-primary">{splitLimit}자</span>
                    </div>

                    <div className="flex-1" />

                    <Button
                        size="lg"
                        className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 h-10 shadow-lg shadow-green-200 transition-all hover:scale-105 active:scale-95 rounded-lg text-sm"
                        onClick={handleRunConversion}
                        disabled={isProcessing}
                    >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        변환 실행
                    </Button>
                </CardContent>
            </Card>

            {/* Zone 4: Results & Logs */}
            <div className="flex-1 min-h-0 flex flex-col gap-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2 shrink-0">
                        <TabsList className="bg-gray-100 p-1 rounded-lg h-9">
                            <TabsTrigger value="step1" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-1 text-xs font-medium h-7">1단계: 시간 정렬 결과</TabsTrigger>
                            <TabsTrigger value="step2" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4 py-1 text-xs font-medium h-7">2단계: 최종 SRT</TabsTrigger>
                        </TabsList>
                        {activeTab === 'step1' && (
                            <Button size="sm" variant="outline" onClick={() => handleSaveResult(resultStep1, 'step1_aligned.srt')} className="h-8 font-medium text-xs">
                                <Save className="w-3 h-3 mr-2" />
                                .srt 파일 저장
                            </Button>
                        )}
                        {activeTab === 'step2' && (
                            <Button size="sm" variant="outline" onClick={() => handleSaveResult(resultStep2, 'final_output.srt')} className="h-8 font-medium text-xs">
                                <Save className="w-3 h-3 mr-2" />
                                .srt 파일 저장
                            </Button>
                        )}
                    </div>

                    <TabsContent value="step1" className="flex-1 mt-0 h-0">
                        <Card className="h-full border border-gray-200 shadow-sm rounded-xl overflow-hidden">
                            <CardContent className="p-0 h-full">
                                <Textarea
                                    value={resultStep1}
                                    readOnly
                                    className="h-full resize-none border-0 focus-visible:ring-0 p-4 font-mono text-sm leading-relaxed text-gray-800 bg-white"
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="step2" className="flex-1 mt-0 h-0">
                        <Card className="h-full border border-green-200 shadow-sm rounded-xl overflow-hidden ring-1 ring-green-50">
                            <CardContent className="p-0 h-full">
                                <Textarea
                                    value={resultStep2}
                                    readOnly
                                    className="h-full resize-none border-0 focus-visible:ring-0 p-4 font-mono text-sm leading-relaxed text-gray-800 bg-white"
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* System Logs (Refactored: White, Small) */}
                <div className="h-24 shrink-0 bg-white border-t border-gray-200 p-3 overflow-y-auto font-mono text-xs">
                    <h3 className="text-xs font-bold mb-2 text-gray-500 flex items-center gap-2 uppercase tracking-wider">
                        <AlertCircle className="w-3 h-3" />
                        System Logs
                    </h3>
                    <div className="space-y-1">
                        {logs.length === 0 && <div className="text-slate-600 italic">No logs yet.</div>}
                        {logs.map((log, i) => (
                            <div key={i} className={log.type === 'error' ? 'text-red-500' : 'text-gray-600'}>
                                <span className="opacity-50 mr-2 text-slate-600">[{log.time}]</span>
                                {log.message}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubtitleConverter;
