import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Type, Palette, Move } from 'lucide-react';

interface TextAnimInspectorProps {
    node: any;
    updateData: (data: any) => void;
}

const TextAnimInspector: React.FC<TextAnimInspectorProps> = ({ node, updateData }) => {
    const [animationType, setAnimationType] = useState(node.data.animationType || 'fade-in');
    const [duration, setDuration] = useState(node.data.duration || 1);
    const [fontFamily, setFontFamily] = useState(node.data.fontFamily || 'Pretendard');
    const [fontSize, setFontSize] = useState(node.data.fontSize || 48);
    const [fontColor, setFontColor] = useState(node.data.fontColor || '#FFFFFF');
    const [backgroundColor, setBackgroundColor] = useState(node.data.backgroundColor || '#000000');
    const [useBackground, setUseBackground] = useState(node.data.useBackground !== false);
    const [position, setPosition] = useState(node.data.position || 'center');

    const animations = [
        { id: 'fade-in', name: '페이드 인' },
        { id: 'slide-up', name: '슬라이드 업' },
        { id: 'slide-down', name: '슬라이드 다운' },
        { id: 'zoom-in', name: '줌 인' },
        { id: 'typewriter', name: '타이핑' },
        { id: 'bounce', name: '바운스' },
    ];

    const handleSave = () => {
        updateData({
            animationType,
            duration,
            fontFamily,
            fontSize,
            fontColor,
            backgroundColor,
            useBackground,
            position
        });
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                    <Label>애니메이션 유형</Label>
                    <Select value={animationType} onValueChange={setAnimationType}>
                        <SelectTrigger className="mt-2">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {animations.map((anim) => (
                                <SelectItem key={anim.id} value={anim.id}>
                                    {anim.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>지속 시간 (초)</Label>
                    <div className="mt-2 space-y-2">
                        <Slider
                            value={[duration]}
                            onValueChange={([v]) => setDuration(v)}
                            min={0.3}
                            max={3}
                            step={0.1}
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>0.3초</span>
                            <Badge variant="outline">{duration}초</Badge>
                            <span>3초</span>
                        </div>
                    </div>
                </div>

                <div>
                    <Label>폰트</Label>
                    <Select value={fontFamily} onValueChange={setFontFamily}>
                        <SelectTrigger className="mt-2">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Pretendard">Pretendard</SelectItem>
                            <SelectItem value="Noto Sans KR">Noto Sans KR</SelectItem>
                            <SelectItem value="Roboto">Roboto</SelectItem>
                            <SelectItem value="Inter">Inter</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>폰트 크기</Label>
                    <div className="mt-2 space-y-2">
                        <Slider
                            value={[fontSize]}
                            onValueChange={([v]) => setFontSize(v)}
                            min={12}
                            max={120}
                            step={4}
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>12px</span>
                            <Badge variant="outline">{fontSize}px</Badge>
                            <span>120px</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label>텍스트 색상</Label>
                        <div className="flex gap-2 mt-2">
                            <Input
                                type="color"
                                value={fontColor}
                                onChange={(e) => setFontColor(e.target.value)}
                                className="w-16 h-10 p-1"
                            />
                            <Input
                                value={fontColor}
                                onChange={(e) => setFontColor(e.target.value)}
                                className="flex-1 font-mono"
                            />
                        </div>
                    </div>
                    <div>
                        <Label>배경 색상</Label>
                        <div className="flex gap-2 mt-2">
                            <Input
                                type="color"
                                value={backgroundColor}
                                onChange={(e) => setBackgroundColor(e.target.value)}
                                className="w-16 h-10 p-1"
                                disabled={!useBackground}
                            />
                            <Input
                                value={backgroundColor}
                                onChange={(e) => setBackgroundColor(e.target.value)}
                                className="flex-1 font-mono"
                                disabled={!useBackground}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                        <p className="font-semibold text-sm">배경 사용</p>
                        <p className="text-xs text-slate-500">텍스트 뒤에 배경 추가</p>
                    </div>
                    <Switch checked={useBackground} onCheckedChange={setUseBackground} />
                </div>

                <div>
                    <Label>위치</Label>
                    <Select value={position} onValueChange={setPosition}>
                        <SelectTrigger className="mt-2">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="top">상단</SelectItem>
                            <SelectItem value="center">중앙</SelectItem>
                            <SelectItem value="bottom">하단</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                <Button onClick={handleSave} className="bg-pink-600 hover:bg-pink-700">
                    <Type className="w-4 h-4 mr-2" />
                    저장
                </Button>
            </div>
        </div>
    );
};

export default TextAnimInspector;
