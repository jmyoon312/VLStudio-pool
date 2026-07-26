import React, { useState } from 'react';
import { useEditorStore, TrackType } from '../../hooks/useEditorStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Play, Plus, Volume2, Upload, Zap } from 'lucide-react';
import TTSSettingsDialog from '../TTSSettingsDialog';

const AudioPanel = () => {
    const { addClip, setTTSConfig } = useEditorStore();
    const [isTTSOpen, setIsTTSOpen] = useState(false);

    const mockMusic = [
        { id: 'm1', name: 'Upbeat Pop', duration: '2:30', url: '/assets/audio/upbeat.mp3' },
        { id: 'm2', name: 'Chill Lo-Fi', duration: '3:45', url: '/assets/audio/lofi.mp3' },
        { id: 'm3', name: 'Cinematic Build', duration: '1:20', url: '/assets/audio/cinematic.mp3' },
    ];

    const mockSFX = [
        { id: 's1', name: 'Whoosh', duration: '0:02', url: '/assets/sfx/whoosh.mp3' },
        { id: 's2', name: 'Pop', duration: '0:01', url: '/assets/sfx/pop.mp3' },
        { id: 's3', name: 'Impact', duration: '0:03', url: '/assets/sfx/impact.mp3' },
    ];

    return (
        <div className="h-full flex flex-col">
            <Tabs defaultValue="music" className="w-full flex-1 flex flex-col">
                <div className="px-4 pt-2">
                    <TabsList className="w-full grid grid-cols-3">
                        <TabsTrigger value="music">음악</TabsTrigger>
                        <TabsTrigger value="sfx">효과음</TabsTrigger>
                        <TabsTrigger value="tts">TTS</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="music" className="flex-1 overflow-y-auto p-4 space-y-2">
                    <Button variant="outline" className="w-full mb-4 gap-2" onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'audio/*';
                        input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                                const url = URL.createObjectURL(file);
                                addClip('audio-1', file, url, 'audio');
                            }
                        };
                        input.click();
                    }}>
                        <Upload className="w-4 h-4" /> Import Audio
                    </Button>
                    {mockMusic.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-emerald-100 flex items-center justify-center text-emerald-600">
                                    <Play className="w-4 h-4 fill-current" />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-slate-700">{item.name}</div>
                                    <div className="text-xs text-slate-600">{item.duration}</div>
                                </div>
                            </div>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => addClip('audio-1', null, item.url, 'audio' as TrackType)}
                            >
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </TabsContent>

                <TabsContent value="sfx" className="flex-1 overflow-y-auto p-4 space-y-2">
                    {mockSFX.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-purple-100 flex items-center justify-center text-purple-600">
                                    <Zap className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-slate-700">{item.name}</div>
                                    <div className="text-xs text-slate-600">{item.duration}</div>
                                </div>
                            </div>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => addClip('audio-1', null, item.url, 'audio' as TrackType)}
                            >
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </TabsContent>

                <TabsContent value="tts" className="flex-1 p-4">
                    <div className="flex flex-col h-full items-center justify-center text-center space-y-4">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-2">
                            <Volume2 className="w-8 h-8 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="font-medium text-slate-800">AI 음성 생성</h3>
                            <p className="text-sm text-slate-500 mt-1">텍스트를 입력하여 자연스러운 음성을 생성하세요.</p>
                        </div>
                        <Button onClick={() => setIsTTSOpen(true)} className="w-full">
                            TTS 설정 열기
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>

            <TTSSettingsDialog
                open={isTTSOpen}
                onOpenChange={setIsTTSOpen}
                onSave={(config) => {
                    setTTSConfig(config);
                    setIsTTSOpen(false);
                }}
            />
        </div>
    );
};

export default AudioPanel;
