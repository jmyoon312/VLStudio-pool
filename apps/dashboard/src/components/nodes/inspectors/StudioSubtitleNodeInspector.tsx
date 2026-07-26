
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useReactFlow, useEdges, useNodes } from 'reactflow';
import SubtitleConfigPanel from '@/components/shared/SubtitleConfigPanel';
import { SubtitleConfig, DEFAULT_SUBTITLE_CONFIG } from '@/types/subtitle';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Play, Download, Square, Smartphone, Monitor, RefreshCw, Layers, ChevronLeft, ChevronRight, FileText, Music, Pause, Volume2, Wand2, Layout } from "lucide-react";
import { toast } from "sonner";
import api from '@/lib/api';

// Helper to parse SRT string into objects
interface SrtLine {
    id: number;
    start: number;
    end: number;
    text: string;
}

const parseSRT = (srt: string): SrtLine[] => {
    if (!srt) return [];
    const pattern = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n([\s\S]*?)(?=\n\n|\n*$)/g;
    const lines: SrtLine[] = [];
    let match;
    while ((match = pattern.exec(srt)) !== null) {
        lines.push({
            id: parseInt(match[1]),
            start: timeToSeconds(match[2]),
            end: timeToSeconds(match[3]),
            text: match[4].trim()
        });
    }
    return lines;
};

const timeToSeconds = (timeStr: string): number => {
    const [h, m, s] = timeStr.split(':');
    const [sec, ms] = s.split(',');
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(sec) + parseInt(ms) / 1000;
};

