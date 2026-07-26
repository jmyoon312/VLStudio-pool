import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Play, Download, Scissors, FileText, Wand2, Zap, Gamepad2, Mic, Coffee, MessageCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { VoicePresetList, VoicePreset } from '../components/VoicePresetList';
import { resolveFileUrl } from '@/utils/fileUrl';

interface TTSVoice {
    id: string;
    name: string;
    gender?: string;
    age_group?: string; // youth, adult, senior, unknown
    styles?: string[];
}

const getSavedDraftValue = (key: string, defaultValue: any) => {
    try {
        const saved = localStorage.getItem("vl_tts_draft");
        if (saved) {
            const data = JSON.parse(saved);
            if (data[key] !== undefined) return data[key];
        }
    } catch {}
    return defaultValue;
};

const MultiTTS = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // --- Step 1: TTS Generation ---
    const [text, setText] = useState(() => getSavedDraftValue("text", ""));
    const [engine, setEngine] = useState(() => getSavedDraftValue("engine", "supertone-local"));
    const [language, setLanguage] = useState(() => getSavedDraftValue("language", "ko"));
    const [voiceId, setVoiceId] = useState(() => getSavedDraftValue("voiceId", ""));

    // Auto-fill Imported Script
    useEffect(() => {
        if (location.state?.importedScript) {
            setText(location.state.importedScript);
            // Clear state to prevent reapplying on refresh/navigation
            window.history.replaceState({}, document.title);
            toast.success("대본이 불러와졌습니다.");
        }
    }, [location.state]);

    // Sliders: Speed (0.5 ~ 2.0), Pitch (-50 ~ 50)
    const [speed, setSpeed] = useState(() => getSavedDraftValue("speed", 1.0));
    const [pitch, setPitch] = useState(() => getSavedDraftValue("pitch", 0));

    const [emotion, setEmotion] = useState(() => getSavedDraftValue("emotion", "normal"));
    const [gender, setGender] = useState<"all" | "male" | "female">(() => getSavedDraftValue("gender", "all"));
    const [ageGroup, setAgeGroup] = useState<"all" | "youth" | "adult" | "senior">(() => getSavedDraftValue("ageGroup", "all"));

    // ElevenLabs Settings
    const [stability, setStability] = useState(() => getSavedDraftValue("stability", 0.5));
    const [similarity, setSimilarity] = useState(() => getSavedDraftValue("similarity", 0.75));
    const [styleExaggeration, setStyleExaggeration] = useState(() => getSavedDraftValue("styleExaggeration", 0.0));

    // Supertonic Local Settings
    const [noiseScale, setNoiseScale] = useState(() => getSavedDraftValue("noiseScale", 0.0));
    const [mixVoiceId, setMixVoiceId] = useState<string>(() => getSavedDraftValue("mixVoiceId", ""));
    const [mixRatio, setMixRatio] = useState(() => getSavedDraftValue("mixRatio", 0.0));
    const [showProMode, setShowProMode] = useState(() => getSavedDraftValue("showProMode", false));

    // Qwen3 Settings [NEW]
    const [qwenAge, setQwenAge] = useState(() => getSavedDraftValue("qwenAge", "default"));
    const [qwenDialect, setQwenDialect] = useState(() => getSavedDraftValue("qwenDialect", "standard"));
    const [qwenSpeed, setQwenSpeed] = useState(() => getSavedDraftValue("qwenSpeed", "normal"));
    const [qwenSeed, setQwenSeed] = useState(() => getSavedDraftValue("qwenSeed", -1));
    const [maintainTone, setMaintainTone] = useState(() => getSavedDraftValue("maintainTone", false));
    const [lastQwenSeed, setLastQwenSeed] = useState(() => getSavedDraftValue("lastQwenSeed", -1));
    const [qwenInstruction, setQwenInstruction] = useState(() => getSavedDraftValue("qwenInstruction", ""));

    const [isGenerating, setIsGenerating] = useState(false);

    const [step1Result, setStep1Result] = useState<{
        web_url: string;
        server_path: string;
    } | null>(() => getSavedDraftValue("step1Result", null));

    // --- Step 2: Silence Removal ---
    const [silenceThreshold, setSilenceThreshold] = useState(() => getSavedDraftValue("silenceThreshold", -40));
    const [minSilenceLen, setMinSilenceLen] = useState(() => getSavedDraftValue("minSilenceLen", 300));
    const [keepSilenceLen, setKeepSilenceLen] = useState(() => getSavedDraftValue("keepSilenceLen", 50));
    const [isProcessingSilence, setIsProcessingSilence] = useState(false);

    const [step2Result, setStep2Result] = useState<{
        web_url: string;
        server_path: string;
    } | null>(() => getSavedDraftValue("step2Result", null));

    // --- Step 3: SRT Extraction ---
    const [srtSource, setSrtSource] = useState<"original" | "cleaned">(() => getSavedDraftValue("srtSource", "original"));

    // Save draft state to localStorage on changes
    useEffect(() => {
        const draft = {
            text, engine, language, voiceId, speed, pitch, emotion, gender, ageGroup,
            stability, similarity, styleExaggeration, noiseScale, mixVoiceId, mixRatio,
            showProMode, qwenAge, qwenDialect, qwenSpeed, qwenSeed, maintainTone,
            lastQwenSeed, qwenInstruction, silenceThreshold, minSilenceLen, keepSilenceLen,
            srtSource, step1Result, step2Result
        };
        localStorage.setItem("vl_tts_draft", JSON.stringify(draft));
    }, [
        text, engine, language, voiceId, speed, pitch, emotion, gender, ageGroup,
        stability, similarity, styleExaggeration, noiseScale, mixVoiceId, mixRatio,
        showProMode, qwenAge, qwenDialect, qwenSpeed, qwenSeed, maintainTone,
        lastQwenSeed, qwenInstruction, silenceThreshold, minSilenceLen, keepSilenceLen,
        srtSource, step1Result, step2Result
    ]);
    const [isExtracting, setIsExtracting] = useState(false);

    // Fetch Voices
    const { data: voices } = useQuery<TTSVoice[]>({
        queryKey: ['tts-voices', engine, language],
        queryFn: async () => (await api.get(`/tools/tts/voices?engine=${engine}&language=${language}`)).data,
        enabled: !!engine
    });

    // Auto-select first voice if not set or invalid for current list
    useEffect(() => {
        if (engine === 'qwen') {
            // [FIX] Auto-select valid Qwen voice when switching to Qwen engine
            const validQwenVoices = ["sohee", "vivian", "serena", "uncle_fu", "dylan", "eric", "ryan", "aiden", "ono_anna"];
            if (!validQwenVoices.includes(voiceId)) {
                console.log("Switching to default Qwen voice: sohee");
                setVoiceId("sohee");
            }
            return;
        }

        if (voices && voices.length > 0) {
            const isValid = voices.find(v => v.id === voiceId);
            // If current voiceId is invalid (e.g. legacy ID) or empty, pick the first valid one
            if (!voiceId || !isValid) {
                console.log("Resetting voice to valid default:", voices[0].id);
                setVoiceId(voices[0].id);
            }
        } else if (voices && voices.length === 0) {
            // If voices list is empty (e.g. key error), clear selection
            setVoiceId("");
        }
    }, [voices, voiceId, engine]);

    // Auto-select "Cleaned" source when Step 2 finishes
    useEffect(() => {
        if (step2Result) {
            setSrtSource("cleaned");
        }
    }, [step2Result]);

    // Helper: Friendly Names for Kokoro
    const getFriendlyVoiceName = (v: TTSVoice) => {
        if (engine !== 'kokoro') return v.name;

        const map: Record<string, string> = {
            "af_bella": "🇺🇸 미국 여성 (Bella)",
            "af_sarah": "🇺🇸 미국 여성 (Sarah)",
            "am_adam": "🇺🇸 미국 남성 (Adam)",
            "am_michael": "🇺🇸 미국 남성 (Michael)",
            "bf_emma": "🇬🇧 영국 여성 (Emma)",
            "bf_isabella": "🇬🇧 영국 여성 (Isabella)",
            "bm_george": "🇬🇧 영국 남성 (George)",
            "bm_lewis": "🇬🇧 영국 남성 (Lewis)",
            "jf_alpha": "🇯🇵 일본 여성 (Yuki)",
            "jf_gongitsune": "🇯🇵 일본 여성 (Gongitsune)",
            "zm_yuxiao": "🇨🇳 중국 남성 (Yuxiao)",
        };
        return map[v.id] || v.name;
    };

    const handleUserPresetSelect = (preset: VoicePreset) => {
        setEngine(preset.engine);
        setLanguage(preset.language);
        setVoiceId(preset.voice_id);
        setSpeed(preset.speed);
        setPitch(preset.pitch);
    };

    // Helper: Edge TTS Presets
    // Generic Preset Applicator (Works for Google too)
    const applyPreset = (type: string) => {
        setEngine("google");
        setLanguage("ko");

        // Defaults
        let vid = "google_female";
        let sp = 1.0;
        let p = 0;

        switch (type) {
            // Shorts
            case "shorts_f": vid = "google_female_energetic"; sp = 1.25; p = 2; break;
            case "shorts_m": vid = "google_male"; sp = 1.25; p = 1; break;

            // News
            case "news_f": vid = "google_female_calm"; sp = 1.0; p = 0; break;
            case "news_m": vid = "google_male_calm"; sp = 0.95; p = -1; break;

            // Documentary
            case "docu_f": vid = "google_female_calm"; sp = 0.9; p = -1; break;
            case "docu_m": vid = "google_male_deep"; sp = 0.9; p = -2; break;

            // Conversation
            case "conv_f": vid = "google_female"; sp = 1.0; p = 0; break;
            case "conv_m": vid = "google_male"; sp = 1.0; p = 0; break;

            // Vlog
            case "vlog_f": vid = "google_female_energetic"; sp = 1.1; p = 1; break;
            case "vlog_m": vid = "google_male"; sp = 1.1; p = 1; break;

            // Legacy fallbacks
            case "emotional_f": vid = "google_female_calm"; sp = 0.9; p = 0; break;
            case "dialogue": vid = "google_female"; sp = 1.0; p = 0; break;
        }

        setVoiceId(vid);
        setSpeed(sp);
        setPitch(p);
    };

    const deleteServerFile = async (path: string) => {
        if (!path) return;
        try {
            const formData = new FormData();
            formData.append("file_path", path);
            // Axios DELETE with body requires 'data' field in config
            await api.delete("/tools/cleanup", { data: formData });
            console.log("Cleanup Success:", path);
        } catch (e) {
            console.warn("Cleanup Failed (Non-critical):", e);
        }
    };

    // Handlers
    const handleGenerateTTS = async () => {
        console.log("Generate TTS button clicked");
        if (!text.trim()) {
            toast.error("텍스트를 입력해주세요.");
            return;
        }

        // [Cleanup] Delete previous Step 1 file if exists (Retry logic)
        if (step1Result?.server_path) {
            await deleteServerFile(step1Result.server_path);
        }

        setIsGenerating(true);
        try {
            console.log(`Generating TTS: Engine=${engine}, Voice=${voiceId}, Speed=${speed}, Pitch=${pitch}`);
            const formData = new FormData();
            formData.append("text", text);
            formData.append("engine", engine);
            formData.append("language", language);
            formData.append("language", language);
            // Fallback to default voice if empty
            // [FIX] Valid Qwen Voice Enforcer
            let effectiveVoiceId = voiceId;
            if (engine === 'qwen') {
                const validQwenVoices = ["sohee", "vivian", "serena", "uncle_fu", "dylan", "eric", "ryan", "aiden", "ono_anna"];
                // If current voice is NOT in the Qwen list (e.g. "google_female"), force it to "sohee"
                if (!validQwenVoices.includes(voiceId)) {
                    console.warn(`Invalid Qwen Voice ID: ${voiceId}. Switching to default 'sohee'.`);
                    effectiveVoiceId = "sohee";
                }
            } else {
                effectiveVoiceId = voiceId || (language === 'ko' ? 'ko-KR-SunHiNeural' : 'en-US-AriaNeural');
            }
            formData.append("voice_id", effectiveVoiceId);

            // Convert Speed (0.5~2.0) to Backend Rate (-50~100)
            const rateVal = Math.round((speed - 1.0) * 100);
            formData.append("rate", rateVal.toString());
            formData.append("pitch", pitch.toString());

            if (engine === 'typecast') {
                formData.append("emotion", emotion);
            }
            if (engine === 'elevenlabs') {
                formData.append("xi_stability", stability.toString());
                formData.append("xi_similarity_boost", similarity.toString());
                formData.append("xi_style", styleExaggeration.toString());
            }
            if (engine === 'supertone-local') {
                formData.append("emotion", emotion);
                // [NEW] Advanced Params
                formData.append("noise_scale", noiseScale.toString());
                if (mixVoiceId && mixRatio > 0) {
                    formData.append("mix_voice_id", mixVoiceId);
                    formData.append("mix_ratio", mixRatio.toString());
                }
            }
            if (engine === 'qwen') {
                formData.append("emotion", emotion); // Use standard emotion field
                formData.append("qwen_age", qwenAge);
                formData.append("qwen_dialect", qwenDialect);
                formData.append("qwen_speed", qwenSpeed);

                // Seed Logic
                // If maintainTone is checked, use lastQwenSeed (if valid). Otherwise send -1.
                // We will generate the random seed on Frontend if needed to track it, OR just send -1.
                // Per plan: send -1 normally. If checked, send the *last used* seed.
                // Since we don't get the seed back from server yet, we must simulate "Last Used" by generating it here when NOT maintaining.

                let effectiveSeed = -1;
                if (!maintainTone) {
                    // Generate new random seed to track it for next time
                    effectiveSeed = Math.floor(Math.random() * 2147483647);
                    setLastQwenSeed(effectiveSeed);
                } else {
                    // Reuse old locked seed
                    effectiveSeed = lastQwenSeed !== -1 ? lastQwenSeed : -1;
                }

                formData.append("qwen_seed", effectiveSeed.toString());
                // [NEW] Manual Instruction
                formData.append("qwen_instruction", qwenInstruction);
            }

            const res = await api.post("/tools/tts/generate", formData);

            if (res.data.status === "success") {
                console.log("TTS Generation Success:", res.data);
                const rawUrl = res.data.web_url;
                const formattedUrl = resolveFileUrl(rawUrl);
                setStep1Result({
                    web_url: formattedUrl,
                    server_path: res.data.server_path
                });
                toast.success("오디오 생성 완료!");
            }
        } catch (e: any) {
            console.error("TTS Generation Failed:", e);
            const msg = e.response?.data?.detail || e.message || "알 수 없는 오류";
            toast.error(`생성 실패: ${msg}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleProcessSilence = async () => {
        if (!step1Result?.server_path) {
            toast.error("먼저 오디오를 생성해주세요.");
            return;
        }

        // [Cleanup] Delete previous Step 2 file if exists (Retry logic)
        if (step2Result?.server_path) {
            await deleteServerFile(step2Result.server_path);
        }

        setIsProcessingSilence(true);
        try {
            const options = {
                threshold: silenceThreshold,
                min_silence_len: minSilenceLen,
                keep_silence_len: keepSilenceLen
            };

            const formData = new FormData();
            formData.append("input_path", step1Result.server_path);
            formData.append("options", JSON.stringify(options));

            const res = await api.post("/tools/silence/process", formData);

            if (res.data.status === "success") {
                const rawUrl = res.data.web_url;
                const formattedUrl = resolveFileUrl(rawUrl);
                setStep2Result({
                    web_url: formattedUrl,
                    server_path: res.data.server_path
                });
                toast.success("무음 제거 완료! 다운로드가 시작됩니다.");

                // Auto Download
                try {
                    const link = document.createElement('a');
                    link.href = formattedUrl;
                    // Extract filename from URL or use default
                    const filename = formattedUrl.split('/').pop()?.split('?')[0] || 'processed_audio.mp3';
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } catch (err) {
                    console.error("Auto-download failed:", err);
                    toast.error("자동 다운로드 실패 (팝업 차단을 확인해주세요)");
                }
            }
        } catch (e: any) {
            toast.error(`처리 실패: ${e.response?.data?.detail || e.message}`);
        } finally {
            setIsProcessingSilence(false);
        }
    };

    const handleExtractSRT = async () => {
        const targetPath = srtSource === "cleaned" ? step2Result?.server_path : step1Result?.server_path;

        if (!targetPath) {
            toast.error("대상 오디오 파일이 없습니다.");
            return;
        }

        setIsExtracting(true);
        try {
            let res;

            // [OPTIMIZATION] If we have a server path, use the direct endpoint to avoid network round-trip & 404s
            if (targetPath) {
                console.log("Extracting from Server Path:", targetPath);
                res = await api.post("/tools/subtitle/extract-from-path", {
                    audio_path: targetPath,
                    language: language === 'auto' ? 'auto' : language,
                    model: "base" // or prompt user for model
                });
            } else {
                // Fallback: Download & Re-upload (Legacy/External URL case)
                const targetUrl = srtSource === "cleaned" ? step2Result?.web_url : step1Result?.web_url;
                if (!targetUrl) throw new Error("URL not found");

                const blobRes = await fetch(targetUrl);
                const blob = await blobRes.blob();
                const file = new File([blob], "audio.mp3", { type: "audio/mpeg" });

                const formData = new FormData();
                formData.append("file", file);
                formData.append("language", language === 'auto' ? 'auto' : language);

                res = await api.post("/tools/subtitle/extract", formData);
            }

            if (res.data.status === "success") {
                // [Cleanup] If we are using Step 2 (Cleaned), delete Step 1 (Raw) as it's no longer needed
                // Note: We do NOT delete the target file itself because the Editor might need it.
                if (srtSource === "cleaned" && step1Result?.server_path) {
                    await deleteServerFile(step1Result.server_path);
                }

                // Navigate to SubtitleConverter with script hand-off
                navigate("/subtitle-tool", {
                    state: {
                        srtContent: res.data.srt_content,
                        mediaUrl: srtSource === "cleaned" ? step2Result?.web_url : step1Result?.web_url,
                        serverPath: res.data.server_path, // Caution: This path must remain valid
                        originalScript: text // Pass the original script
                    }
                });
                toast.success("자막 추출 완료! 편집기로 이동합니다.");
            }
        } catch (e: any) {
            console.error(e);
            toast.error(`자막 추출 실패: ${e.response?.data?.detail || e.message}`);
        } finally {
            setIsExtracting(false);
        }
    };

    // [FIX] Robust Download Function using Blob
    const downloadFile = async (url: string, filename: string) => {
        try {
            toast.loading("다운로드 시작...");
            const safeUrl = resolveFileUrl(url);
            const response = await fetch(safeUrl);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();

            // Cleanup
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);

            toast.dismiss();
            toast.success("다운로드 완료");
        } catch (e) {
            console.error(e);
            toast.dismiss();
            toast.error("다운로드 실패. 새 탭에서 엽니다.");
            window.open(url, '_blank');
        }
    };

    // Silence Preset Applicator
    const applySilencePreset = (t: number, m: number, k: number) => {
        setSilenceThreshold(t);
        setMinSilenceLen(m);
        setKeepSilenceLen(k);
    };

    return (
        <div className="max-w-[1800px] mx-auto space-y-8 p-8 font-sans text-foreground">
            <div />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Step 1: TTS Generation (Main Stage - Wider) */}
                <Card className="lg:col-span-7 h-fit border border-border shadow-sm rounded-xl bg-card">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-3 text-xl font-bold text-foreground">
                            <span className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                            음성 생성
                        </CardTitle>
                        <CardDescription className="text-base text-muted-foreground">AI 음성을 생성합니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        <div className="space-y-2 relative">
                            <textarea
                                className="flex h-[20vh] w-full rounded-lg border border-border bg-background px-4 py-4 text-base leading-relaxed shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 resize-none font-sans pr-4 pb-8 text-foreground"
                                placeholder="여기에 텍스트를 입력하세요..."
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />
                            <div className="absolute bottom-3 right-4 text-xs font-medium text-muted-foreground pointer-events-none select-none">
                                {text.length}자
                            </div>
                        </div>

                        {/* Generic Presets (Google / Edge) */}
                        {(engine === 'google' || engine === 'edge') && (
                            <div className="space-y-4 pt-2">
                            </div>
                        )}

                        {/* Favorites (Moved Up) */}
                        <VoicePresetList
                            currentConfig={{
                                engine, language, voice_id: voiceId, speed, pitch
                            }}
                            onSelect={handleUserPresetSelect}
                        />

                        {/* Recommended Presets (Redesigned) */}
                        {engine === 'google' || engine === 'edge' ? (
                            <div className="space-y-3 pt-2">
                                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-amber-500" />
                                    추천 프리셋 (Presets)
                                </Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                    {[
                                        { id: 'shorts', icon: Zap, label: '쇼츠 (Shorts)', bg: 'bg-amber-500/10 text-amber-505' },
                                        { id: 'news', icon: Mic, label: '뉴스 (News)', bg: 'bg-blue-500/10 text-blue-505' },
                                        { id: 'docu', icon: FileText, label: '다큐 (Docu)', bg: 'bg-emerald-500/10 text-emerald-505' },
                                        { id: 'conv', icon: MessageCircle, label: '대화 (Conv)', bg: 'bg-purple-500/10 text-purple-505' },
                                        { id: 'vlog', icon: Coffee, label: '브이로그 (Vlog)', bg: 'bg-pink-500/10 text-pink-505' },
                                    ].map((cat) => (
                                        <div key={cat.id} className="flex flex-col items-center p-2.5 rounded-xl border border-border shadow-sm bg-card hover:shadow-md transition-all gap-2">
                                            <div className={`p-2 rounded-full ${cat.bg} mb-1`}>
                                                <cat.icon className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs font-bold text-foreground">{cat.label}</span>
                                            <div className="grid grid-cols-2 w-full gap-1.5">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => applyPreset(`${cat.id}_f`)}
                                                    className="h-7 text-[10px] px-0 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20"
                                                >
                                                    여성
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => applyPreset(`${cat.id}_m`)}
                                                    className="h-7 text-[10px] px-0 hover:bg-sky-500/10 hover:text-sky-500 hover:border-sky-500/20"
                                                >
                                                    남성
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}



                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-semibold text-foreground">엔진</Label>
                                <select
                                    className="w-full h-10 rounded-md border border-border bg-background text-foreground px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all outline-none"
                                    value={engine}
                                    onChange={(e) => setEngine(e.target.value)}
                                >
                                    <option value="edge" className="bg-card text-foreground">Microsoft Edge (자연스러운 무료)</option>
                                    <option value="google" className="bg-card text-foreground">Google TTS (무료/기본)</option>
                                    <option value="kokoro" className="bg-card text-foreground">Kokoro (로컬/고품질)</option>
                                    <option value="elevenlabs" className="bg-card text-foreground">ElevenLabs (유료)</option>
                                    <option value="supertone-local" className="bg-card text-foreground">Supertonic (Local)</option>
                                    <option value="typecast" className="bg-card text-foreground">Typecast (유료)</option>
                                    <option value="qwen" className="bg-card text-foreground">Qwen 2.5 (Remote)</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-semibold text-foreground">언어</Label>
                                <select
                                    className="w-full h-10 rounded-md border border-border bg-background text-foreground px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all outline-none"
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                >
                                    {engine === 'supertone-local' ? (
                                        <>
                                            <option value="ko">🇰🇷 한국어 (Korean)</option>
                                            <option value="en">🇺🇸 영어 (English)</option>
                                            <option value="ja">🇯🇵 일본어 (Japanese)</option>
                                            <option value="ar">🇸🇦 아랍어 (Arabic)</option>
                                            <option value="bg">🇧🇬 불가리아어 (Bulgarian)</option>
                                            <option value="cs">🇨🇿 체코어 (Czech)</option>
                                            <option value="da">🇩🇰 덴마크어 (Danish)</option>
                                            <option value="de">🇩🇪 독일어 (German)</option>
                                            <option value="el">🇬🇷 그리스어 (Greek)</option>
                                            <option value="es">🇪🇸 스페인어 (Spanish)</option>
                                            <option value="et">🇪🇪 에스토니아어 (Estonian)</option>
                                            <option value="fi">🇫🇮 핀란드어 (Finnish)</option>
                                            <option value="fr">🇫🇷 프랑스어 (French)</option>
                                            <option value="hi">🇮🇳 힌디어 (Hindi)</option>
                                            <option value="hr">🇭🇷 크로아티아어 (Croatian)</option>
                                            <option value="hu">🇭🇺 헝가리어 (Hungarian)</option>
                                            <option value="id">🇮🇩 인도네시아어 (Indonesian)</option>
                                            <option value="it">🇮🇹 이탈리아어 (Italian)</option>
                                            <option value="lt">🇱🇹 리투아니아어 (Lithuanian)</option>
                                            <option value="lv">🇱🇻 라트비아어 (Latvian)</option>
                                            <option value="nl">🇳🇱 네덜란드어 (Dutch)</option>
                                            <option value="pl">🇵🇱 폴란드어 (Polish)</option>
                                            <option value="pt">🇵🇹 포르투갈어 (Portuguese)</option>
                                            <option value="ro">🇷🇴 루마니아어 (Romanian)</option>
                                            <option value="ru">🇷🇺 러시아어 (Russian)</option>
                                            <option value="sk">🇸🇰 슬로바키아어 (Slovak)</option>
                                            <option value="sl">🇸🇮 슬로베니아어 (Slovenian)</option>
                                            <option value="sv">🇸🇪 스웨덴어 (Swedish)</option>
                                            <option value="tr">🇹🇷 터키어 (Turkish)</option>
                                            <option value="uk">🇺🇦 우크라이나어 (Ukrainian)</option>
                                            <option value="vi">🇻🇳 베트남어 (Vietnamese)</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="auto">자동 감지 (Auto)</option>
                                            <option value="ko">한국어</option>
                                            <option value="en">영어</option>
                                            <option value="ja">일본어</option>
                                            <option value="zh">중국어</option>
                                            <option value="es">스페인어</option>
                                            <option value="fr">프랑스어</option>
                                            <option value="de">독일어</option>
                                            <option value="ru">러시아어</option>
                                            <option value="pt">포르투갈어</option>
                                            <option value="it">이탈리아어</option>
                                        </>
                                    )}
                                </select>
                            </div>
                        </div>

                        {/* Global Gender & Age Filters */}
                        <div className="flex justify-end -mt-2 mb-2 gap-2">
                            {/* Gender Filter */}
                            <div className="flex items-center gap-2 bg-primary/5 p-1.5 rounded-lg border border-primary/20">
                                <Label className="text-xs px-2 font-medium text-primary">성별:</Label>
                                <select
                                    value={gender}
                                    onChange={(e: any) => setGender(e.target.value)}
                                    className="h-7 w-[80px] text-xs rounded-md border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                                >
                                    <option value="all" className="bg-card text-foreground">전체</option>
                                    <option value="male" className="bg-card text-foreground">남성</option>
                                    <option value="female" className="bg-card text-foreground">여성</option>
                                </select>
                            </div>

                            {/* Age Filter */}
                            <div className="flex items-center gap-2 bg-primary/5 p-1.5 rounded-lg border border-primary/20">
                                <Label className="text-xs px-2 font-medium text-primary">나이:</Label>
                                <select
                                    value={ageGroup}
                                    onChange={(e: any) => setAgeGroup(e.target.value)}
                                    className="h-7 w-[90px] text-xs rounded-md border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                                >
                                    <option value="all" className="bg-card text-foreground">전체</option>
                                    <option value="youth" className="bg-card text-foreground">청소년/아이</option>
                                    <option value="adult" className="bg-card text-foreground">청년/중년</option>
                                    <option value="senior" className="bg-card text-foreground">노년 (Senior)</option>
                                </select>
                            </div>
                        </div>

                        {/* Qwen Control Panel */}
                        {engine === 'qwen' && (
                            <div className="bg-gradient-to-br from-primary/5 to-secondary/5 dark:from-primary/10 dark:to-secondary/10 p-5 rounded-xl border border-border space-y-5 animate-in fade-in slide-in-from-top-4 mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">REMOTE</span>
                                    <Label className="text-sm font-bold text-foreground">Qwen 2.5 Studio</Label>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Voice */}
                                    <div className="space-y-1.5 ">
                                        <Label className="text-xs font-semibold text-muted-foreground">성우 (Voice)</Label>
                                        <select
                                            value={voiceId}
                                            onChange={(e) => setVoiceId(e.target.value)}
                                            className="w-full h-9 text-xs rounded border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                                        >
                                            <optgroup label="한국어 (Korean)">
                                                <option value="sohee">👩 소희 (한국어 표준/메인)</option>
                                            </optgroup>
                                            <optgroup label="중국어 (Chinese)">
                                                <option value="vivian">👩 Vivian (명랑/엣지)</option>
                                                <option value="serena">👩 Serena (따뜻함/부드러움)</option>
                                                <option value="uncle_fu">👴 Uncle Fu (중후함)</option>
                                                <option value="dylan">👦 Dylan (베이징/청년)</option>
                                                <option value="eric">🤵 Eric (쓰촨성/활기참)</option>
                                            </optgroup>
                                            <optgroup label="영어 (English)">
                                                <option value="ryan">🏃 Ryan (남성/역동적)</option>
                                                <option value="aiden">👨 Aiden (남성/차분함)</option>
                                            </optgroup>
                                            <optgroup label="일본어 (Japanese)">
                                                <option value="ono_anna">🇯🇵 Ono Anna (장난끼/가벼움)</option>
                                            </optgroup>
                                        </select>
                                    </div>

                                    {/* Age */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-gray-600">나이대 (Age)</Label>
                                        <select
                                            value={qwenAge}
                                            onChange={(e) => setQwenAge(e.target.value)}
                                            className="w-full h-9 text-xs rounded border border-indigo-200 focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            <option value="default">기본 (Default)</option>
                                            <option value="teen">🧒 10대 (Teenager)</option>
                                            <option value="young_adult">👨💼 20~30대 (Young Adult)</option>
                                            <option value="middle_aged">🧔 40~50대 (Middle Aged)</option>
                                            <option value="elderly">👴 60~70대 (Elderly)</option>
                                        </select>
                                    </div>

                                    {/* Dialect */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-gray-600">방언/사투리 (Dialect)</Label>
                                        <select
                                            value={qwenDialect}
                                            onChange={(e) => setQwenDialect(e.target.value)}
                                            className="w-full h-9 text-xs rounded border border-indigo-200 focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            <option value="standard">표준어 (Standard)</option>
                                            <option value="gyeongsang">🔥 경상도 (부산)</option>
                                            <option value="jeolla">🌾 전라도 (구수함)</option>
                                            <option value="chungcheong">🍃 충청도 (느긋함)</option>
                                            <option value="gangwon">🏔️ 강원도 (순박함)</option>
                                        </select>
                                    </div>

                                    {/* Speed Enum */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-gray-600">속도 (Speed)</Label>
                                        <select
                                            value={qwenSpeed}
                                            onChange={(e) => setQwenSpeed(e.target.value)}
                                            className="w-full h-9 text-xs rounded border border-indigo-200 focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            <option value="very_slow">0.6x (Very Slow)</option>
                                            <option value="slow">0.8x (Slow)</option>
                                            <option value="normal">1.0x (Normal)</option>
                                            <option value="fast">1.2x (Fast)</option>
                                            <option value="very_fast">1.5x (Very Fast)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Emotion Grid */}
                                <div className="space-y-2 pt-2">
                                    <Label className="text-xs font-semibold text-gray-600">감정 (Emotion)</Label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { id: 'neutral', label: '😐 평온' },
                                            { id: 'happy', label: '😄 기쁨' },
                                            { id: 'sad', label: '😢 슬픔' },
                                            { id: 'angry', label: '😡 화남' },
                                            { id: 'surprised', label: '😲 놀람' },
                                            { id: 'whisper', label: '🤫 속삭임' },
                                            { id: 'serious', label: '📰 진지' },
                                            { id: 'affectionate', label: '🥰 다정' },
                                            { id: 'dynamic', label: '⚡ 광고' },
                                            { id: 'fearful', label: '😨 공포' },
                                            { id: 'sleepy', label: '😴 졸림' },
                                        ].map((emo) => (
                                            <Button
                                                key={emo.id}
                                                variant={emotion === emo.id ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setEmotion(emo.id)}
                                                className={cn(
                                                    "h-8 text-[10px] sm:text-xs border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700",
                                                    emotion === emo.id && "bg-indigo-600 hover:bg-indigo-700 border-indigo-600 text-white"
                                                )}
                                            >
                                                {emo.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {/* Seed Control */}
                                <div className="flex items-center gap-2 pt-2 border-t border-border">
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id="maintainTone"
                                            checked={maintainTone}
                                            onChange={(e) => setMaintainTone(e.target.checked)}
                                            className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary/20"
                                        />
                                        <label
                                            htmlFor="maintainTone"
                                            className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground"
                                        >
                                            방금 그 목소리 톤 유지하기 (Seed 고정)
                                        </label>
                                    </div>
                                    {maintainTone && (
                                        <span className="text-[10px] text-primary font-mono ml-auto">
                                            Locked: {lastQwenSeed !== -1 ? lastQwenSeed : "Next Gen"}
                                        </span>
                                    )}
                                </div>

                                {/* Voice Design / Instruction Input */}
                                <div className="space-y-2 pt-2 border-t border-border">
                                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                        ✨ 보이스 디자인 / 추가 지시어 (Optional)
                                        <span className="text-[9px] text-muted-foreground font-normal ml-1">
                                            (예: "울면서 말해줘", "속삭이듯이", "Speak with hesitation")
                                        </span>
                                    </Label>
                                    <input
                                        type="text"
                                        value={qwenInstruction}
                                        onChange={(e) => setQwenInstruction(e.target.value)}
                                        placeholder="AI에게 세부 연기 지시를 내려보세요..."
                                        className="w-full h-8 text-xs rounded border border-border bg-background text-foreground px-2 focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
                                    />
                                </div>
                            </div>
                        )}

                        {engine !== 'qwen' && (
                            <>
                                <div className="space-y-1.5">
                                    <Label className="text-sm font-semibold text-foreground">목소리</Label>
                                    <select
                                        className="w-full h-10 rounded-md border border-border bg-background text-foreground px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all outline-none"
                                        value={voiceId || ""}
                                        onChange={(e) => setVoiceId(e.target.value)}
                                    >
                                        {voices?.filter(v => {
                                            // 1. Gender Filter
                                            if (gender !== 'all' && v.gender && v.gender !== 'unknown') {
                                                if (v.gender !== gender) return false;
                                            }
                                            // 2. Age Filter
                                            if (ageGroup !== 'all' && v.age_group && v.age_group !== 'unknown') {
                                                if (v.age_group !== ageGroup) return false;
                                            }
                                            return true;
                                        }).map(v => (
                                            <option key={v.id} value={v.id} className="bg-card text-foreground">{getFriendlyVoiceName(v)}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-6 pt-4 bg-muted/50 p-5 rounded-xl border border-border">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-sm font-semibold text-foreground">속도 (Speed)</Label>
                                            <span className="text-sm font-mono text-primary font-medium">x{speed.toFixed(1)}</span>
                                        </div>
                                        <Slider
                                            value={[speed]}
                                            min={0.5} max={2.0} step={0.1}
                                            onValueChange={(v) => setSpeed(v[0])}
                                            className="py-2"
                                        />
                                    </div>

                                    {engine === 'typecast' ? (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-sm font-semibold text-foreground">감정 (Emotion)</Label>
                                                <span className="text-sm font-mono text-primary font-medium">
                                                    {emotion}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button variant={emotion === "normal" ? "default" : "outline"} size="sm" onClick={() => setEmotion("normal")} className="h-8 text-xs">Normal 😐</Button>
                                                <Button variant={emotion === "happy" ? "default" : "outline"} size="sm" onClick={() => setEmotion("happy")} className="h-8 text-xs">Happy 😄</Button>
                                                <Button variant={emotion === "sad" ? "default" : "outline"} size="sm" onClick={() => setEmotion("sad")} className="h-8 text-xs">Sad 😢</Button>
                                                <Button variant={emotion === "angry" ? "default" : "outline"} size="sm" onClick={() => setEmotion("angry")} className="h-8 text-xs">Angry 😡</Button>
                                            </div>
                                        </div>
                                    ) : (engine === 'supertone-local') ? (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center mb-1">
                                                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                                    🎭 감정 & 스타일 (Emotion Engine)
                                                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">NEW</span>
                                                </Label>
                                                <Button variant="ghost" size="sm" onClick={() => setShowProMode(!showProMode)} className="h-6 text-[10px] text-muted-foreground hover:text-foreground">
                                                    {showProMode ? "간편 모드" : "고급 설정 (Pro)"}
                                                </Button>
                                            </div>

                                            {/* 1. Emotion Presets */}
                                            <div className="grid grid-cols-4 gap-2">
                                                <Button
                                                    variant={emotion === "normal" ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => { setEmotion("normal"); setNoiseScale(0.0); setPitch(0); }}
                                                    className={cn("h-9 text-xs flex flex-col items-center justify-center gap-0.5", emotion === "normal" && "ring-2 ring-primary ring-offset-1")}
                                                >
                                                    <span>😐</span> 기본
                                                </Button>
                                                <Button
                                                    variant={emotion === "happy" ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => { setEmotion("happy"); setNoiseScale(0.0); setPitch(0); }}
                                                    className={cn("h-9 text-xs flex flex-col items-center justify-center gap-0.5 hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/20", emotion === "happy" && "bg-amber-500 hover:bg-amber-600 border-amber-600 text-white")}
                                                >
                                                    <span>😄</span> 기쁨
                                                </Button>
                                                <Button
                                                    variant={emotion === "sad" ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => { setEmotion("sad"); setNoiseScale(0.0); setPitch(0); }}
                                                    className={cn("h-9 text-xs flex flex-col items-center justify-center gap-0.5 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/20", emotion === "sad" && "bg-blue-500 hover:bg-blue-600 border-blue-600 text-white")}
                                                >
                                                    <span>😢</span> 슬픔
                                                </Button>
                                                <Button
                                                    variant={emotion === "angry" ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => { setEmotion("angry"); setNoiseScale(0.0); setPitch(0); }}
                                                    className={cn("h-9 text-xs flex flex-col items-center justify-center gap-0.5 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20", emotion === "angry" && "bg-rose-500 hover:bg-rose-600 border-rose-600 text-white")}
                                                >
                                                    <span>😡</span> 분노
                                                </Button>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground text-center">
                                                * 감정 프리셋은 속도, 톤, 떨림(Noise)을 자동으로 조절합니다.
                                            </p>

                                            {/* 2. Pro Mode (Manual Overrides) */}
                                            {showProMode && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 border-t border-border mt-2 pt-2">
                                                    {/* Pitch (Decoupled) */}
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium">톤 높낮이 (Pitch)</span>
                                                            <span className="font-mono text-primary">{pitch > 0 ? `+${pitch}` : pitch} ST</span>
                                                        </div>
                                                        <Slider value={[pitch]} min={-12} max={12} step={1} onValueChange={v => setPitch(v[0])} />
                                                    </div>

                                                    {/* Noise Scale (Latent) */}
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium">목소리 질감 (Noise / Variance)</span>
                                                            <span className="font-mono text-primary">{noiseScale.toFixed(2)}</span>
                                                        </div>
                                                        <Slider value={[noiseScale]} min={0.0} max={2.0} step={0.1} onValueChange={v => setNoiseScale(v[0])} />
                                                        <p className="text-[10px] text-muted-foreground">값이 높을수록 목소리가 거칠고 예측 불가능해집니다 (감정 표현용).</p>
                                                    </div>

                                                    {/* Voice Mixing */}
                                                    <div className="space-y-2 p-3 bg-card rounded-lg border border-border shadow-sm">
                                                        <Label className="text-xs font-semibold text-foreground block mb-2">🧬 목소리 섞기 (Voice Mixing)</Label>
                                                        <div className="flex gap-2">
                                                            <select
                                                                className="flex-1 h-8 text-xs rounded border border-border bg-background text-foreground outline-none"
                                                                value={mixVoiceId}
                                                                onChange={(e) => setMixVoiceId(e.target.value)}
                                                            >
                                                                <option value="" className="bg-card text-foreground">섞을 목소리 선택...</option>
                                                                {voices?.filter(v => v.id !== voiceId).map(v => (
                                                                    <option key={v.id} value={v.id} className="bg-card text-foreground">{getFriendlyVoiceName(v)}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        {mixVoiceId && (
                                                            <div className="pt-2">
                                                                <div className="flex justify-between text-xs mb-1">
                                                                    <span className="text-muted-foreground">Main</span>
                                                                    <span className="text-primary font-bold">{Math.round(mixRatio * 100)}% Mix</span>
                                                                    <span className="text-muted-foreground">Mix</span>
                                                                </div>
                                                                <Slider value={[mixRatio]} min={0.0} max={1.0} step={0.05} onValueChange={v => setMixRatio(v[0])} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : engine === 'elevenlabs' ? (

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center mb-1">
                                                <Label className="text-sm font-semibold text-foreground">세부 설정 (Voice Settings)</Label>
                                            </div>

                                            {/* Presets */}
                                            <div className="flex gap-2 mb-2">
                                                <Button variant="outline" size="sm" onClick={() => { setStability(0.35); setSimilarity(0.8); setStyleExaggeration(0.55); }} className="flex-1 h-7 text-xs">🦄 생동감</Button>
                                                <Button variant="outline" size="sm" onClick={() => { setStability(0.85); setSimilarity(0.75); setStyleExaggeration(0.0); }} className="flex-1 h-7 text-xs">🧘 차분함</Button>
                                                <Button variant="outline" size="sm" onClick={() => { setStability(0.5); setSimilarity(0.75); setStyleExaggeration(0.0); }} className="flex-1 h-7 text-xs">⚙️ 기본</Button>
                                            </div>

                                            {/* Stability */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">불안정 (감정적)</span>
                                                    <span className="font-mono text-primary">{Math.round(stability * 100)}%</span>
                                                    <span className="text-muted-foreground">안정적</span>
                                                </div>
                                                <Slider value={[stability]} min={0.0} max={1.0} step={0.05} onValueChange={v => setStability(v[0])} />
                                            </div>

                                            {/* Similarity */}
                                            {/* <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                          <span className="text-muted-foreground">Clarify</span>
                                          <span className="font-mono text-primary">{Math.round(similarity * 100)}%</span>
                                        </div>
                                        <Slider value={[similarity]} min={0.0} max={1.0} step={0.05} onValueChange={v => setSimilarity(v[0])} />
                                     </div> */}

                                            {/* Style */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">스타일 강도</span>
                                                    <span className="font-mono text-primary">{Math.round(styleExaggeration * 100)}%</span>
                                                </div>
                                                <Slider value={[styleExaggeration]} min={0.0} max={1.0} step={0.05} onValueChange={v => setStyleExaggeration(v[0])} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-sm font-semibold text-foreground">높낮이 (Pitch)</Label>
                                                <span className="text-sm font-mono text-primary font-medium">{pitch > 0 ? `+${pitch}` : pitch}Hz</span>
                                            </div>
                                            <Slider
                                                value={[pitch]}
                                                min={-50} max={50} step={1}
                                                onValueChange={(v) => setPitch(v[0])}
                                                className="py-2"
                                            />
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        <Button
                            className="w-full h-12 text-lg font-bold shadow-sm bg-primary hover:bg-primary/90 transition-all active:scale-[0.99]"
                            onClick={handleGenerateTTS}
                            disabled={isGenerating || !text}
                        >
                            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                            ▶ 음성 생성 시작
                        </Button>

                        {
                            step1Result && (
                                <div className="mt-6 p-5 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-base font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                            생성 완료
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 bg-card hover:bg-accent text-foreground border-border font-medium"
                                            onClick={() => downloadFile(step1Result.web_url, `tts_output_${Date.now()}.mp3`)}
                                        >
                                            <Download className="w-4 h-4 mr-2" /> 다운로드
                                        </Button>
                                    </div>
                                    <audio controls src={step1Result.web_url} className="w-full h-12 rounded-lg shadow-sm" />
                                </div>
                            )
                        }
                    </CardContent >
                </Card >

                {/* Step 2 & 3 Container (Sidebar - Narrower) */}
                < div className="lg:col-span-5 space-y-6" >

                    {/* Step 2: Silence Removal */}
                    < Card className={cn("transition-all duration-300 border border-border shadow-sm rounded-xl bg-card", !step1Result && "opacity-50 grayscale pointer-events-none")}>
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
                                <span className="bg-orange-500/10 text-orange-500 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                                무음 제거 (선택)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Compact Presets */}
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => applySilencePreset(-35, 200, 10)} className={cn("h-8 px-3 text-xs font-medium transition-all", silenceThreshold === -35 && minSilenceLen === 200 && "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30 ring-1 ring-orange-500/20")}>
                                    <Zap className="w-3 h-3 mr-1.5" /> 스피드
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => applySilencePreset(-40, 300, 50)} className={cn("h-8 px-3 text-xs font-medium transition-all", silenceThreshold === -40 && minSilenceLen === 300 && "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30 ring-1 ring-orange-500/20")}>
                                    <Gamepad2 className="w-3 h-3 mr-1.5" /> 게임
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => applySilencePreset(-45, 500, 150)} className={cn("h-8 px-3 text-xs font-medium transition-all", silenceThreshold === -45 && minSilenceLen === 500 && "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30 ring-1 ring-orange-500/20")}>
                                    <Mic className="w-3 h-3 mr-1.5" /> 뉴스
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => applySilencePreset(-50, 800, 300)} className={cn("h-8 px-3 text-xs font-medium transition-all", silenceThreshold === -50 && minSilenceLen === 800 && "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30 ring-1 ring-orange-500/20")}>
                                    <Coffee className="w-3 h-3 mr-1.5" /> 감성
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => applySilencePreset(-45, 400, 200)} className={cn("h-8 px-3 text-xs font-medium transition-all", silenceThreshold === -45 && minSilenceLen === 400 && "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30 ring-1 ring-orange-500/20")}>
                                    <MessageCircle className="w-3 h-3 mr-1.5" /> 대화
                                </Button>
                            </div>

                            <div className="space-y-5 bg-muted/50 p-5 rounded-xl border border-border">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-xs font-semibold text-muted-foreground">감지 임계값</Label>
                                        <span className="text-xs font-mono text-muted-foreground">{silenceThreshold}dB</span>
                                    </div>
                                    <Slider value={[silenceThreshold]} min={-60} max={-10} step={1} onValueChange={(v) => setSilenceThreshold(v[0])} />
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-xs font-semibold text-muted-foreground">최소 무음 길이</Label>
                                        <span className="text-xs font-mono text-muted-foreground">{minSilenceLen}ms</span>
                                    </div>
                                    <Slider value={[minSilenceLen]} min={100} max={2000} step={50} onValueChange={(v) => setMinSilenceLen(v[0])} />
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-xs font-semibold text-muted-foreground">남길 무음 길이</Label>
                                        <span className="text-xs font-mono text-muted-foreground">{keepSilenceLen}ms</span>
                                    </div>
                                    <Slider value={[keepSilenceLen]} min={0} max={500} step={10} onValueChange={(v) => setKeepSilenceLen(v[0])} />
                                </div>
                            </div>

                            <Button
                                onClick={handleProcessSilence}
                                disabled={isProcessingSilence || !step1Result}
                                className="w-full h-10 font-medium text-foreground bg-secondary hover:bg-secondary/80 border border-border"
                                variant="secondary"
                            >
                                {isProcessingSilence ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Scissors className="w-4 h-4 mr-2" />}
                                무음 제거 실행
                            </Button>

                            {step2Result && (
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-3 animate-in fade-in zoom-in-95">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            처리 완료
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 font-medium"
                                            onClick={() => downloadFile(step2Result.web_url, `tts_silence_removed_${Date.now()}.mp3`)}
                                        >
                                            <Download className="w-3 h-3 mr-1" /> 다운로드
                                        </Button>
                                    </div>
                                    <audio controls src={step2Result.web_url} className="w-full h-10 rounded-lg shadow-sm" />
                                </div>
                            )}
                        </CardContent>
                    </Card >

                    {/* Step 3: SRT Extraction */}
                    < Card className={cn("transition-all duration-300 border border-border shadow-sm rounded-xl bg-card", !step1Result && "opacity-50 grayscale pointer-events-none")}>
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-3 text-lg font-bold text-foreground">
                                <span className="bg-purple-500/10 text-purple-500 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                                자막 추출 (편집 이동)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-3">
                                <Label className="text-sm font-semibold text-foreground">추출 대상 소스</Label>
                                <RadioGroup value={srtSource} onValueChange={(v) => setSrtSource(v as any)} className="flex flex-col gap-2">
                                    <div className="flex items-center space-x-3 bg-muted p-3 rounded-lg hover:bg-accent transition-colors border border-border cursor-pointer">
                                        <RadioGroupItem value="original" id="r1" />
                                        <Label htmlFor="r1" className="cursor-pointer text-sm font-medium flex-1 text-foreground">원본 오디오 (Step 1)</Label>
                                    </div>
                                    <div className="flex items-center space-x-3 bg-muted p-3 rounded-lg hover:bg-accent transition-colors border border-border cursor-pointer">
                                        <RadioGroupItem value="cleaned" id="r2" disabled={!step2Result} />
                                        <Label htmlFor="r2" className={cn("cursor-pointer text-sm font-medium flex-1 text-foreground", !step2Result && "text-muted-foreground")}>
                                            무음 제거된 오디오 (Step 2)
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <Button
                                onClick={handleExtractSRT}
                                disabled={isExtracting || (!step1Result && !step2Result)}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-sm h-12 text-base font-bold transition-all active:scale-[0.99]"
                            >
                                {isExtracting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <FileText className="w-5 h-5 mr-2" />}
                                3. 자막 추출 및 편집 (이동)
                            </Button>
                        </CardContent>
                    </Card >
                </div >
            </div >
        </div >
    );
};

export default MultiTTS;
