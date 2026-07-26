import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Music, Volume2, Activity } from 'lucide-react';

interface AudioMixInspectorProps {
    node: any;
    updateData: (data: any) => void;
}

const AudioMixInspector: React.FC<AudioMixInspectorProps> = ({ node, updateData }) => {
    const [bgmVolume, setBgmVolume] = useState(node.data.bgmVolume || 30);
    const [voiceVolume, setVoiceVolume] = useState(node.data.voiceVolume || 100);
    const [fadeIn, setFadeIn] = useState(node.data.fadeIn !== false);
    const [fadeOut, setFadeOut] = useState(node.data.fadeOut !== false);
    const [fadeDuration, setFadeDuration] = useState(node.data.fadeDuration || 2);
    const [normalize, setNormalize] = useState(node.data.normalize !== false);

    const handleSave = () => {
        updateData({ bgmVolume, voiceVolume, fadeIn, fadeOut, fadeDuration, normalize });
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                    <Label>배경음악 볼륨 (%)</Label>
                    <div className="mt-2 space-y-2">
                        <Slider
                            value={[bgmVolume]}
                            onValueChange={([v]) => setBgmVolume(v)}
                            min={0}
                            max={100}
                            step={5}
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>0%</span>
                            <Badge variant="outline">{bgmVolume}%</Badge>
                            <span>100%</span>
                        </div>
                    </div>
                </div>

                <div>
                    <Label>음성 볼륨 (%)</Label>
                    <div className="mt-2 space-y-2">
                        <Slider
                            value={[voiceVolume]}
                            onValueChange={([v]) => setVoiceVolume(v)}
                            min={0}
                            max={150}
                            step={5}
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>0%</span>
                            <Badge variant="outline">{voiceVolume}%</Badge>
                            <span>150%</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                        <p className="font-semibold text-sm">페이드 인</p>
                        <p className="text-xs text-slate-500">시작 시 부드럽게</p>
                    </div>
                    <Switch checked={fadeIn} onCheckedChange={setFadeIn} />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                        <p className="font-semibold text-sm">페이드 아웃</p>
                        <p className="text-xs text-slate-500">종료 시 부드럽게</p>
                    </div>
                    <Switch checked={fadeOut} onCheckedChange={setFadeOut} />
                </div>

                {(fadeIn || fadeOut) && (
                    <div>
                        <Label>페이드 지속 시간 (초)</Label>
                        <div className="mt-2 space-y-2">
                            <Slider
                                value={[fadeDuration]}
                                onValueChange={([v]) => setFadeDuration(v)}
                                min={0.5}
                                max={5}
                                step={0.5}
                            />
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>0.5초</span>
                                <Badge variant="outline">{fadeDuration}초</Badge>
                                <span>5초</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                        <p className="font-semibold text-sm">오디오 정규화</p>
                        <p className="text-xs text-slate-500">일정한 볼륨 유지</p>
                    </div>
                    <Switch checked={normalize} onCheckedChange={setNormalize} />
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2">
                        <Activity className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold">믹싱 미리보기</p>
                            <p className="text-xs mt-1">
                                BGM {bgmVolume}% • 음성 {voiceVolume}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                <Button onClick={handleSave} className="bg-orange-600 hover:bg-orange-700">
                    <Music className="w-4 h-4 mr-2" />
                    저장
                </Button>
            </div>
        </div>
    );
};

export default AudioMixInspector;
