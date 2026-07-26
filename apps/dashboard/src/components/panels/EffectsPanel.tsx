import React from 'react';
import { useEditorStore } from '../../hooks/useEditorStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, ArrowRightLeft, Sparkles } from 'lucide-react';

const EffectsPanel = () => {
    const { selectedClipId, tracks, updateClip } = useEditorStore();

    const transitions = [
        { id: 'fade', label: '페이드', type: 'fade' },
        { id: 'slide', label: '슬라이드', type: 'slide' },
        { id: 'wipe', label: '와이프', type: 'wipe' },
    ];

    const filters = [
        { id: 'bw', label: '흑백', config: { saturation: 0 } },
        { id: 'vintage', label: '빈티지', config: { sepia: 0.5, contrast: 1.2 } },
        { id: 'cinematic', label: '영화', config: { contrast: 1.3, saturation: 0.8, brightness: 0.9 } },
        { id: 'bright', label: '화사하게', config: { brightness: 1.2, saturation: 1.1 } },
    ];

    const effects = [
        { id: 'shake', label: '흔들림', type: 'shake' },
        { id: 'zoom', label: '줌인', type: 'zoom' },
        { id: 'flash', label: '플래시', type: 'flash' },
    ];

    const getTrackId = (clipId: string) => {
        const track = tracks.find(t => t.clips.some(c => c.id === clipId));
        return track?.id;
    };

    const handleApplyTransition = (type: string) => {
        if (selectedClipId) {
            const trackId = getTrackId(selectedClipId);
            if (trackId) {
                updateClip(trackId, selectedClipId, {
                    transitionIn: { type, duration: 1.0 },
                    transitionOut: { type, duration: 1.0 }
                });
            }
        } else {
            alert("클립을 먼저 선택해주세요.");
        }
    };

    const handleApplyFilter = (config: any) => {
        if (selectedClipId) {
            const track = tracks.find(t => t.clips.some(c => c.id === selectedClipId));
            if (track) {
                const clip = track.clips.find(c => c.id === selectedClipId);
                if (clip) {
                    updateClip(track.id, selectedClipId, {
                        filter: { ...clip.filter, ...config }
                    });
                }
            }
        } else {
            alert("클립을 먼저 선택해주세요.");
        }
    };

    return (
        <div className="h-full flex flex-col">
            <Tabs defaultValue="transition" className="w-full flex-1 flex flex-col">
                <div className="px-4 pt-2">
                    <TabsList className="w-full grid grid-cols-3">
                        <TabsTrigger value="effect">효과</TabsTrigger>
                        <TabsTrigger value="transition">전환</TabsTrigger>
                        <TabsTrigger value="filter">필터</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="effect" className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        {effects.map(e => (
                            <button
                                key={e.id}
                                className="aspect-video rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 group"
                                onClick={() => alert(`Effect ${e.label} applied (Placeholder)`)}
                            >
                                <Sparkles className="w-6 h-6 text-slate-600 group-hover:text-blue-500" />
                                <span className="text-xs font-medium text-slate-600 group-hover:text-blue-600">{e.label}</span>
                            </button>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="transition" className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        {transitions.map(t => (
                            <button
                                key={t.id}
                                className="aspect-video rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 group"
                                onClick={() => handleApplyTransition(t.type)}
                            >
                                <ArrowRightLeft className="w-6 h-6 text-slate-600 group-hover:text-blue-500" />
                                <span className="text-xs font-medium text-slate-600 group-hover:text-blue-600">{t.label}</span>
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-slate-600 text-center mt-4">
                        선택한 클립의 앞뒤에 적용됩니다.
                    </p>
                </TabsContent>

                <TabsContent value="filter" className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        {filters.map(f => (
                            <button
                                key={f.id}
                                className="aspect-video rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 group"
                                onClick={() => handleApplyFilter(f.config)}
                            >
                                <Wand2 className="w-6 h-6 text-slate-600 group-hover:text-blue-500" />
                                <span className="text-xs font-medium text-slate-600 group-hover:text-blue-600">{f.label}</span>
                            </button>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default EffectsPanel;
