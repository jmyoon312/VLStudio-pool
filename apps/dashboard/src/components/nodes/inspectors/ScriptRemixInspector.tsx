import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Wand2, Sparkles, RefreshCw } from 'lucide-react';

interface ScriptRemixInspectorProps {
    node: any;
    updateData: (data: any) => void;
}

const ScriptRemixInspector: React.FC<ScriptRemixInspectorProps> = ({ node, updateData }) => {
    const [remixStyle, setRemixStyle] = useState(node.data.remixStyle || 'casual');
    const [creativity, setCreativity] = useState(node.data.creativity || 70);
    const [targetLength, setTargetLength] = useState(node.data.targetLength || 'same');
    const [tone, setTone] = useState(node.data.tone || 'friendly');
    const [customInstructions, setCustomInstructions] = useState(node.data.customInstructions || '');

    const handleSave = () => {
        updateData({ remixStyle, creativity, targetLength, tone, customInstructions });
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                    <Label>리믹스 스타일</Label>
                    <Select value={remixStyle} onValueChange={setRemixStyle}>
                        <SelectTrigger className="mt-2">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="casual">캐주얼 (일상적)</SelectItem>
                            <SelectItem value="professional">전문적</SelectItem>
                            <SelectItem value="humorous">유머러스</SelectItem>
                            <SelectItem value="dramatic">드라마틱</SelectItem>
                            <SelectItem value="educational">교육적</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>톤</Label>
                    <Select value={tone} onValueChange={setTone}>
                        <SelectTrigger className="mt-2">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="friendly">친근함</SelectItem>
                            <SelectItem value="formal">격식 있음</SelectItem>
                            <SelectItem value="enthusiastic">열정적</SelectItem>
                            <SelectItem value="calm">차분함</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>창의성 수준</Label>
                    <div className="mt-2 space-y-2">
                        <Slider
                            value={[creativity]}
                            onValueChange={([v]) => setCreativity(v)}
                            min={0}
                            max={100}
                            step={10}
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>보수적</span>
                            <Badge variant="outline">{creativity}%</Badge>
                            <span>창의적</span>
                        </div>
                    </div>
                </div>

                <div>
                    <Label>목표 길이</Label>
                    <Select value={targetLength} onValueChange={setTargetLength}>
                        <SelectTrigger className="mt-2">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="shorter">더 짧게 (50%)</SelectItem>
                            <SelectItem value="same">동일 (100%)</SelectItem>
                            <SelectItem value="longer">더 길게 (150%)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>추가 지시사항 (선택)</Label>
                    <Textarea
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder="특정 키워드 포함, 특정 표현 제외 등..."
                        className="mt-2 min-h-[100px]"
                    />
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-start gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600 mt-0.5" />
                        <div className="text-sm text-purple-800">
                            <p className="font-semibold">AI 리믹스</p>
                            <p className="text-xs mt-1">
                                원본 스크립트의 핵심 메시지를 유지하면서 새로운 표현으로 재작성합니다
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    저장
                </Button>
            </div>
        </div>
    );
};

export default ScriptRemixInspector;
