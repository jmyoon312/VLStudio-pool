import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Cpu, Zap, Settings2 } from 'lucide-react';

interface WorkerInspectorProps {
    node: any;
    updateData: (data: any) => void;
}

const WorkerInspector: React.FC<WorkerInspectorProps> = ({ node, updateData }) => {
    const [workerType, setWorkerType] = useState(node.data.workerType || 'video-processing');
    const [priority, setPriority] = useState(node.data.priority || 5);
    const [maxRetries, setMaxRetries] = useState(node.data.maxRetries || 3);
    const [timeout, setTimeout] = useState(node.data.timeout || 300);

    const workerTypes = [
        { id: 'video-processing', name: '영상 처리', desc: '인코딩, 편집, 변환' },
        { id: 'audio-processing', name: '오디오 처리', desc: 'TTS, 믹싱, 정규화' },
        { id: 'ai-generation', name: 'AI 생성', desc: '스크립트, 영상, 이미지' },
        { id: 'upload', name: '업로드', desc: 'YouTube, 클라우드' },
    ];

    const handleSave = () => {
        updateData({ workerType, priority, maxRetries, timeout });
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                    <Label>작업 유형</Label>
                    <Select value={workerType} onValueChange={setWorkerType}>
                        <SelectTrigger className="mt-2">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {workerTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                    <div>
                                        <div className="font-medium">{type.name}</div>
                                        <div className="text-xs text-slate-500">{type.desc}</div>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>우선순위</Label>
                    <div className="mt-2 space-y-2">
                        <Slider
                            value={[priority]}
                            onValueChange={([v]) => setPriority(v)}
                            min={1}
                            max={10}
                            step={1}
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>낮음 (1)</span>
                            <Badge variant="outline">{priority}</Badge>
                            <span>높음 (10)</span>
                        </div>
                    </div>
                </div>

                <div>
                    <Label>최대 재시도 횟수</Label>
                    <Input
                        type="number"
                        value={maxRetries}
                        onChange={(e) => setMaxRetries(parseInt(e.target.value))}
                        min={0}
                        max={10}
                        className="mt-2"
                    />
                </div>

                <div>
                    <Label>타임아웃 (초)</Label>
                    <Input
                        type="number"
                        value={timeout}
                        onChange={(e) => setTimeout(parseInt(e.target.value))}
                        min={30}
                        max={3600}
                        className="mt-2"
                    />
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-start gap-2">
                        <Cpu className="w-5 h-5 text-slate-600 mt-0.5" />
                        <div className="text-sm text-slate-700">
                            <p className="font-semibold">워커 설정</p>
                            <p className="text-xs mt-1">
                                우선순위 {priority} • 최대 {maxRetries}회 재시도 • {timeout}초 타임아웃
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                <Button onClick={handleSave} className="bg-slate-600 hover:bg-slate-700">
                    <Zap className="w-4 h-4 mr-2" />
                    저장
                </Button>
            </div>
        </div>
    );
};

export default WorkerInspector;