const StudioSubtitleNodeInspector: React.FC<{ data: any, id: string }> = ({ data, id }) => {
    const { setNodes, getNodes } = useReactFlow();
    const edges = useEdges();
    const nodes = getNodes();

    // --- 1. Paired Data Logic (Text + Audio) ---
    const pairedData = useMemo(() => {
        const incomingEdges = edges.filter(e => e.target === id);
        const sourceNodes = incomingEdges.map(e => nodes.find(n => n.id === e.source)).filter(Boolean);

        let foundTextItems: string[] = [];
        let foundAudioItems: string[] = [];

        sourceNodes.forEach(node => {
            const resultItems = node?.data?.executionResult?.items;
            const singleScript = node?.data?.outputScript || node?.data?.text;
            const singleAudio = node?.data?.lastAudioResult?.audio_url;

            if (resultItems && Array.isArray(resultItems)) {
                resultItems.forEach((item, i) => {
                    // Robust unpacking of item or item.json
                    const data = item.json || item;
                    const txt = data.script || data.text || data.generated_text || data.content || data.question; // aggregated fields
                    const aud = data.audio_url || data.url; // aggregated fields

                    if (txt) foundTextItems[i] = txt;
                    if (aud) foundAudioItems[i] = aud;
                });
            } else {
                if (singleScript) foundTextItems[0] = singleScript;
                if (singleAudio) foundAudioItems[0] = singleAudio;
            }
        });

        // Ensure we have at least one slot if anything exists
        const count = Math.max(foundTextItems.length, foundAudioItems.length, 1);
        const pairs = [];
        for (let i = 0; i < count; i++) {
            pairs.push({
                text: foundTextItems[i] || "",
                audioUrl: foundAudioItems[i] || null,
                srt: (data.srtCache && data.srtCache[i]) ? data.srtCache[i] : null
            });
        }
        return pairs;
    }, [edges, id, nodes, data.srtCache]);

    // Local State
    const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
    const [autoRun, setAutoRun] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [processing, setProcessing] = useState(false);
    const [splitLimit, setSplitLimit] = useState(20); // Default segmentation limit

    // Player State
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0); // Add duration state

    const currentItem = pairedData[currentIndex] || { text: "", audioUrl: null, srt: null };



    // 2. Config
    const config: SubtitleConfig = useMemo(() => {
        return data.subtitleConfig || DEFAULT_SUBTITLE_CONFIG;
    }, [data.subtitleConfig]);

    const handleConfigChange = (newConfig: SubtitleConfig) => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === id) {
                    return { ...node, data: { ...node.data, subtitleConfig: newConfig } };
                }
                return node;
            })
        );
    };
    // Sync Preview SRT
    const parsedSubtitles = useMemo(() => parseSRT(currentItem.srt || ""), [currentItem.srt]);

    const currentSubtitleText = useMemo(() => {
        // Fix: Do NOT show raw text if no SRT is generated. It looks like a bug.
        // Show a placeholder or nothing.
        if (!currentItem.srt) return "";

        const activeLine = parsedSubtitles.find(line => currentTime >= line.start && currentTime <= line.end);
        return activeLine ? activeLine.text : "";
    }, [parsedSubtitles, currentTime, currentItem.text, currentItem.srt]);

    // Font Injector
    useEffect(() => {
        if (!config.font) return;
        const fontName = config.font;
        const linkId = `font-link-${fontName.replace(/\s+/g, '-')}`;
        if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@400;700&display=swap`;
            document.head.appendChild(link);
        }
    }, [config.font]);


    // 3. Audio Handlers
    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            setDuration(audioRef.current.duration || 0);
        }
    };

    const handleScrub = (val: number[]) => {
        if (audioRef.current) {
            audioRef.current.currentTime = val[0];
            setCurrentTime(val[0]);
        }
    };

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    // 4. Core Feature: Automated Extract & Align Pipeline
    // Updated Process Logic with Strict Split Limit check
    const processItem = async (index: number, item: typeof currentItem) => {
        if (!item.audioUrl && !item.text) {
            console.warn("Skipping empty item", index);
            return null;
        }

        let rawSrt = "";

        // STEP 1: Extract SRT from Audio
        if (item.audioUrl) {
            try {
                const response = await fetch(item.audioUrl);
                const blob = await response.blob();
                const file = new File([blob], "temp_audio.mp3", { type: "audio/mpeg" });

                const formData = new FormData();
                formData.append('file', file);
                formData.append('model', 'base');

                const extractRes = await api.post('/tools/subtitle/extract', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                rawSrt = extractRes.data.srt_content;
            } catch (e) {
                console.error("Extraction Failed", e);
                // Non-fatal, we can proceed with text-only linear generation
            }
        }

        // STEP 2: Align / Generate
        let finalSrt = rawSrt;

        if (item.text) {
            // Priority: Align > Extract > Generate
            if (rawSrt) {
                try {
                    const alignRes = await api.post('/tools/subtitle/align', {
                        original_text: item.text,
                        srt_text: rawSrt,
                        limit: splitLimit,
                        use_alignment: true,
                        use_marker_segmentation: false
                    });
                    finalSrt = alignRes.data.step2 || alignRes.data.step1 || rawSrt;
                } catch (e) {
                    console.error("Align Failed", e);
                    // Fallback to locally segmented rawSrt if alignment fails? 
                    // Or re-segment rawSrt?
                    // Let's use the local generator as ultimate fallback for text layout if alignment dead-ends.
                    finalSrt = generateLinearSrt(item.text, splitLimit, duration || 10);
                }
            } else {
                // No Audio Analysis -> Linear Generation
                const dur = duration || (item.audioUrl ? 10 : 5); // guess duration
                finalSrt = generateLinearSrt(item.text, splitLimit, dur);
            }
        }

        // enforce strict limit on the final output regardless of source
        return enforceStrictLimit(finalSrt, splitLimit);
    };

    // Helper: Strict Limit Enforcer (Post-Processor)
    const enforceStrictLimit = (srtContent: string, limit: number): string => {
        // Parse SRT
        const blocks = srtContent.trim().split(/\n\s*\n/);
        let newSrt = "";
        let counter = 1;

        blocks.forEach(block => {
            const lines = block.split('\n');
            if (lines.length < 3) return; // invalid block

            const timeLine = lines[1];
            // Join all content lines (2 and beyond) into one text
            const fullText = lines.slice(2).join(' ');

            // Re-segment
            const finalLines: string[] = [];
            let currentLine = "";

            // Logic: Split by space, build lines. If a single word is > limit, we might have to break it (optional, but requested behavior implies strictness)
            // For natural reading, we prefer breaking at spaces.

            const words = fullText.split(/\s+/);
            words.forEach(word => {
                if (currentLine.length + word.length + (currentLine ? 1 : 0) > limit) {
                    if (currentLine) finalLines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine += (currentLine ? " " : "") + word;
                }
            });
            if (currentLine) finalLines.push(currentLine);

            // If we ended up with more lines than originally, we might want to split the time duration?
            // For now, let's keep the original time duration but just multiline the text.
            // If the user wants separate timed blocks, that's much harder (requires re-alignment).
            // However, the issue described "didn't go to two lines" implies just visual wrapping.
            // BUT standard SRT multiline is just `Line 1\nLine 2`.

            newSrt += `${counter++}\n${timeLine}\n${finalLines.join('\n')}\n\n`;
        });

        return newSrt;
    };

    // Helper: Linear SRT Generator (Fallback)
    // Improved Linear Generator with Strict Splitting
    const generateLinearSrt = (text: string, limit: number, totalDuration: number) => {
        // Use the same logic
        const words = text.split(/\s+/);
        const chunks = [];
        let currentChunk = [];
        let len = 0;

        words.forEach(w => {
            const wordLen = w.length;
            if (len + wordLen + (currentChunk.length > 0 ? 1 : 0) > limit) {
                if (currentChunk.length > 0) chunks.push(currentChunk.join(' '));
                currentChunk = [w];
                len = wordLen;
            } else {
                currentChunk.push(w);
                len += wordLen + (currentChunk.length > 0 ? 1 : 0);
            }
        });
        if (currentChunk.length) chunks.push(currentChunk.join(' '));

        let generatedSrt = "";
        const chunkDur = totalDuration / Math.max(chunks.length, 1);
        chunks.forEach((chunk, idx) => {
            generatedSrt += `${idx + 1}\n${fmtTime(idx * chunkDur)} --> ${fmtTime((idx + 1) * chunkDur)}\n${chunk}\n\n`;
        });
        return generatedSrt;
    };

    const fmtTime = (s: number) => {
        const ms = Math.floor((s % 1) * 1000);
        const sec = Math.floor(s % 60);
        const min = Math.floor((s / 60) % 60);
        const hr = Math.floor(s / 3600);
        return `${pad(hr)}:${pad(min)}:${pad(sec)},${pad(ms, 3)}`;
    };
    const pad = (n: number, w: number = 2) => String(n).padStart(w, '0');


    // 5. Actions
    const handlePreview = async () => {
        setProcessing(true);
        try {
            const resultSrt = await processItem(currentIndex, currentItem);
            if (resultSrt) {
                updateSrtCache(currentIndex, resultSrt);
                toast.success("자막 생성 완료 (Extract + Align)");
            }
        } catch (e: any) {
            toast.error(e.message || "생성 실패");
        } finally {
            setProcessing(false);
        }
    };

    const handleBatchRun = async () => {
        setProcessing(true);
        try {
            toast.info(`총 ${pairedData.length}개 항목 일괄 처리 시작...`);
            let successCount = 0;
            for (let i = 0; i < pairedData.length; i++) {
                // Add minor delay/throttle
                if (i > 0) await new Promise(r => setTimeout(r, 500));

                try {
                    const srt = await processItem(i, pairedData[i]);
                    if (srt) {
                        updateSrtCache(i, srt);
                        successCount++;
                    }
                } catch (err) {
                    console.error(`Item ${i} failed`, err);
                }
            }
            toast.success(`${successCount}개 항목 변환 완료`);
        } catch (e: any) {
            toast.error(e.message || "일괄 처리 실패");
        } finally {
            setProcessing(false);
        }
    };

    // Helper to update node data
    const updateSrtCache = (index: number, srt: string) => {
        setNodes(nds => nds.map(n => {
            if (n.id === id) {
                const newCache = { ...(n.data.srtCache || {}) };
                newCache[index] = srt;
                // Also set as main SRT if it's 0 or current? 
                // Maybe we store main 'srt' as the last viewed or 0.
                return {
                    ...n,
                    data: {
                        ...n.data,
                        srtCache: newCache,
                        srt: index === 0 ? srt : n.data.srt // update main srt if 0
                    }
                };
            }
            return n;
        }));
    };

    // --- Export Actions ---
    const handleDownloadSRT = () => {
        if (!currentItem.srt) return;
        const blob = new Blob([currentItem.srt], { type: 'text/srt' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `subtitle_${Date.now()}.srt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadCSS = () => {
        // Construct CSS based on config
        const animName = config.animationEntrance || config.animation || 'none';

        let keyframes = "";
        if (animName === 'fade_in') {
            keyframes = `
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
.subtitle-text.animate-in {
    animation: fadeIn ${config.animationEntranceDuration || 0.5}s ease-out forwards;
}`;
        } else if (animName === 'pop_up') {
            keyframes = `
@keyframes popUp {
    from { opacity: 0; transform: scale(0.5); }
    to { opacity: 1; transform: scale(1); }
}
.subtitle-text.animate-in {
    animation: popUp ${config.animationEntranceDuration || 0.5}s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}`;
        } else if (animName === 'typewriter') {
            keyframes = `
@keyframes typewriter {
    from { width: 0; }
    to { width: 100%; }
}
.subtitle-text.animate-in {
    overflow: hidden;
    white-space: nowrap;
    animation: typewriter 2s steps(40, end) forwards; /* Dynamic duration needed in real impl */
}`;
        }

        const cssContent = `
/* Subtitle Styles exported from ViraLoop */
.subtitle-container {
    position: absolute;
    width: 100%;
    pointer-events: none;
    ${config.position === 'bottom' ? `bottom: ${config.marginV}px;` :
                config.position === 'top' ? `top: ${config.marginV}px;` :
                    config.position === 'center' ? `top: 50%; transform: translateY(-50%);` : ''
            }
    text-align: ${config.textAlign || 'center'};
}

.subtitle-text {
    display: inline-block;
    font-family: "${config.font}", sans-serif;
    font-size: ${config.fontSize}px;
    color: ${config.textColor};
    font-weight: ${config.isBold ? 'bold' : 'normal'};
    font-style: ${config.isItalic ? 'italic' : 'normal'};
    
    text-shadow: ${config.shadowSize}px ${config.shadowSize}px 0px ${config.shadowColor};
    -webkit-text-stroke: ${config.outlineSize}px ${config.outlineColor};
    
    background-color: ${config.useBox
                ? `rgba(${parseInt(config.boxColor.slice(1, 3), 16)}, ${parseInt(config.boxColor.slice(3, 5), 16)}, ${parseInt(config.boxColor.slice(5, 7), 16)}, ${config.boxOpacity / 100})`
                : 'transparent'};
        
    padding: 4px 8px;
    border-radius: 4px;
    line-height: 1.4;
    white-space: pre-wrap;
}

/* Animations */
${keyframes}
`;
        const blob = new Blob([cssContent], { type: 'text/css' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `subtitle_style_${Date.now()}.css`;
        a.click();
        URL.revokeObjectURL(url);
    };


    // Styles
    const scale = 0.5;
    const previewStyle: React.CSSProperties = {
        fontFamily: config.font,
        fontSize: `${config.fontSize * scale}px`,
        color: config.textColor,
        fontWeight: config.isBold ? 'bold' : 'normal',
        fontStyle: config.isItalic ? 'italic' : 'normal',
        WebkitTextStroke: `${config.outlineSize * scale}px ${config.outlineColor}`,
        textShadow: `${config.shadowSize * scale}px ${config.shadowSize * scale}px 0px ${config.shadowColor}`,
        backgroundColor: config.useBox
            ? `rgba(${parseInt(config.boxColor.slice(1, 3), 16)}, ${parseInt(config.boxColor.slice(3, 5), 16)}, ${parseInt(config.boxColor.slice(5, 7), 16)}, ${config.boxOpacity / 100})`
            : 'transparent',
        textAlign: (config.textAlign as any) || 'center', // Default to center
        whiteSpace: 'pre-wrap',
        position: 'relative',
        zIndex: 10,
        lineHeight: 1.4,
    };

    const getPositionClass = () => {
        if (config.position === 'custom') return '';
        switch (config.position) {
            case 'top': return 'items-start pt-8';
            case 'middle': return 'items-center';
            case 'bottom': return 'items-end pb-8';
            default: return 'items-end pb-8';
        }
    };

    return (
        <div className="flex flex-col h-full bg-white text-xs font-sans">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-3 border-b bg-slate-50 shrink-0 gap-2">
                <div className="flex items-center gap-2">
                    <Button
                        size="sm" variant={autoRun ? "default" : "outline"}
                        className={`h-7 px-2 ${autoRun ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        onClick={() => setAutoRun(!autoRun)}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1 ${autoRun ? 'animate-spin-slow' : ''}`} /> Auto
                    </Button>
                    <div className="h-4 w-px bg-slate-300" />
                    <div className="flex bg-white rounded-md border p-0.5">
                        <button onClick={() => setAspectRatio('9:16')} className={`p-1 rounded ${aspectRatio === '9:16' ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}>
                            <Smartphone className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setAspectRatio('16:9')} className={`p-1 rounded ${aspectRatio === '16:9' ? 'bg-slate-200 text-blue-600' : 'text-slate-600'}`}>
                            <Monitor className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                <Button
                    size="sm" className="h-7 px-3 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                    onClick={handleBatchRun} disabled={processing}
                >
                    {processing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                    Run (Batch)
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">

                {/* Player Section */}
                <div className="p-4 bg-slate-100 border-b flex flex-col justify-center items-center gap-4 relative">
                    {/* Screen */}
                    <div
                        className={`bg-white rounded-lg overflow-hidden relative flex shadow-xl items-center justify-center transition-all duration-300 ring-1 ring-slate-300`}
                        style={{
                            width: aspectRatio === '9:16' ? '180px' : '320px',
                            height: aspectRatio === '9:16' ? '320px' : '180px',
                            backgroundColor: '#000000',
                            backgroundImage: 'none',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                        }}
                    >
                        {/* Subtitle Overlay */}
                        <div
                            className={`absolute inset-0 flex p-4 ${getPositionClass()}`}
                            style={config.position === 'custom' ? {
                                top: config.customY ? `${config.customY}px` : undefined,
                                left: config.customX ? `${config.customX}px` : undefined,
                            } : {
                                paddingTop: config.position === 'top' ? `${config.marginV}px` : undefined,
                                paddingBottom: config.position === 'bottom' ? `${config.marginV}px` : undefined,
                            }}
                        >
                            {currentSubtitleText ? (
                                <div
                                    style={{ width: '100%', textAlign: (config.textAlign as any) || 'center' }}
                                >
                                    <span
                                        style={previewStyle}
                                        className="px-2 py-1 rounded leading-tight transition-all duration-75 inline-block"
                                    >
                                        {currentSubtitleText}
                                    </span>
                                </div>
                            ) : (
                                !currentItem.srt && (
                                    <div className="text-slate-500 text-[10px] text-center bg-black/50 p-2 rounded backdrop-blur-sm border border-slate-200">
                                        <Wand2 className="w-4 h-4 mx-auto mb-1 opacity-50" />
                                        미리보기를 생성해주세요
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                    {/* Timeline Scrubber */}
                    <div className="w-full max-w-[320px] px-1 flex items-center gap-2">
                        <span className="text-[9px] font-mono text-slate-500 w-8 text-right">
                            {fmtTime(currentTime).split(',')[0]}
                        </span>
                        <Slider
                            value={[currentTime]}
                            min={0}
                            max={Math.max(duration, 0.1)} // prevent 0 divider
                            step={0.1}
                            onValueChange={handleScrub}
                            className="flex-1 cursor-pointer"
                        />
                        <span className="text-[9px] font-mono text-slate-500 w-8">
                            {fmtTime(duration).split(',')[0]}
                        </span>
                    </div>

                    {/* Controls & Segmentation */}
                    <div className="w-full max-w-[320px] bg-white rounded-lg border p-1.5 flex items-center gap-2 shadow-sm justify-between flex-wrap">
                        <div className="flex items-center gap-1">
                            <Button
                                size="icon" variant="ghost" className="h-8 w-8 text-slate-700 hover:bg-slate-100"
                                onClick={togglePlay} disabled={!currentItem.audioUrl}
                            >
                                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                            </Button>

                            <div className="flex flex-col pl-1">
                                <span className="text-[9px] font-bold text-slate-700">
                                    {(currentItem.srt && currentSubtitleText) ? "재생 중" : "대기"}
                                </span>
                                <span className="text-[8px] text-slate-600 truncate max-w-[60px]">
                                    {currentItem.audioUrl ? "Audio ON" : "No Audio"}
                                </span>
                            </div>
                        </div>

                        <div className="h-6 w-px bg-slate-200 mx-1" />

                        <div className="flex items-center gap-1.5">
                            <Label className="text-[9px] font-medium text-slate-500 whitespace-nowrap">분절</Label>
                            <input
                                type="number"
                                className="w-10 h-7 text-xs text-center border rounded bg-slate-50 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                value={config.splitLimit || 20}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    handleConfigChange({ ...config, splitLimit: val });
                                }}
                                min={5} max={50}
                                title="한 줄 최대 글자 수"
                            />
                            <span className="text-[9px] text-slate-600">자</span>
                        </div>

                        <Button
                            size="sm"
                            className={`h-7 text-[10px] px-3 font-bold shadow-sm transition-all ml-auto ${!currentItem.srt ? 'bg-indigo-600 hover:bg-indigo-700 text-white animate-pulse' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                            onClick={handlePreview} disabled={processing}
                        >
                            {processing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1.5" />}
                            {currentItem.srt ? "재생성" : "생성"}
                        </Button>
                    </div>

                    {/* Download Actions */}
                    <div className="w-full max-w-[320px] grid grid-cols-2 gap-2 mt-2">
                        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleDownloadSRT} disabled={!currentItem.srt}>
                            <Download className="w-3 h-3 mr-1.5" /> SRT 다운로드
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleDownloadCSS} disabled={!currentItem.srt}>
                            <Layout className="w-3 h-3 mr-1.5" /> CSS (스타일+애니)
                        </Button>
                    </div>

                    {/* Hidden Audio */}
                    {currentItem.audioUrl && (
                        <audio
                            ref={audioRef}
                            src={currentItem.audioUrl}
                            onTimeUpdate={handleTimeUpdate}
                            onEnded={() => setIsPlaying(false)}
                            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                            className="hidden"
                        />
                    )}
                </div>

                {/* --- 2. Input Script --- */}
                <div className="p-3 border-b bg-white">
                    <div className="flex justify-between items-center mb-1.5">
                        <Label className="text-[10px] font-semibold text-slate-500 block">
                            {(currentIndex + 1)}. 입력 텍스트
                        </Label>

                        {pairedData.length > 1 && (
                            <div className="flex items-center gap-1 bg-slate-100 rounded px-1.5 py-0.5">
                                <button
                                    className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30"
                                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                                    disabled={currentIndex === 0}
                                >
                                    <ChevronLeft className="w-3 h-3" />
                                </button>
                                <span className="text-[10px] font-mono w-12 text-center text-slate-600">
                                    {currentIndex + 1} / {pairedData.length}
                                </span>
                                <button
                                    className="p-0.5 hover:bg-slate-200 rounded disabled:opacity-30"
                                    onClick={() => setCurrentIndex(prev => Math.min(pairedData.length - 1, prev + 1))}
                                    disabled={currentIndex === pairedData.length - 1}
                                >
                                    <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>

                    <Textarea
                        value={currentItem.text}
                        readOnly
                        className="min-h-[50px] max-h-[80px] text-xs resize-y bg-slate-50 border-slate-200 focus:ring-0 text-slate-600"
                        placeholder="이전 노드에서 텍스트가 확인되지 않습니다."
                    />
                </div>

                {/* --- 3. Config --- */}
                <div className="pb-4">
                    <SubtitleConfigPanel
                        config={config}
                        onChange={handleConfigChange}
                        compact={true}
                    />
                </div>
            </div>
        </div>
    );
};

export default StudioSubtitleNodeInspector;
