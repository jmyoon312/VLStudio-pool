import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Loader2, Mic2, Play, Trash2, Save, 
    Settings, Languages, Users, Scissors,
    CheckCircle2, AlertCircle, Volume2, VolumeX
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Segment {
    id: number;
    start: number;
    end: number;
    text: string;
    translation: string;
    speaker_id: string;
    voice_id: string | null;
    is_excluded: boolean;
    preview_url?: string;
}

interface Voice {
    id: string;
    name: string;
    engine: string;
    lang: string;
}

interface BGMConfig {
    original_enabled: boolean;
    custom_file: File | null;
    custom_path: string | null;
    start_time: number;
    end_time: number;
    volume: number;
}

interface SubtitleConfig {
    enabled: boolean;
    position: 'top' | 'middle' | 'bottom';
    font_size: number;
    color: string;
    background_color: string;
}

interface DubbingStudioProps {
    initialFile: File;
    onClose: () => void;
}

const DubbingStudio: React.FC<DubbingStudioProps> = ({ initialFile, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [voices, setVoices] = useState<Voice[]>([]);
    const [videoPath, setVideoPath] = useState<string>("");
    const [targetLang, setTargetLang] = useState("en");
    
    // BGM Settings
    const [bgmConfig, setBgmConfig] = useState<BGMConfig>({
        original_enabled: true,
        custom_file: null,
        custom_path: null,
        start_time: 0,
        end_time: 0,
        volume: 0.5
    });

    // Subtitle Settings
    const [subConfig, setSubConfig] = useState<SubtitleConfig>({
        enabled: true,
        position: 'bottom',
        font_size: 24,
        color: '#ffffff',
        background_color: '#000000'
    });

    // Speaker to Voice Mapping
    const [speakerMap, setSpeakerMap] = useState<Record<string, string>>({});
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const bgmInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const vRes = await axios.get('/lab/voices');
            setVoices(vRes.data);
            
            const formData = new FormData();
            formData.append('file', initialFile);
            const aRes = await axios.post('/lab/analyze', formData);
            
            setSegments(aRes.data.analysis);
            setVideoPath(aRes.data.video_path);
            
            const speakers = Array.from(new Set(aRes.data.analysis.map((s: any) => s.speaker_id)));
            const initialMap: Record<string, string> = {};
            speakers.forEach((s: any) => initialMap[s] = "");
            setSpeakerMap(initialMap);
            
        } catch (error) {
            console.error(error);
            toast.error("영상 분석에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handlePreviewSegment = async (index: number) => {
        const seg = segments[index];
        const voiceId = seg.voice_id || speakerMap[seg.speaker_id];
        
        if (!voiceId || !seg.translation) {
            toast.warning("목소리와 번역문을 먼저 설정해주세요.");
            return;
        }

        try {
            const res = await axios.post('/lab/preview-segment', {
                text: seg.translation,
                voice_id: voiceId,
                lang: targetLang
            });
            
            const newSegments = [...segments];
            newSegments[index].preview_url = res.data.url;
            setSegments(newSegments);
            
            const audio = new Audio(res.data.url);
            audio.play();
        } catch (error) {
            toast.error("미리보기 음성 생성 실패");
        }
    };

    const handleBGMUpload = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await axios.post('/lab/upload-bgm', formData);
            setBgmConfig(prev => ({
                ...prev,
                custom_file: file,
                custom_path: res.data.path
            }));
            toast.success("배경음 업로드 완료");
        } catch (error) {
            toast.error("배경음 업로드 실패");
        }
    };

    const handleExport = async () => {
        try {
            setExporting(true);
            const res = await axios.post('/lab/export', {
                video_path: videoPath,
                segments_json: JSON.stringify(segments),
                voice_map_json: JSON.stringify(speakerMap),
                target_lang: targetLang,
                bgm_config_json: JSON.stringify(bgmConfig),
                subtitle_config_json: JSON.stringify(subConfig)
            });
            
            toast.success("영상 더빙 완료!");
            window.open(res.data.url, '_blank');
        } catch (error) {
            toast.error("최종 출력 실패");
        } finally {
            setExporting(false);
        }
    };

    const jumpToTime = (time: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            videoRef.current.play();
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[600px] space-y-4 text-center px-4">
                <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                <div>
                    <p className="text-lg font-bold">전문가용 더빙 엔진 가동 중</p>
                    <p className="text-sm text-muted-foreground">보컬 분리, 전사, 화자 식별 및 배경음 분석을 동시에 진행하고 있습니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background border rounded-xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg">
                        <Mic2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg tracking-tight">ViraLoop Dubbing Studio <Badge className="ml-2 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-none">Pro</Badge></h2>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{initialFile.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="ghost" className="hover:bg-destructive/10 hover:text-destructive" onClick={onClose}>종료</Button>
                    <Button onClick={handleExport} disabled={exporting} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                        {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        스튜디오 마스터링 및 내보내기
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left: Editor Area */}
                <div className="flex-1 flex flex-col border-r overflow-hidden">
                    <Tabs defaultValue="script" className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-4 pt-2 border-b bg-muted/20">
                            <TabsList className="bg-transparent gap-6 h-12">
                                <TabsTrigger value="script" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none bg-transparent px-0 font-bold text-sm">
                                    <Languages className="w-4 h-4 mr-2" />
                                    대본 & 번역
                                </TabsTrigger>
                                <TabsTrigger value="speakers" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none bg-transparent px-0 font-bold text-sm">
                                    <Users className="w-4 h-4 mr-2" />
                                    화자/목소리
                                </TabsTrigger>
                                <TabsTrigger value="bgm" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none bg-transparent px-0 font-bold text-sm">
                                    <Volume2 className="w-4 h-4 mr-2" />
                                    배경음(BGM)
                                </TabsTrigger>
                                <TabsTrigger value="subtitles" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none bg-transparent px-0 font-bold text-sm">
                                    <Settings className="w-4 h-4 mr-2" />
                                    자막 디자인
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* Script Content */}
                        <TabsContent value="script" className="flex-1 overflow-auto p-6 space-y-4 bg-muted/5">
                            {segments.map((seg, idx) => (
                                <div key={seg.id} className={cn(
                                    "p-5 border rounded-xl transition-all hover:shadow-md group",
                                    seg.is_excluded ? "opacity-40 grayscale bg-muted" : "bg-card border-border/50 shadow-sm"
                                )}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="px-2 py-1 bg-muted rounded font-mono text-[10px] font-bold cursor-pointer hover:bg-blue-500 hover:text-white transition-colors" onClick={() => jumpToTime(seg.start)}>
                                                {seg.start.toFixed(2)}s - {seg.end.toFixed(2)}s
                                            </div>
                                            <Badge className="bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 border-none font-bold">
                                                {seg.speaker_id}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" onClick={() => handlePreviewSegment(idx)}>
                                                <Play className="w-4 h-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => {
                                                    const newSegs = [...segments];
                                                    newSegs[idx].is_excluded = !newSegs[idx].is_excluded;
                                                    setSegments(newSegs);
                                                }}
                                            >
                                                {seg.is_excluded ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Trash2 className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">Original Source</label>
                                            <p className="text-sm leading-relaxed font-medium text-muted-foreground/80">{seg.text}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-blue-500 tracking-tighter">Dubbing Target ({targetLang})</label>
                                            <textarea 
                                                className="w-full text-sm font-bold bg-muted/30 border-none focus:ring-1 focus:ring-blue-500/20 rounded-lg p-3 resize-none h-20 shadow-inner"
                                                value={seg.translation}
                                                onChange={(e) => {
                                                    const newSegs = [...segments];
                                                    newSegs[idx].translation = e.target.value;
                                                    setSegments(newSegs);
                                                }}
                                                placeholder="번역 및 더빙 내용을 입력하세요..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </TabsContent>

                        {/* BGM Management */}
                        <TabsContent value="bgm" className="p-8 space-y-8 overflow-auto">
                            <div className="max-w-2xl mx-auto space-y-8">
                                <div className="flex items-center justify-between p-6 border rounded-2xl bg-card shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-3 rounded-xl", bgmConfig.original_enabled ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground")}>
                                            {bgmConfig.original_enabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold">원본 배경음(BGM) 사용</h3>
                                            <p className="text-xs text-muted-foreground font-medium">인공지능이 분리한 원본의 배경 사운드를 유지합니다.</p>
                                        </div>
                                    </div>
                                    <Button 
                                        variant={bgmConfig.original_enabled ? "default" : "outline"}
                                        onClick={() => setBgmConfig(p => ({...p, original_enabled: !p.original_enabled}))}
                                        className="w-24"
                                    >
                                        {bgmConfig.original_enabled ? "사용 중" : "사용 안함"}
                                    </Button>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">새로운 배경음 교체</h3>
                                        {bgmConfig.custom_path && (
                                            <Button variant="ghost" size="sm" className="text-destructive font-bold h-7" onClick={() => setBgmConfig(p => ({...p, custom_path: null, custom_file: null}))}>초기화</Button>
                                        )}
                                    </div>
                                    
                                    {!bgmConfig.custom_path ? (
                                        <div 
                                            className="border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center gap-4 bg-muted/10 hover:bg-blue-500/5 hover:border-blue-500/50 transition-all cursor-pointer group"
                                            onClick={() => bgmInputRef.current?.click()}
                                        >
                                            <div className="p-4 bg-muted rounded-full group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                                <Volume2 className="w-8 h-8" />
                                            </div>
                                            <div className="text-center">
                                                <p className="font-bold">MP3 또는 WAV 파일 업로드</p>
                                                <p className="text-xs text-muted-foreground mt-1">파일을 드래그하거나 클릭하여 선택하세요.</p>
                                            </div>
                                            <input type="file" ref={bgmInputRef} className="hidden" accept="audio/*" onChange={(e) => e.target.files?.[0] && handleBGMUpload(e.target.files[0])} />
                                        </div>
                                    ) : (
                                        <Card className="border-blue-500/30 bg-blue-500/5 shadow-inner">
                                            <CardContent className="p-6 space-y-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-500 text-white rounded-lg">
                                                        <Volume2 className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold truncate">{bgmConfig.custom_file?.name}</p>
                                                        <p className="text-[10px] text-blue-600 font-bold uppercase">배경음 교체 활성화됨</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase text-muted-foreground">배경음 볼륨</label>
                                                        <div className="flex items-center gap-3">
                                                            <Volume2 className="w-4 h-4 text-muted-foreground" />
                                                            <input 
                                                                type="range" 
                                                                className="flex-1 h-1 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                                min="0" max="1" step="0.1" 
                                                                value={bgmConfig.volume}
                                                                onChange={(e) => setBgmConfig(p => ({...p, volume: parseFloat(e.target.value)}))}
                                                            />
                                                            <span className="text-xs font-bold w-8">{Math.round(bgmConfig.volume * 100)}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase text-muted-foreground">시작 지점 (Seconds)</label>
                                                        <Input 
                                                            type="number" 
                                                            className="h-8 text-sm font-bold border-blue-500/20"
                                                            value={bgmConfig.start_time}
                                                            onChange={(e) => setBgmConfig(p => ({...p, start_time: parseFloat(e.target.value)}))}
                                                        />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        {/* Subtitle Styling */}
                        <TabsContent value="subtitles" className="p-8 space-y-8 overflow-auto">
                            <div className="max-w-2xl mx-auto space-y-8">
                                <div className="space-y-6">
                                    <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">자막 시각적 배치</h3>
                                    
                                    <div className="grid grid-cols-3 gap-4">
                                        {['top', 'middle', 'bottom'].map(pos => (
                                            <div 
                                                key={pos}
                                                className={cn(
                                                    "border-2 rounded-2xl p-6 cursor-pointer transition-all flex flex-col items-center gap-3",
                                                    subConfig.position === pos ? "border-blue-500 bg-blue-500/5 ring-4 ring-blue-500/10" : "hover:border-blue-300"
                                                )}
                                                onClick={() => setSubConfig(p => ({...p, position: pos as any}))}
                                            >
                                                <div className="w-full aspect-[4/3] bg-muted/30 rounded border relative overflow-hidden shadow-inner">
                                                    <div className={cn(
                                                        "absolute left-2 right-2 h-2 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50",
                                                        pos === 'top' ? 'top-4' : pos === 'middle' ? 'top-1/2 -translate-y-1/2' : 'bottom-4'
                                                    )} />
                                                </div>
                                                <p className="text-xs font-bold capitalize">{pos}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground">글꼴 크기 (Font Size)</label>
                                        <div className="flex items-center gap-4">
                                            <input 
                                                type="range" 
                                                className="flex-1 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                min="12" max="64" step="1" 
                                                value={subConfig.font_size}
                                                onChange={(e) => setSubConfig(p => ({...p, font_size: parseInt(e.target.value)}))}
                                            />
                                            <span className="text-sm font-bold w-12">{subConfig.font_size}px</span>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground">자막 색상 (Color)</label>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="color" 
                                                className="w-10 h-10 rounded-lg cursor-pointer border-none p-0 bg-transparent"
                                                value={subConfig.color}
                                                onChange={(e) => setSubConfig(p => ({...p, color: e.target.value}))}
                                            />
                                            <Input 
                                                className="h-10 font-mono text-xs font-bold"
                                                value={subConfig.color}
                                                onChange={(e) => setSubConfig(p => ({...p, color: e.target.value}))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Speakers Tab */}
                        <TabsContent value="speakers" className="p-8 space-y-6 overflow-auto">
                            <div className="max-w-3xl mx-auto grid gap-4">
                                {Object.keys(speakerMap).map(speakerId => (
                                    <div key={speakerId} className="flex items-center justify-between p-6 bg-card border rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg">
                                                {speakerId.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div>
                                                <h3 className="font-black text-lg">{speakerId}</h3>
                                                <p className="text-xs text-muted-foreground font-medium">분석된 대사 수: <span className="text-blue-500 font-bold">{segments.filter(s => s.speaker_id === speakerId).length}</span></p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4">
                                            <Select 
                                                value={speakerMap[speakerId]} 
                                                onValueChange={(val) => setSpeakerMap(prev => ({...prev, [speakerId]: val}))}
                                            >
                                                <SelectTrigger className="w-[280px] h-12 font-bold border-muted-foreground/20 bg-muted/10">
                                                    <SelectValue placeholder="AI 보이스 선택" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {voices.map(v => (
                                                        <SelectItem key={v.id} value={v.id} className="font-medium">
                                                            <span className="flex items-center gap-3">
                                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-muted font-black">{v.engine.toUpperCase()}</Badge>
                                                                {v.name}
                                                            </span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right: Preview Area */}
                <div className="w-[450px] flex flex-col bg-muted/20 overflow-auto border-l">
                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <h3 className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">더빙 스튜디오 모니터</h3>
                            <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-muted/50 relative group">
                                <video 
                                    ref={videoRef}
                                    src={videoPath ? `/temp/${videoPath.split('/').pop()}` : ""} 
                                    className="w-full h-full object-contain"
                                    controls
                                />
                                {subConfig.enabled && segments.length > 0 && (
                                    <div className={cn(
                                        "absolute left-0 right-0 p-4 flex justify-center pointer-events-none",
                                        subConfig.position === 'top' ? 'top-4' : subConfig.position === 'middle' ? 'top-1/2 -translate-y-1/2' : 'bottom-8'
                                    )}>
                                        <div 
                                            className="px-4 py-2 rounded-lg font-bold text-center max-w-[80%] shadow-2xl"
                                            style={{ 
                                                fontSize: `${subConfig.font_size * 0.7}px`, 
                                                color: subConfig.color,
                                                backgroundColor: `${subConfig.background_color}CC`
                                            }}
                                        >
                                            이곳에 번역된 자막이 표시됩니다
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <Card className="rounded-3xl border-none shadow-xl bg-gradient-to-b from-card to-muted/50">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-xs font-black uppercase tracking-tighter flex items-center gap-2">
                                    <Settings className="w-4 h-4 text-blue-500" />
                                    글로벌 렌더링 설정
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground">최종 더빙 언어 (Mastering Lang)</label>
                                    <Select value={targetLang} onValueChange={setTargetLang}>
                                        <SelectTrigger className="font-bold border-none bg-muted/40 h-12 rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="en" className="font-bold">English (US)</SelectItem>
                                            <SelectItem value="ko" className="font-bold">한국어 (Korean)</SelectItem>
                                            <SelectItem value="ja" className="font-bold">日本語 (Japanese)</SelectItem>
                                            <SelectItem value="es" className="font-bold">Español (Spanish)</SelectItem>
                                            <SelectItem value="zh" className="font-bold">中文 (Chinese)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Volume2 className="w-4 h-4 text-blue-500" />
                                            <span className="text-xs font-bold">오리지널 BGM 믹싱</span>
                                        </div>
                                        <Badge className={cn("border-none font-bold", bgmConfig.original_enabled ? "bg-green-500 text-white" : "bg-muted text-muted-foreground")}>
                                            {bgmConfig.original_enabled ? "ENABLED" : "DISABLED"}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Languages className="w-4 h-4 text-purple-500" />
                                            <span className="text-xs font-bold">비주얼 자막 합성</span>
                                        </div>
                                        <Badge variant="outline" className="border-purple-500/30 text-purple-600 font-bold">
                                            {subConfig.position.toUpperCase()}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-orange-500" />
                                            <span className="text-xs font-bold">멀티 스피커 디아리제이션</span>
                                        </div>
                                        <Badge variant="outline" className="border-orange-500/30 text-orange-600 font-bold">ACTIVE</Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DubbingStudio;
