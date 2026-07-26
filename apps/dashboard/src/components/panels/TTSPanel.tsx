import React, { useState } from 'react';
import { useEditorStore } from '../../hooks/useEditorStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Settings2, Mic, Play, Loader2, Volume2, RefreshCw } from 'lucide-react';
import TTSSettingsDialog from '../TTSSettingsDialog';
import axios from 'axios';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

const TTSPanel = () => {
    const { ttsConfig, setTTSConfig, addAsset, addClip, currentTime, tracks } = useEditorStore();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [text, setText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [lastGeneratedUrl, setLastGeneratedUrl] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!text.trim()) {
            toast.error("텍스트를 입력해주세요.");
            return;
        }

        if (isGenerating) return;

        setIsGenerating(true);
        try {
            const formData = new FormData();
            formData.append('text', text);
            formData.append('engine', ttsConfig.engine || 'google');
            formData.append('language', ttsConfig.language || 'ko');
            if (ttsConfig.voice_id) formData.append('voice_id', ttsConfig.voice_id);
            if (ttsConfig.rate) formData.append('rate', ttsConfig.rate.toString());
            if (ttsConfig.pitch) formData.append('pitch', ttsConfig.pitch.toString());
            if (ttsConfig.emotion) formData.append('emotion', ttsConfig.emotion);

            // Silence Settings
            if (ttsConfig.silenceEnabled) {
                formData.append('silence_enabled', 'true');
                formData.append('silence_threshold', (ttsConfig.silenceThreshold || -40).toString());
                formData.append('min_silence_len', (ttsConfig.minSilenceLen || 300).toString());
                formData.append('keep_silence_len', (ttsConfig.keepSilenceLen || 50).toString());
            }

            const response = await axios.post('/api/tools/tts/generate', formData);

            if (response.data.status === 'success') {
                console.log("TTS Generation Response:", response.data);
                const { web_url, server_path, duration } = response.data;

                setLastGeneratedUrl(web_url);

                addAsset({
                    id: uuidv4(),
                    type: 'audio',
                    source: web_url,
                    path: server_path,
                    name: `TTS-${new Date().toLocaleTimeString()}`
                });

                // Pass null as trackId to let addClip handle smart layering (find empty track or create new)
                addClip(null, null, web_url, 'audio', currentTime, duration);

                toast.success("음성이 생성되어 타임라인에 추가되었습니다.");
            }
        } catch (error: any) {
            console.error("TTS Generation Error:", error);
            toast.error(`음성 생성에 실패했습니다: ${error.response?.data?.detail || error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const getVoiceSummary = () => {
        if (!ttsConfig.voice_id) return "기본 설정 (Edge TTS)";
        return `${ttsConfig.engine === 'kokoro' ? 'Kokoro' : 'Edge'} - ${ttsConfig.voice_id}`;
    };

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                            <Mic className="w-4 h-4" />
                        </div>
                        <span>AI 음성 생성</span>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-500">현재 설정</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-slate-200"
                            onClick={() => setIsSettingsOpen(true)}
                        >
                            <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Volume2 className="w-4 h-4 text-blue-500" />
                        <span className="truncate">{getVoiceSummary()}</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
                <div className="space-y-2 flex-1 flex flex-col">
                    <label className="text-sm font-medium text-slate-700">텍스트 입력</label>
                    <Textarea
                        placeholder="변환할 텍스트를 입력하세요..."
                        className="flex-1 resize-none min-h-[200px] text-base leading-relaxed p-4 focus:ring-blue-500"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <div className="text-xs text-right text-slate-600">
                        {text.length}자
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button
                        className="flex-1 h-12 text-base font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md transition-all active:scale-[0.98]"
                        onClick={handleGenerate}
                        disabled={isGenerating || !text.trim()}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                생성 중...
                            </>
                        ) : lastGeneratedUrl ? (
                            <>
                                <RefreshCw className="w-5 h-5 mr-2" />
                                음성 재생성하기
                            </>
                        ) : (
                            <>
                                <Play className="w-5 h-5 mr-2 fill-current" />
                                음성 생성하기
                            </>
                        )}
                    </Button>
                    {lastGeneratedUrl && (
                        <Button
                            variant="outline"
                            className="h-12 w-12 shrink-0"
                            onClick={async () => {
                                console.log("Previewing URL:", lastGeneratedUrl);
                                try {
                                    // Try fetching as blob first to verify access
                                    const res = await fetch(lastGeneratedUrl);
                                    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
                                    const blob = await res.blob();
                                    console.log("Blob fetched:", blob.type, blob.size);

                                    const blobUrl = URL.createObjectURL(blob);
                                    const audio = new Audio(blobUrl);
                                    audio.play().catch(e => toast.error(`Blob Play Error: ${e.message}`));
                                } catch (e: any) {
                                    console.error("Preview Error:", e);
                                    toast.error(`Preview Error: ${e.message}`);
                                }
                            }}
                        >
                            <Volume2 className="w-5 h-5" />
                        </Button>
                    )}
                </div>
            </div>

            <TTSSettingsDialog
                open={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                initialConfig={ttsConfig}
                onSave={(config) => {
                    setTTSConfig(config);
                }}
            />
        </div>
    );
};

export default TTSPanel;
