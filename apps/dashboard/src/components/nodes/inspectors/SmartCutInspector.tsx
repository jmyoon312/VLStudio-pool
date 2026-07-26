import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Scissors, Zap, Brain, TrendingUp } from 'lucide-react';

interface SmartCutInspectorProps {
    node: any;
    updateData: (data: any) => void;
}

const SmartCutInspector: React.FC<SmartCutInspectorProps> = ({ node, updateData }) => {
    const [cutStyle, setCutStyle] = useState(node.data.cutStyle || 'dynamic');
    const [targetDuration, setTargetDuration] = useState(node.data.targetDuration || 60);
    const [minClipLength, setMinClipLength] = useState(node.data.minClipLength || 2);
    const [maxClipLength, setMaxClipLength] = useState(node.data.maxClipLength || 8);
    const [detectSilence, setDetectSilence] = useState(node.data.detectSilence !== false);
    const [detectSceneChange, setDetectSceneChange] = useState(node.data.detectSceneChange !== false);
    const [keepBestMoments, setKeepBestMoments] = useState(node.data.keepBestMoments !== false);
    const [transitionType, setTransitionType] = useState(node.data.transitionType || 'cut');

    const handleSave = () => {
        updateData({
            cutStyle,
            targetDuration,
            minClipLength,
            maxClipLength,
            detectSilence,
            detectSceneChange,
            keepBestMoments,
            transitionType
        });
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <Tabs defaultValue="style" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="style">스타일</TabsTrigger>
                        <TabsTrigger value="detection">감지</TabsTrigger>
                        <TabsTrigger value="timing">타이밍</TabsTrigger>
                    </TabsList>

                    <TabsContent value="style" className="space-y-4 mt-4">
                        <div>
                            <Label>편집 스타일</Label>
                            <Select value={cutStyle} onValueChange={setCutStyle}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="dynamic">다이나믹 (빠른 전환)</SelectItem>
                                    <SelectItem value="smooth">부드러움 (느린 전환)</SelectItem>
                                    <SelectItem value="rhythmic">리드미컬 (음악 기반)</SelectItem>
                                    <SelectItem value="cinematic">시네마틱 (영화 스타일)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>전환 효과</Label>
                            <Select value={transitionType} onValueChange={setTransitionType}>
                                <SelectTrigger className="mt-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cut">컷 (즉시)</SelectItem>
                                    <SelectItem value="fade">페이드</SelectItem>
                                    <SelectItem value="dissolve">디졸브</SelectItem>
                                    <SelectItem value="wipe">와이프</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-start gap-2">
                                <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-semibold">스타일 가이드</p>
                                    <ul className="text-xs mt-2 space-y-1">
                                        <li><strong>다이나믹:</strong> 숏폼, 틱톡 스타일</li>
                                        <li><strong>부드러움:</strong> 브이로그, 튜토리얼</li>
                                        <li><strong>리드미컬:</strong> 뮤직비디오, 댄스</li>
                                        <li><strong>시네마틱:</strong> 영화, 다큐멘터리</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="detection" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                                <p className="font-semibold text-sm">무음 구간 감지</p>
                                <p className="text-xs text-slate-500">조용한 부분 자동 제거</p>
                            </div>
                            <Switch checked={detectSilence} onCheckedChange={setDetectSilence} />
                        </div>

                        <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                                <p className="font-semibold text-sm">장면 전환 감지</p>
                                <p className="text-xs text-slate-500">장면 변화 시 자동 컷</p>
                            </div>
                            <Switch checked={detectSceneChange} onCheckedChange={setDetectSceneChange} />
                        </div>

                        <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                                <p className="font-semibold text-sm">하이라이트 유지</p>
                                <p className="text-xs text-slate-500">중요한 순간 우선 보존</p>
                            </div>
                            <Switch checked={keepBestMoments} onCheckedChange={setKeepBestMoments} />
                        </div>

                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="flex items-start gap-2">
                                <Brain className="w-5 h-5 text-purple-600 mt-0.5" />
                                <div className="text-sm text-purple-800">
                                    <p className="font-semibold">AI 분석</p>
                                    <p className="text-xs mt-1">
                                        영상을 분석하여 최적의 컷 지점을 자동으로 찾습니다
                                    </p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="timing" className="space-y-4 mt-4">
                        <div>
                            <Label>목표 길이 (초)</Label>
                            <div className="mt-2 space-y-2">
                                <Slider
                                    value={[targetDuration]}
                                    onValueChange={([v]) => setTargetDuration(v)}
                                    min={15}
                                    max={180}
                                    step={5}
                                />
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>15초</span>
                                    <Badge variant="outline">{targetDuration}초</Badge>
                                    <span>3분</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label>최소 클립 길이 (초)</Label>
                            <div className="mt-2 space-y-2">
                                <Slider
                                    value={[minClipLength]}
                                    onValueChange={([v]) => setMinClipLength(v)}
                                    min={0.5}
                                    max={5}
                                    step={0.5}
                                />
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>0.5초</span>
                                    <Badge variant="outline">{minClipLength}초</Badge>
                                    <span>5초</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label>최대 클립 길이 (초)</Label>
                            <div className="mt-2 space-y-2">
                                <Slider
                                    value={[maxClipLength]}
                                    onValueChange={([v]) => setMaxClipLength(v)}
                                    min={3}
                                    max={15}
                                    step={1}
                                />
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span>3초</span>
                                    <Badge variant="outline">{maxClipLength}초</Badge>
                                    <span>15초</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-start gap-2">
                                <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
                                <div className="text-sm text-green-800">
                                    <p className="font-semibold">예상 결과</p>
                                    <p className="text-xs mt-1">
                                        약 {Math.ceil(targetDuration / ((minClipLength + maxClipLength) / 2))}개의 클립으로 구성
                                    </p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                    <Scissors className="w-4 h-4 mr-2" />
                    저장
                </Button>
            </div>
        </div>
    );
};

export default SmartCutInspector;
