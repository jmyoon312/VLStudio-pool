import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Crop, Maximize2, Grid3x3 } from 'lucide-react';

interface CropTemplateInspectorProps {
    node: any;
    updateData: (data: any) => void;
}

const CropTemplateInspector: React.FC<CropTemplateInspectorProps> = ({ node, updateData }) => {
    const [template, setTemplate] = useState(node.data.template || 'youtube-shorts');
    const [aspectRatio, setAspectRatio] = useState(node.data.aspectRatio || '9:16');
    const [position, setPosition] = useState(node.data.position || 'center');
    const [zoom, setZoom] = useState(node.data.zoom || 100);
    const [padding, setPadding] = useState(node.data.padding || 0);

    const templates = [
        { id: 'youtube-shorts', name: 'YouTube Shorts', ratio: '9:16', desc: '1080x1920' },
        { id: 'tiktok', name: 'Music', ratio: '9:16', desc: '1080x1920' },
        { id: 'instagram-reel', name: 'Camera Reel', ratio: '9:16', desc: '1080x1920' },
        { id: 'youtube-video', name: 'YouTube Video', ratio: '16:9', desc: '1920x1080' },
        { id: 'instagram-post', name: 'Camera Post', ratio: '1:1', desc: '1080x1080' },
    ];

    const handleSave = () => {
        updateData({ template, aspectRatio, position, zoom, padding });
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                    <Label>플랫폼 템플릿</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        {templates.map((t) => (
                            <Button
                                key={t.id}
                                type="button"
                                variant={template === t.id ? 'default' : 'outline'}
                                className="h-auto p-3 flex-col items-start"
                                onClick={() => {
                                    setTemplate(t.id);
                                    setAspectRatio(t.ratio);
                                }}
                            >
                                <span className="font-semibold text-sm">{t.name}</span>
                                <span className="text-xs text-slate-500">{t.desc}</span>
                            </Button>
                        ))}
                    </div>
                </div>

                <div>
                    <Label>위치</Label>
                    <Select value={position} onValueChange={setPosition}>
                        <SelectTrigger className="mt-2">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="center">중앙</SelectItem>
                            <SelectItem value="top">상단</SelectItem>
                            <SelectItem value="bottom">하단</SelectItem>
                            <SelectItem value="left">좌측</SelectItem>
                            <SelectItem value="right">우측</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>줌 (%)</Label>
                    <div className="mt-2 space-y-2">
                        <Slider
                            value={[zoom]}
                            onValueChange={([v]) => setZoom(v)}
                            min={50}
                            max={200}
                            step={5}
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>50%</span>
                            <Badge variant="outline">{zoom}%</Badge>
                            <span>200%</span>
                        </div>
                    </div>
                </div>

                <div>
                    <Label>여백 (px)</Label>
                    <div className="mt-2 space-y-2">
                        <Slider
                            value={[padding]}
                            onValueChange={([v]) => setPadding(v)}
                            min={0}
                            max={100}
                            step={5}
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>0px</span>
                            <Badge variant="outline">{padding}px</Badge>
                            <span>100px</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2">
                        <Grid3x3 className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold">미리보기</p>
                            <p className="text-xs mt-1">
                                {aspectRatio} • {position} • {zoom}% 줌
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                    <Crop className="w-4 h-4 mr-2" />
                    저장
                </Button>
            </div>
        </div>
    );
};

export default CropTemplateInspector;
