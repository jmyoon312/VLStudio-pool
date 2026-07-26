import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Video, Sparkles, Settings2, Wand2 } from 'lucide-react';

interface VideoGenInspectorProps {
    node: any;
    updateData: (data: any) => void;
}

const VideoGenInspector: React.FC<VideoGenInspectorProps> = ({ node, updateData }) => {
    const [prompt, setPrompt] = useState(node.data.prompt || '');
    const [model, setModel] = useState(node.data.model || 'runway-gen3');
    const [duration, setDuration] = useState(node.data.duration || 5);
    const [aspectRatio, setAspectRatio] = useState(node.data.aspectRatio || '16:9');
    const [quality, setQuality] = useState(node.data.quality || 'standard');
    const [fps, setFps] = useState(node.data.fps || 24);
    const [seed, setSeed] = useState(node.data.seed || -1);

    const handleSave = () => {
        updateData({
            prompt,
            model,
            duration,
            aspectRatio,
            quality,
            fps,
            seed
        });
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <Tabs defaultValue="prompt" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="prompt">프롬프트</TabsTrigger>
                        <TabsTrigger value="settings">설정</TabsTrigger>
                        <TabsTrigger value="advanced">고급</TabsTrigger>
                    </TabsList>

                    <TabsContent value="prompt" className="space-y-4 mt-4">
                        <div>
                            <Label>AI 모델</Label>
                            <Select value={model} onValueChange={setModel}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="runway-gen3">Runway Gen-3</SelectItem>
                                    <SelectItem value="pika">Pika Labs</SelectItem>
                                    <SelectItem value="stable-video">Stable Video Diffusion</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>프롬프트</Label>
                            <Textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="A serene ocean sunset with gentle waves..."
                                className="mt-2 min-h-[150px]"
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                💡 구체적이고 상세한 설명이 더 좋은 결과를 만듭니다
                            </p>
                        </div>

                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="flex items-start gap-2">
                                <Sparkles className="w-5 h-5 text-purple-600 mt-0.5" />
                                <div className="text-sm text-purple-800">
                                    <p className="font-semibold">프롬프트 팁</p>
                                    <ul className="text-xs mt-2 space-y-1 list-disc list-inside">
                                        <li>카메라 움직임 명시 (pan, zoom, dolly)</li>
                                        <li>조명 및 분위기 설명</li>
                                        <li>주요 동작 및 이벤트</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-4 mt-4">
                        <div>
                            <Label>영상 길이 (초)</Label>
                            <div className="mt-2 space-y-2">
                                <Slider
                                    value={[duration]}
                                    onValueChange={([v]) => setDuration(v)}
                                    min={3}
                                    max={10}
                                    step={1}
                                />
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>3초</span>
                                    <Badge variant="outline">{duration}초</Badge>
                                    <span>10초</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label>화면 비율</Label>
                            <Select value={aspectRatio} onValueChange={setAspectRatio}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="16:9">16:9 (가로)</SelectItem>
                                    <SelectItem value="9:16">9:16 (세로)</SelectItem>
                                    <SelectItem value="1:1">1:1 (정사각형)</SelectItem>
                                    <SelectItem value="4:3">4:3 (클래식)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>품질</Label>
                            <Select value={quality} onValueChange={setQuality}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Draft (빠름)</SelectItem>
                                    <SelectItem value="standard">Standard (권장)</SelectItem>
                                    <SelectItem value="high">High (느림)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </TabsContent>

                    <TabsContent value="advanced" className="space-y-4 mt-4">
                        <div>
                            <Label>FPS (초당 프레임)</Label>
                            <Select value={fps.toString()} onValueChange={(v) => setFps(parseInt(v))}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="24">24 FPS (영화)</SelectItem>
                                    <SelectItem value="30">30 FPS (표준)</SelectItem>
                                    <SelectItem value="60">60 FPS (고품질)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>시드 (Seed)</Label>
                            <Input
                                type="number"
                                value={seed}
                                onChange={(e) => setSeed(parseInt(e.target.value))}
                                placeholder="-1 (랜덤)"
                                className="mt-2"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                동일한 시드는 동일한 결과를 생성합니다 (-1: 랜덤)
                            </p>
                        </div>

                        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                            <div className="flex items-start gap-2">
                                <Settings2 className="w-5 h-5 text-amber-600 mt-0.5" />
                                <div className="text-sm text-amber-800">
                                    <p className="font-semibold">예상 생성 시간</p>
                                    <p className="text-xs mt-1">
                                        {duration}초 영상 • {quality} 품질 → 약 {Math.ceil(duration * 2)}분 소요
                                    </p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">
                    <Wand2 className="w-4 h-4 mr-2" />
                    저장
                </Button>
            </div>
        </div>
    );
};

export default VideoGenInspector;
