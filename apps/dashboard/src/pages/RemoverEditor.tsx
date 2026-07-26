import React, { useState, useRef, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import {
    Scissors, Copy, Trash2, VolumeX, Volume2,
    ZoomIn, ZoomOut, Maximize, Hand, MousePointer2,
    Eraser, Music, Play, Pause, AlertCircle, CheckCircle2,
    Undo, Redo, Download, Upload, Loader2, RefreshCcw
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import axios from 'axios';

// --- Types ---
interface Rect {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
}

interface VideoState {
    id: number | null;
    src: string | null;
    duration: number;
    currentTime: number;
    isPlaying: boolean;
    isMuted: boolean;
    width: number;
    height: number;
    file_path?: string;
}

const RemoverEditor = () => {
    const [tool, setTool] = useState<'select' | 'hand' | 'draw'>('select');
    const [isDrawing, setIsDrawing] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const [videoState, setVideoState] = useState<VideoState>({
        id: null,
        src: null,
        duration: 0,
        currentTime: 0,
        isPlaying: false,
        isMuted: false,
        width: 0,
        height: 0
    });

    const [rectangles, setRectangles] = useState<Rect[]>([]);
    const [currentRect, setCurrentRect] = useState<Rect | null>(null);
    const startPos = useRef<{ x: number, y: number } | null>(null);

    const [audioMode, setAudioMode] = useState<'none' | 'remove_vocal' | 'remove_bgm'>('none');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processResult, setProcessResult] = useState<string | null>(null); // Store result URL

    // --- Video Controls ---
    const togglePlay = () => {
        if (!videoRef.current || !videoState.src) return;
        if (videoState.isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play();
        }
        setVideoState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    };

    const toggleMute = () => {
        if (!videoRef.current) return;
        videoRef.current.muted = !videoState.isMuted;
        setVideoState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setVideoState(prev => ({ ...prev, currentTime: videoRef.current!.currentTime }));
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            const { videoWidth, videoHeight, duration } = videoRef.current;
            console.log(`Video Loaded: ${videoWidth}x${videoHeight}, ${duration}s`);
            setVideoState(prev => ({
                ...prev,
                duration: duration || 0,
                width: videoWidth,
                height: videoHeight
            }));
        }
    };

    const handleSeek = (value: number[]) => {
        if (videoRef.current) {
            videoRef.current.currentTime = value[0];
            setVideoState(prev => ({ ...prev, currentTime: value[0] }));
        }
    };

    // --- Canvas Drawing Logic ---
    const getCanvasCoords = (e: React.MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        // Calculate scale based on displayed size vs actual size
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (tool !== 'draw' || !videoState.src) return;
        setIsDrawing(true);
        const { x, y } = getCanvasCoords(e);
        startPos.current = { x, y };
        setCurrentRect({
            id: 'temp',
            x, y, w: 0, h: 0,
            color: 'rgba(239, 68, 68, 0.4)'
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || !startPos.current || tool !== 'draw') return;
        const { x, y } = getCanvasCoords(e);
        const newW = x - startPos.current.x;
        const newH = y - startPos.current.y;
        setCurrentRect(prev => prev ? ({ ...prev, w: newW, h: newH }) : null);
    };

    const handleMouseUp = () => {
        if (!isDrawing || tool !== 'draw' || !currentRect) return;
        setIsDrawing(false);
        let { x, y, w, h } = currentRect;
        if (w < 0) { x += w; w = Math.abs(w); }
        if (h < 0) { y += h; h = Math.abs(h); }

        if (w > 5 && h > 5) {
            const newRect: Rect = {
                id: Date.now().toString(),
                x, y, w, h,
                color: 'rgba(239, 68, 68, 0.5)'
            };
            setRectangles(prev => [...prev, newRect]);
        }
        setCurrentRect(null);
        startPos.current = null;
    };

    // --- Canvas Rendering Loop ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        rectangles.forEach(rect => {
            ctx.fillStyle = rect.color;
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
            ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        });

        if (currentRect) {
            ctx.fillStyle = currentRect.color;
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            let { x, y, w, h } = currentRect;
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
        }
    }, [rectangles, currentRect, videoState.width, videoState.height]);

    // --- File Handling ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
        let file: File | undefined;
        
        if ('files' in e.target && e.target.files) {
            file = e.target.files[0];
        } else if ('dataTransfer' in e && e.dataTransfer.files) {
            file = e.dataTransfer.files[0];
        }

        if (!file) return;
        if (!file.type.startsWith('video/')) {
            toast.error("비디오 파일만 업로드 가능합니다.");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        setIsProcessing(true);

        try {
            const apiBase = '/api';
            const res = await axios.post(`${apiBase}/remover/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const data = res.data;
            const videoSrc = data.web_url || data.url;

            setVideoState({
                id: data.id,
                src: videoSrc,
                file_path: data.file_path,
                width: 0,
                height: 0,
                duration: 0,
                currentTime: 0,
                isPlaying: false,
                isMuted: false
            });
            setRectangles([]);
            setProcessResult(null); // Reset result
            toast.success("비디오가 로드되었습니다.");
        } catch (error) {
            console.error(error);
            toast.error("업로드 실패");
        } finally {
            setIsProcessing(false);
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        handleFileUpload(e);
    };

    const handleDownload = async () => {
        if (!processResult) return;

        try {
            toast.info("다운로드를 준비 중입니다...");

            // 1. Fetch file as Blob to bypass browser playing behavior
            const response = await axios.get(processResult, {
                responseType: 'blob'
            });

            // 2. Create a temporary local URL
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            // 3. Extract filename or generate one
            const filename = processResult.split('/').pop() || `processed_${Date.now()}.mp4`;
            link.setAttribute('download', filename);

            // 4. Trigger download
            document.body.appendChild(link);
            link.click();

            // 5. Cleanup
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success("다운로드가 시작되었습니다.");
        } catch (error) {
            console.error("Download failed:", error);
            toast.error("다운로드 실패. 새 창에서 엽니다.");
            // Fallback
            window.open(processResult, '_blank');
        }
    };

    // --- Process ---
    const handleProcess = async () => {
        if (!videoState.file_path) {
            toast.error("비디오가 로드되지 않았습니다.");
            return;
        }

        setIsProcessing(true);
        toast.info("작업이 대기열에 등록되었습니다...");

        try {
            const videoEl = document.querySelector('video');
            const displayWidth = videoEl?.clientWidth || 1;
            const displayHeight = videoEl?.clientHeight || 1;
            
            const videoWidth = videoState.width || displayWidth;
            const videoHeight = videoState.height || displayHeight;

            const scaleX = videoWidth / displayWidth;
            const scaleY = videoHeight / displayHeight;

            const payload: any = {
                video_id: videoState.id || 0,
                file_path: videoState.file_path,
                audio_mode: audioMode === 'none' ? null : audioMode
            };

            if (rectangles.length > 0) {
                payload.rois = rectangles.map(r => ({
                    x: Math.round(r.x * scaleX),
                    y: Math.round(r.y * scaleY),
                    width: Math.round((r.w || 0) * scaleX),
                    height: Math.round((r.h || 0) * scaleY)
                }));
            }

            // 1. Queue the task
            const res = await axios.post('/api/remover/process', payload);
            const taskId = res.data.task_id;

            // 2. Poll for status
            const intervalId = setInterval(async () => {
                try {
                    const statusRes = await axios.get(`/api/remover/status/${taskId}`);
                    const status = statusRes.data;

                    if (status.status === 'completed') {
                        clearInterval(intervalId);
                        setIsProcessing(false);
                        const resultUrl = status.result.result_url;
                        setProcessResult(resultUrl);
                        setVideoState(prev => ({ ...prev, src: resultUrl, isPlaying: false }));
                        setRectangles([]);
                        toast.success("처리가 완료되었습니다!");
                    } else if (status.status === 'failed') {
                        clearInterval(intervalId);
                        setIsProcessing(false);
                        toast.error(`처리 실패: ${status.error}`);
                    }
                } catch (e) {
                    console.error(e);
                }
            }, 1000);

        } catch (error: any) {
            console.error(error);
            setIsProcessing(false);
            const detail = error.response?.data?.detail;
            const errorMsg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || error.message);
            toast.error("요청 실패: " + errorMsg);
        }
    };

    return (
        <div className="flex h-[calc(100vh-theme(spacing.16))] bg-background text-foreground border-t border-border">
            {/* Sidebar */}
            <aside className="w-80 bg-card border-r border-border flex flex-col shadow-sm z-10">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] font-black uppercase border-primary/30 text-primary bg-primary/10">Object Removal System</Badge>
                    <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <div className="w-1.5 h-1.5 rounded-full bg-border" />
                    </div>
                </div>

                <div className="flex-1 p-4 space-y-8 overflow-y-auto">
                    {/* Visual Tools */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold flex items-center gap-2">
                            <MousePointer2 className="w-4 h-4" /> 시각적 지우개
                            <Badge variant="secondary" className="bg-primary/10 text-primary ml-auto">OpenCV</Badge>
                        </label>
                        <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant={tool === 'draw' ? "default" : "outline"} onClick={() => setTool('draw')} className="w-full text-xs border-border">
                                    <Eraser className="w-3 h-3 mr-2" /> 영역 선택
                                </Button>
                                {/* New Project Button */}
                                <Button variant="outline" onClick={() => window.location.reload()} className="w-full text-xs border-border hover:bg-muted">
                                    <RefreshCcw className="w-3 h-3 mr-2" /> 새 작업
                                </Button>
                                <Button variant="outline" onClick={() => setRectangles([])} className="w-full col-span-2 text-xs text-destructive border-destructive/20 hover:bg-destructive/10 mt-1">
                                    <Trash2 className="w-3 h-3 mr-2" /> 선택 초기화
                                </Button>
                            </div>
                            {rectangles.length > 0 && (
                                <p className="text-xs text-emerald-500 font-medium">✨ {rectangles.length}개 영역 선택됨</p>
                            )}
                        </div>
                    </div>

                    {/* Audio Tools */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold flex items-center gap-2">
                            <Music className="w-4 h-4" /> 오디오 클리너
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 ml-auto">AI</Badge>
                        </label>
                        <div className="space-y-2">
                            <div onClick={() => setAudioMode('remove_vocal')} className={cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors", audioMode === 'remove_vocal' ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50")}>
                                <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", audioMode === 'remove_vocal' ? "border-primary" : "border-border")}>
                                    {audioMode === 'remove_vocal' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                </div>
                                <div className="text-xs">
                                    <p className="font-medium">보컬 제거</p>
                                    <p className="text-muted-foreground">배경음악만 남김</p>
                                </div>
                            </div>
                            <div onClick={() => setAudioMode('remove_bgm')} className={cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors", audioMode === 'remove_bgm' ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50")}>
                                <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", audioMode === 'remove_bgm' ? "border-primary" : "border-border")}>
                                    {audioMode === 'remove_bgm' && <div className="w-2 h-2 rounded-full bg-primary" />}
                                </div>
                                <div className="text-xs">
                                    <p className="font-medium">배경음악 제거</p>
                                    <p className="text-muted-foreground">목소리만 남김</p>
                                </div>
                            </div>
                            <div onClick={() => setAudioMode('none')} className={cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors", audioMode === 'none' ? "border-muted-foreground/50 bg-muted/40" : "border-border")}>
                                <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", audioMode === 'none' ? "border-muted-foreground" : "border-border")}>
                                    {audioMode === 'none' && <div className="w-2 h-2 rounded-full bg-muted-foreground" />}
                                </div>
                                <span className="text-xs font-medium">오디오 처리 안 함</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-muted/20 space-y-2">
                    <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" size="lg" onClick={handleProcess} disabled={isProcessing || (!rectangles.length && audioMode === 'none')}>
                        {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 처리 중...</> : "처리 시작"}
                    </Button>

                    {/* Download Button - Shows only when result exists */}
                    {processResult && (
                        <Button variant="outline" className="w-full border-emerald-500 text-emerald-500 hover:bg-emerald-500/10" onClick={handleDownload}>
                            <Download className="w-4 h-4 mr-2" /> 결과 다운로드
                        </Button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-muted/30 relative">
                {/* Canvas */}
                <div className="flex-1 relative overflow-hidden flex items-center justify-center p-8">
                    {!videoState.src ? (
                        <div 
                            className={cn(
                                "flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl transition-all w-full max-w-lg",
                                isDragging ? "border-primary bg-primary/10 scale-105" : "border-border bg-card/50"
                            )}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <Upload className={cn("w-12 h-12 mb-4 transition-colors", isDragging ? "text-primary" : "text-muted-foreground")} />
                            <h3 className="text-lg font-bold text-foreground">비디오 업로드</h3>
                            <p className="text-sm text-muted-foreground mb-6">편집할 파일을 드래그하거나 선택하세요</p>
                            <div className="relative">
                                <Button className={isDragging ? "bg-primary text-primary-foreground" : "border-border"}>파일 선택</Button>
                                <input type="file" accept="video/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} />
                            </div>
                        </div>
                    ) : (
                        <TransformWrapper initialScale={1} minScale={0.5} maxScale={8} disabled={tool !== 'hand'} wheel={{ disabled: tool === 'draw' }} panning={{ disabled: tool !== 'hand' }}>
                            {({ zoomIn, zoomOut, resetTransform }) => (
                                <>
                                    <div className="absolute top-4 right-4 bg-card/90 backdrop-blur shadow-sm border border-border rounded-lg p-1 flex gap-1 z-50">
                                        <Button size="icon" variant={tool === 'select' ? 'secondary' : 'ghost'} onClick={() => setTool('select')} title="선택 도구"><MousePointer2 className="w-4 h-4" /></Button>
                                        <Button size="icon" variant={tool === 'hand' ? 'secondary' : 'ghost'} onClick={() => setTool('hand')} title="이동 도구"><Hand className="w-4 h-4" /></Button>
                                        <div className="w-px h-6 bg-border mx-1 self-center" />
                                        <Button size="icon" variant="ghost" onClick={() => zoomIn()} title="확대"><ZoomIn className="w-4 h-4" /></Button>
                                        <Button size="icon" variant="ghost" onClick={() => zoomOut()} title="축소"><ZoomOut className="w-4 h-4" /></Button>
                                        <Button size="icon" variant="ghost" onClick={() => resetTransform()} title="초기화"><Maximize className="w-4 h-4" /></Button>
                                        <div className="w-px h-6 bg-border mx-1 self-center" />
                                        <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => {
                                            setVideoState({
                                                id: null,
                                                src: null,
                                                duration: 0,
                                                currentTime: 0,
                                                isPlaying: false,
                                                isMuted: false,
                                                width: 0,
                                                height: 0
                                            });
                                            setRectangles([]);
                                            setProcessResult(null);
                                        }} title="비디오 제거">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                                        <div
                                            className="relative shadow-2xl rounded-lg overflow-hidden bg-black"
                                            style={{
                                                aspectRatio: videoState.width && videoState.height ? `${videoState.width}/${videoState.height}` : 'auto',
                                                maxHeight: '75vh',
                                                maxWidth: '100%'
                                            }}
                                        >
                                            <video
                                                ref={videoRef}
                                                src={videoState.src || undefined}
                                                className="w-full h-full object-contain block"
                                                onTimeUpdate={handleTimeUpdate}
                                                onLoadedMetadata={handleLoadedMetadata}
                                                onEnded={() => setVideoState(p => ({ ...p, isPlaying: false }))}
                                                crossOrigin="anonymous"
                                            />
                                            <canvas
                                                ref={canvasRef}
                                                width={videoState.width}
                                                height={videoState.height}
                                                className={cn("absolute inset-0 w-full h-full", tool === 'draw' ? "cursor-crosshair" : tool === 'hand' ? "cursor-grab" : "cursor-default")}
                                                onMouseDown={handleMouseDown}
                                                onMouseMove={handleMouseMove}
                                                onMouseUp={handleMouseUp}
                                                onMouseLeave={handleMouseUp}
                                            />
                                        </div>
                                    </TransformComponent>
                                </>
                            )}
                        </TransformWrapper>
                    )}
                </div>

                {/* Timeline */}
                <div className="h-20 bg-card border-t border-border flex items-center px-6 gap-6 z-20">
                    <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" className="rounded-full w-12 h-12 border-border" onClick={togglePlay}>
                            {videoState.isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={toggleMute}>
                            {videoState.isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </Button>
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between text-xs text-muted-foreground mb-2 font-mono">
                            <span>{formatTime(videoState.currentTime)}</span>
                            <span>{formatTime(videoState.duration)}</span>
                        </div>
                        <Slider
                            value={[videoState.currentTime]}
                            max={videoState.duration || 100}
                            step={0.1}
                            onValueChange={handleSeek}
                            className="cursor-pointer"
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};

// Helper
const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export default RemoverEditor;
