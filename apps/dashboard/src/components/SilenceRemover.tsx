import React, { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { FolderOpen, Trash2, Play, FileAudio } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { resolveFileUrl } from '@/utils/fileUrl';

interface FileItem {
    id: string;
    file: File;
    status: 'pending' | 'processing' | 'done' | 'error';
    message?: string;
}

export default function SilenceRemover() {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sorting State - Default to Number/Asc
    const [sortKey, setSortKey] = useState<string>('숫자');
    const [sortOrder, setSortOrder] = useState<string>('오름차순');

    // Options State - Default to 'Merge' settings
    const [removeSilence, setRemoveSilence] = useState(false);
    const [normalize, setNormalize] = useState(true);
    const [useNr, setUseNr] = useState(false);
    const [nrAggr, setNrAggr] = useState('0.12');
    
    // Studio Enhancement State
    const [studioCompressor, setStudioCompressor] = useState(false);
    const [studioEq, setStudioEq] = useState(false);
    const [studioGate, setStudioGate] = useState(false);
    const [studioLoudnorm, setStudioLoudnorm] = useState(false);
    const [threshold, setThreshold] = useState(0);
    const [minSilence, setMinSilence] = useState(500);
    const [keepSilence, setKeepSilence] = useState(50);
    const [crossfade, setCrossfade] = useState(40);

    const addLog = (msg: string) => {
        const ts = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, `[${ts}] ${msg}`]);
    };

    const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles: FileItem[] = Array.from(e.target.files).map(f => ({
                id: Math.random().toString(36).substr(2, 9),
                file: f,
                status: 'pending',
            }));
            setFiles(prev => [...prev, ...newFiles]);
            addLog(`${newFiles.length}개 파일이 추가되었습니다.`);
            e.target.value = '';
        }
    };

    const clearFiles = () => {
        setFiles([]);
        addLog('파일 목록이 초기화되었습니다.');
    };

    // Sorting Logic
    const sortedFiles = useMemo(() => {
        if (sortKey === '수동정렬') return files;
        const sorted = [...files].sort((a, b) => {
            let comparison = 0;
            switch (sortKey) {
                case '숫자':
                    const numA = parseInt(a.file.name.replace(/\D/g, '')) || 0;
                    const numB = parseInt(b.file.name.replace(/\D/g, '')) || 0;
                    comparison = numA - numB;
                    break;
                case '이름':
                    comparison = a.file.name.localeCompare(b.file.name);
                    break;
                case '만든날짜':
                case '수정날짜':
                    comparison = a.file.lastModified - b.file.lastModified;
                    break;
                default:
                    return 0;
            }
            return sortOrder === '오름차순' ? comparison : -comparison;
        });
        return sorted;
    }, [files, sortKey, sortOrder]);

    // Preset State - Default to 'merge'
    const [activePreset, setActivePreset] = useState<string | null>('merge');

    const markAsPendingOnChange = () => {
        setActivePreset(null);
        setFiles(prev => prev.map(f => (f.status === 'done' || f.status === 'error') ? { ...f, status: 'pending' } : f));
    };

    const applyPreset = (type: 'speed' | 'gaming' | 'news' | 'vlog' | 'interview' | 'merge') => {
        setActivePreset(type);
        setRemoveSilence(true);
        setNormalize(true);
        setUseNr(false);
        switch (type) {
            case 'speed':
                setThreshold(-35);
                setMinSilence(200);
                setKeepSilence(10);
                setCrossfade(10);
                setNrAggr('0.15');
                addLog('프리셋: 스피드 쇼츠 (빠른 컷)');
                break;
            case 'gaming':
                setThreshold(-40);
                setMinSilence(300);
                setKeepSilence(50);
                setCrossfade(30);
                setNrAggr('0.15');
                addLog('프리셋: 게임/텐션 (밸런스)');
                break;
            case 'news':
                setThreshold(-45);
                setMinSilence(500);
                setKeepSilence(150);
                setCrossfade(50);
                setUseNr(true);
                setNrAggr('0.20');
                addLog('프리셋: 뉴스/리뷰 (명확함)');
                break;
            case 'vlog':
                setThreshold(-50);
                setMinSilence(800);
                setKeepSilence(300);
                setCrossfade(100);
                setUseNr(true);
                setNrAggr('0.12');
                addLog('프리셋: 브이로그 (자연스러움)');
                break;
            case 'interview':
                setThreshold(-45);
                setMinSilence(400);
                setKeepSilence(200);
                setCrossfade(50);
                setUseNr(true);
                setNrAggr('0.15');
                addLog('프리셋: 인터뷰 (대화형)');
                break;
            case 'merge':
                setThreshold(0);
                setRemoveSilence(false);
                setUseNr(false);
                addLog('프리셋: 단순 합치기 (무음제거 안함)');
                break;
        }
    };

    // Helper to force download via Blob (Bypasses 404 navigation and forces save)
    const forceDownload = async (url: string, filename: string): Promise<boolean> => {
        try {
            const safeUrl = resolveFileUrl(url);
            const res = await fetch(safeUrl);
            if (!res.ok) throw new Error(`Download failed: ${res.status}`);
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
            return true;
        } catch (e: any) {
            console.error("Blob download failed:", e);
            // Fallback to direct link if blob fails
            const a = document.createElement('a');
            const fallbackUrl = resolveFileUrl(url);
            a.href = fallbackUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return false;
        }
    };

    // Helper to generate a safe filename preserving extension
    const generateSafeFile = (original: File, index: number): File => {
        const parts = original.name.split('.');
        const ext = parts.length > 1 ? parts.pop() : '';
        const safeName = `file_${Date.now()}_${index}${ext ? '.' + ext : ''}`;
        return new File([original], safeName, { type: original.type });
    };

    const processFile = async (item: FileItem, index: number) => {
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing' } : f));
        addLog(`처리중: ${item.file.name}...`);

        const formData = new FormData();
        const safeFile = generateSafeFile(item.file, index);
        formData.append('files', safeFile);

        const options = {
            remove_silence: removeSilence,
            normalize: normalize,
            use_nr: useNr,
            studio_mode: false,
            nr_aggr: parseFloat(nrAggr) || 0.15,
            threshold: threshold,
            min_silence_len: minSilence,
            keep_silence_ms: keepSilence,
            crossfade_ms: crossfade,
            studio_compressor: studioCompressor,
            studio_eq: studioEq,
            studio_gate: studioGate,
            studio_loudnorm: studioLoudnorm,
        };
        formData.append('options', JSON.stringify(options));

        try {
            const response = await fetch(`${API_BASE_URL}/tools/silence/process`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errText = await response.text();
                let errMsg = `서버 오류: ${response.status}`;
                try {
                    const jsonErr = JSON.parse(errText);
                    if (jsonErr.detail) errMsg = jsonErr.detail;
                } catch { errMsg = errText || errMsg; }
                throw new Error(errMsg);
            }

            const data = await response.json();
            if (data.status === 'success' && data.web_url) {
                const filename = data.server_path ? data.server_path.split(/[/\\]/).pop() : (data.web_url.split('/').pop() || `processed_${item.file.name}`);
                await forceDownload(data.web_url, filename);

                setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done' } : f));
                addLog(`완료: ${item.file.name}`);
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error: any) {
            console.error(error);
            setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', message: error.message } : f));
            addLog(`오류 (${item.file.name}): ${error.message}`);
            toast.error(`파일 "${item.file.name}" 전송 실패: ${error.message}`);
        }
    };

    const handleStartProcessing = async () => {
        const pending = sortedFiles.filter(f => f.status === 'pending');
        
        if (pending.length === 0) {
            addLog('처리할 대기 중인 파일이 없습니다. 옵션을 변경하여 재처리할 수 있습니다.');
            return;
        }

        // Merge mode - Trigger if threshold is 0 OR if the 'merge' preset is active
        if (threshold === 0 || activePreset === 'merge') {
            addLog(`${pending.length}개 파일 합치기 시작...`);
            setFiles(prev => prev.map(f => pending.find(p => p.id === f.id) ? { ...f, status: 'processing' } : f));
            const formData = new FormData();
            pending.forEach((p, idx) => {
                const safeFile = generateSafeFile(p.file, idx);
                formData.append('files', safeFile);
            });
            const options = {
                threshold: 0,
                remove_silence: removeSilence,
                normalize: normalize,
                use_nr: useNr,
                studio_compressor: studioCompressor,
                studio_eq: studioEq,
                studio_gate: studioGate,
                studio_loudnorm: studioLoudnorm,
            };
            formData.append('options', JSON.stringify(options));
            try {
                const response = await fetch(`${API_BASE_URL}/tools/silence/process`, {
                    method: 'POST',
                    body: formData,
                });
                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`서버 오류: ${response.status} ${errText}`);
                }
                const data = await response.json();
                if (data.status === 'success' && data.web_url) {
                    const filename = data.server_path ? data.server_path.split(/[/\\]/).pop() : (data.web_url.split('/').pop() || 'merged.mp3');
                    await forceDownload(data.web_url, filename);

                    setFiles(prev => prev.map(f => pending.find(p => p.id === f.id) ? { ...f, status: 'done' } : f));
                    addLog('합치기 완료!');
                } else {
                    throw new Error('Invalid response');
                }
            } catch (error: any) {
                console.error(error);
                setFiles(prev => prev.map(f => pending.find(p => p.id === f.id) ? { ...f, status: 'error', message: error.message } : f));
                addLog(`합치기 실패: ${error.message}`);
                toast.error(`파일 합치기 실패: ${error.message}`);
            }
            return;
        }

        // Normal processing
        addLog(`${pending.length}개 파일의 일괄 처리를 시작합니다...`);
        for (let i = 0; i < pending.length; i++) {
            await processFile(pending[i], i);
        }
        addLog('일괄 처리가 완료되었습니다.');
    };

    return (
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
            {/* Zone 1: Top Actions */}
            <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
                <div className="flex gap-2">
                    <input
                        type="file"
                        multiple
                        accept="audio/*,video/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleAddFiles}
                    />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <FolderOpen className="mr-2 h-4 w-4" />
                        파일 추가
                    </Button>
                    <Button variant="destructive" onClick={clearFiles} className="bg-white text-destructive border-destructive border hover:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" />
                        목록 초기화
                    </Button>
                </div>
                <Button size="lg" className={cn("text-white", (threshold === 0 || activePreset === 'merge') ? "bg-indigo-600 hover:bg-indigo-700" : "bg-green-600 hover:bg-green-700")} onClick={handleStartProcessing}>
                    <Play className="mr-2 h-5 w-5" />
                    {(threshold === 0 || activePreset === 'merge') ? "합치기 시작" : "처리 시작"}
                </Button>
            </div>

            {/* Zone 2: Presets */}
            <Card className="border-blue-200 dark:border-blue-900">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        🎛 프리셋 (장르별 최적화)
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Button
                        variant="secondary"
                        className={cn("h-auto py-3 flex flex-col items-start gap-1 transition-all", activePreset === 'speed' && "ring-2 ring-blue-500 bg-blue-50")}
                        onClick={() => applyPreset('speed')}
                    >
                        <span className="font-bold">⚡ 스피드 쇼츠</span>
                        <span className="text-xs text-muted-foreground">빠른 컷, 200ms 무음</span>
                    </Button>
                    <Button
                        variant="secondary"
                        className={cn("h-auto py-3 flex flex-col items-start gap-1 transition-all", activePreset === 'gaming' && "ring-2 ring-blue-500 bg-blue-50")}
                        onClick={() => applyPreset('gaming')}
                    >
                        <span className="font-bold">🎮 게임/텐션</span>
                        <span className="text-xs text-muted-foreground">밸런스, 300ms 무음</span>
                    </Button>
                    <Button
                        variant="secondary"
                        className={cn("h-auto py-3 flex flex-col items-start gap-1 transition-all", activePreset === 'news' && "ring-2 ring-blue-500 bg-blue-50")}
                        onClick={() => applyPreset('news')}
                    >
                        <span className="font-bold">🎤 뉴스/리뷰</span>
                        <span className="text-xs text-muted-foreground">명확함, 500ms 무음</span>
                    </Button>
                    <Button
                        variant="secondary"
                        className={cn("h-auto py-3 flex flex-col items-start gap-1 transition-all", activePreset === 'vlog' && "ring-2 ring-blue-500 bg-blue-50")}
                        onClick={() => applyPreset('vlog')}
                    >
                        <span className="font-bold">☕ 브이로그/감성</span>
                        <span className="text-xs text-muted-foreground">자연스러움, 800ms 무음</span>
                    </Button>
                    <Button
                        variant="secondary"
                        className={cn("h-auto py-3 flex flex-col items-start gap-1 transition-all", activePreset === 'interview' && "ring-2 ring-blue-500 bg-blue-50")}
                        onClick={() => applyPreset('interview')}
                    >
                        <span className="font-bold">🎙️ 인터뷰/대화</span>
                        <span className="text-xs text-muted-foreground">대화형, 400ms 무음</span>
                    </Button>
                    <Button
                        className={cn("bg-indigo-600 hover:bg-indigo-700 text-white h-auto py-3 flex flex-col items-start gap-1 transition-all", activePreset === 'merge' && "ring-2 ring-indigo-400 ring-offset-2")}
                        onClick={() => applyPreset('merge')}
                    >
                        <span className="font-bold">🔗 단순 합치기</span>
                        <span className="text-xs text-white/80">무음제거 없음</span>
                    </Button>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Zone 3: Options (Compact) */}
                <Card className="border-orange-200 dark:border-orange-900 shadow-md">
                    <CardHeader className="pb-3 bg-orange-50/50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-900/50">
                        <CardTitle className="text-lg flex items-center gap-2 text-orange-700 dark:text-orange-400">
                            ⚙️ 기본 처리 옵션
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border">
                                <Switch id="remove-silence" checked={removeSilence} onCheckedChange={(val) => { setRemoveSilence(val); markAsPendingOnChange(); }} />
                                <label htmlFor="remove-silence" className="text-sm font-bold">무음 제거</label>
                            </div>
                            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border">
                                <Switch id="use-nr" checked={useNr} onCheckedChange={(val) => { setUseNr(val); markAsPendingOnChange(); }} />
                                <label htmlFor="use-nr" className="text-sm font-bold">노이즈 감소</label>
                            </div>
                            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border">
                                <Switch id="normalize" checked={normalize} onCheckedChange={(val) => { setNormalize(val); markAsPendingOnChange(); }} />
                                <label htmlFor="normalize" className="text-sm font-bold">일반 정규화</label>
                            </div>
                        </div>

                        <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border">
                            <div className="flex items-center gap-4">
                                <label className="text-sm font-medium whitespace-nowrap w-24">무음 감지 <span className="text-orange-600">({threshold}dB)</span></label>
                                <Slider value={[threshold]} min={-100} max={0} step={1} onValueChange={vals => { setThreshold(vals[0]); markAsPendingOnChange(); }} className="flex-1" />
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="text-sm font-medium whitespace-nowrap w-24">최소 무음 <span className="text-orange-600">({minSilence}ms)</span></label>
                                <Slider value={[minSilence]} min={100} max={2000} step={50} onValueChange={vals => { setMinSilence(vals[0]); markAsPendingOnChange(); }} className="flex-1" />
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                <label className="text-xs font-medium">유지(ms):</label>
                                <Input type="number" value={keepSilence} onChange={e => { setKeepSilence(parseInt(e.target.value) || 0); markAsPendingOnChange(); }} className="w-16 h-7 text-xs" />
                                <label className="text-xs font-medium ml-2">크로스페이드(ms):</label>
                                <Input type="number" value={crossfade} onChange={e => { setCrossfade(parseInt(e.target.value) || 0); markAsPendingOnChange(); }} className="w-16 h-7 text-xs" />
                                <label className="text-xs font-medium ml-2">NR 강도:</label>
                                <Input type="number" step="0.01" min="0.05" max="0.4" value={nrAggr} onChange={e => { setNrAggr(e.target.value); markAsPendingOnChange(); }} className="w-16 h-7 text-xs" disabled={!useNr} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Zone 3.5: Studio Enhancements */}
                <Card className="border-purple-200 dark:border-purple-900 shadow-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2">
                        <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider animate-pulse">Pro</span>
                    </div>
                    <CardHeader className="pb-3 bg-purple-50/50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-900/50">
                        <CardTitle className="text-lg flex items-center gap-2 text-purple-700 dark:text-purple-400">
                            ✨ 스튜디오 음질 개선
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        <div className={cn("flex items-center justify-between p-3 rounded-lg border transition-colors", studioCompressor ? "bg-purple-50 border-purple-300 dark:bg-purple-900/30" : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100")}>
                            <div>
                                <div className="font-bold text-sm">🎙️ 팟캐스트 보이스 (다이내믹 컴프레서)</div>
                                <div className="text-xs text-muted-foreground mt-0.5">작은 소리는 키우고 큰 소리는 억제하여 단단하고 힘있는 목소리</div>
                            </div>
                            <Switch checked={studioCompressor} onCheckedChange={(val) => { setStudioCompressor(val); markAsPendingOnChange(); }} />
                        </div>
                        <div className={cn("flex items-center justify-between p-3 rounded-lg border transition-colors", studioEq ? "bg-purple-50 border-purple-300 dark:bg-purple-900/30" : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100")}>
                            <div>
                                <div className="font-bold text-sm">🎚️ 또렷하고 풍성하게 (보컬 EQ 부스트)</div>
                                <div className="text-xs text-muted-foreground mt-0.5">고음을 살려 선명하게, 저음을 더해 웅장하게 (라디오 질감)</div>
                            </div>
                            <Switch checked={studioEq} onCheckedChange={(val) => { setStudioEq(val); markAsPendingOnChange(); }} />
                        </div>
                        <div className={cn("flex items-center justify-between p-3 rounded-lg border transition-colors", studioGate ? "bg-purple-50 border-purple-300 dark:bg-purple-900/30" : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100")}>
                            <div>
                                <div className="font-bold text-sm">🔇 완벽한 적막 (스마트 노이즈 게이트)</div>
                                <div className="text-xs text-muted-foreground mt-0.5">말을 하지 않는 구간의 백그라운드 노이즈를 완벽히 차단</div>
                            </div>
                            <Switch checked={studioGate} onCheckedChange={(val) => { setStudioGate(val); markAsPendingOnChange(); }} />
                        </div>
                        <div className={cn("flex items-center justify-between p-3 rounded-lg border transition-colors", studioLoudnorm ? "bg-purple-50 border-purple-300 dark:bg-purple-900/30" : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100")}>
                            <div>
                                <div className="font-bold text-sm">📺 유튜브 표준 음량 (EBU R128 정규화)</div>
                                <div className="text-xs text-muted-foreground mt-0.5">유튜브/방송 표준인 -14 LUFS에 맞춰 듣기 편한 최적의 볼륨</div>
                            </div>
                            <Switch checked={studioLoudnorm} onCheckedChange={(val) => { setStudioLoudnorm(val); markAsPendingOnChange(); }} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Zone 4: File List */}
            <Card className="border-green-500 dark:border-green-700 border-2">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        📁 파일 목록
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Select value={sortKey} onValueChange={setSortKey}>
                            <SelectTrigger className="w-[100px] h-8 text-xs">
                                <SelectValue placeholder="정렬" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="숫자">숫자순</SelectItem>
                                <SelectItem value="이름">이름순</SelectItem>
                                <SelectItem value="만든날짜">날짜순</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={sortOrder} onValueChange={setSortOrder}>
                            <SelectTrigger className="w-[100px] h-8 text-xs">
                                <SelectValue placeholder="순서" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="오름차순">오름차순</SelectItem>
                                <SelectItem value="내림차순">내림차순</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border mb-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>파일명</TableHead>
                                    <TableHead>경로</TableHead>
                                    <TableHead className="w-[100px] text-right">크기</TableHead>
                                    <TableHead className="w-[150px]">상태</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedFiles.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                            추가된 파일이 없습니다.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedFiles.map(file => (
                                        <TableRow key={file.id}>
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <FileAudio className="h-4 w-4 text-blue-500" />
                                                {file.file.name}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">
                                                {file.file.webkitRelativePath || '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {(file.file.size / (1024 * 1024)).toFixed(2)} MB
                                            </TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${file.status === 'done' ? 'bg-green-100 text-green-800' : file.status === 'processing' ? 'bg-blue-100 text-blue-800' : file.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {file.status === 'error' ? '오류' : file.status === 'done' ? '완료' : file.status === 'processing' ? '처리중...' : '대기'}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Zone 5: Logs */}
            <div className="bg-white border border-slate-200 text-slate-700 rounded-lg p-4 font-mono text-xs h-48 overflow-hidden flex flex-col shadow-sm">
                <div className="mb-2 font-bold text-slate-900 border-b pb-1">시스템 로그</div>
                <ScrollArea className="flex-1">
                    <div className="space-y-1">
                        {logs.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                        {logs.length === 0 && <div className="text-slate-600 italic">준비됨...</div>}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}
