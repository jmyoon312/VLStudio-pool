import React, { useState } from 'react';
import { useEditorStore } from '../../hooks/useEditorStore';
import { Wand2, Upload, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { v4 as uuidv4 } from 'uuid';
import SubtitleSettingsDialog from '../SubtitleSettingsDialog';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const CaptionPanel = () => {
    const {
        captionConfig,
        setCaptionConfig,
        applyToAllCaptions,
        setApplyToAllCaptions,
        generateCaptionsFromAudio,
        tracks,
        addTrack,
        setClips
    } = useEditorStore();

    const [script, setScript] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [language, setLanguage] = useState('auto');
    const [model, setModel] = useState('base');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleAutoCaption = async () => {
        const audioTrack = tracks.find(t => t.type === 'audio' || t.type === 'video');
        let targetClip = tracks.find(t => t.type === 'audio')?.clips[0];
        if (!targetClip) {
            targetClip = tracks.find(t => t.type === 'video')?.clips[0];
        }

        if (!targetClip) {
            alert("자막을 생성할 오디오나 비디오 클립을 찾을 수 없습니다.");
            return;
        }

        setIsGenerating(true);
        try {
            await generateCaptionsFromAudio(targetClip.id, language, model, script);
        } catch (e) {
            console.error(e);
            alert("자막 생성 중 오류가 발생했습니다.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleImportSRT = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.srt';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const text = await file.text();
            const items = text.trim().split(/\n\s*\n/);
            const clips: any[] = [];

            let captionTrackId = tracks.find(t => t.type === 'caption')?.id;
            if (!captionTrackId) {
                addTrack('caption');
                setTimeout(() => {
                    const updatedTracks = useEditorStore.getState().tracks;
                    captionTrackId = updatedTracks.find(t => t.type === 'caption')?.id;
                    if (captionTrackId) {
                        parseAndAddClips(items, captionTrackId);
                    }
                }, 0);
            } else {
                parseAndAddClips(items, captionTrackId);
            }
        };
        input.click();
    };

    const parseAndAddClips = (items: string[], trackId: string) => {
        const clips: any[] = [];
        items.forEach(item => {
            const lines = item.split('\n');
            if (lines.length < 3) return;

            const timeLine = lines[1];
            const content = lines.slice(2).join('\n');
            const [startStr, endStr] = timeLine.split(' --> ');

            const parseTime = (t: string) => {
                const [h, m, s] = t.split(':');
                const [sec, ms] = s.split(',');
                return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(sec) + parseInt(ms) / 1000;
            };

            try {
                const start = parseTime(startStr);
                const end = parseTime(endStr);

                clips.push({
                    id: uuidv4(),
                    trackId: trackId,
                    type: 'text',
                    source: '',
                    name: content,
                    start: start,
                    duration: end - start,
                    trimStart: 0,
                    speed: 1.0,
                    layer: 20,
                    transform: { x: 0, y: 0, width: 0, height: 0, scale: 1, rotation: 0, opacity: 1, flipX: false, flipY: false },
                    style: {
                        fontFamily: captionConfig.font,
                        fontSize: captionConfig.fontSize,
                        color: captionConfig.textColor,
                        backgroundColor: captionConfig.useBox ? captionConfig.boxColor : 'transparent',
                        stroke: { width: captionConfig.outlineSize, color: captionConfig.outlineColor },
                        shadow: { blur: captionConfig.shadowSize, color: captionConfig.shadowColor, offset: 2 },
                        isBold: captionConfig.isBold,
                        isItalic: captionConfig.isItalic,
                    },
                    filter: { brightness: 1, contrast: 1, saturation: 1, hue: 0, blur: 0 },
                    audio: { volume: 1, muted: false, pan: 0, fadeIn: 0, fadeOut: 0 },
                    transitionIn: { type: captionConfig.animationEntrance || 'none', duration: 0.5 },
                    transitionOut: { type: captionConfig.animationExit || 'none', duration: 0.5 },
                    keyframes: []
                });
            } catch (e) {
                console.error("Failed to parse SRT line", item);
            }
        });

        if (clips.length > 0) {
            setClips(trackId, clips);
        }
    };

    return (
        <div className="h-full p-4 overflow-y-auto space-y-6">
            {/* 1. Actions */}
            <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-4">AI 자막 생성</h3>

                <div className="flex gap-2 mb-4">
                    <div className="flex-1 space-y-1">
                        <Label className="text-[10px] text-slate-500">언어 (Language)</Label>
                        <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger className="h-8 text-xs">
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
                    <div className="flex-1 space-y-1">
                        <Label className="text-[10px] text-slate-500">모델 (Model)</Label>
                        <Select value={model} onValueChange={setModel}>
                            <SelectTrigger className="h-8 text-xs">
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

                <div className="grid grid-cols-2 gap-3">
                    <Button
                        variant="outline"
                        className="h-20 flex flex-col gap-2 relative overflow-hidden"
                        onClick={handleAutoCaption}
                        disabled={isGenerating}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                                <span className="text-xs">생성 중...</span>
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-6 h-6 text-purple-500" />
                                <span className="text-xs">자동 자막 생성</span>
                            </>
                        )}
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={handleImportSRT}>
                        <Upload className="w-6 h-6 text-blue-500" />
                        <span className="text-xs">SRT 업로드</span>
                    </Button>
                </div>
            </div>

            {/* 2. Original Script */}
            <div>
                <Label className="text-xs font-semibold text-slate-500 mb-2 block">대본 입력 (선택사항)</Label>
                <Textarea
                    placeholder="정확도를 높이기 위해 대본을 입력하세요..."
                    className="h-24 text-xs resize-none"
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                />
            </div>

            {/* 3. Subtitle Settings */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-semibold text-slate-500">자막 설정</h3>
                </div>

                <div className="space-y-4">
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-2 h-12"
                        onClick={() => setIsSettingsOpen(true)}
                    >
                        <Settings className="w-4 h-4 text-slate-500" />
                        <span className="text-sm">자막 스타일 설정</span>
                    </Button>

                    <div className="flex items-center justify-between px-1">
                        <Label className="text-xs text-slate-600">전체 자막에 적용</Label>
                        <Switch
                            checked={applyToAllCaptions}
                            onCheckedChange={setApplyToAllCaptions}
                            className="scale-90"
                        />
                    </div>
                    <p className="text-[10px] text-slate-600 px-1">
                        켜져 있으면 설정 변경 시 모든 자막 클립에 스타일이 적용됩니다.
                    </p>
                </div>

                <SubtitleSettingsDialog
                    open={isSettingsOpen}
                    onOpenChange={setIsSettingsOpen}
                    initialConfig={captionConfig}
                    onSave={setCaptionConfig}
                />
            </div>
        </div>
    );
};

export default CaptionPanel;
