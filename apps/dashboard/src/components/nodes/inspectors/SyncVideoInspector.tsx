import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Video, RefreshCw, CheckCircle } from 'lucide-react';

interface SyncVideoInspectorProps {
    node: any;
    updateData: (data: any) => void;
}

const SyncVideoInspector: React.FC<SyncVideoInspectorProps> = ({ node, updateData }) => {
    const [syncMethod, setSyncMethod] = useState(node.data.syncMethod || 'audio');
    const [trimSilence, setTrimSilence] = useState(node.data.trimSilence !== false);
    const [alignStart, setAlignStart] = useState(node.data.alignStart !== false);
    const [matchDuration, setMatchDuration] = useState(node.data.matchDuration !== false);

    const handleSave = () => {
        updateData({ syncMethod, trimSilence, alignStart, matchDuration });
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                    <Label>동기화 방법</Label>
                    <Select value={syncMethod} onValueChange={setSyncMethod}>
                        <SelectTrigger className="mt-2">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="audio">오디오 기반</SelectItem>
                            <SelectItem value="subtitle">자막 기반</SelectItem>
                            <SelectItem value="manual">수동 타임코드</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                        <p className="font-semibold text-sm">무음 구간 제거</p>
                        <p className="text-xs text-slate-500">자동으로 조용한 부분 삭제</p>
                    </div>
                    <Switch checked={trimSilence} onCheckedChange={setTrimSilence} />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                        <p className="font-semibold text-sm">시작 지점 정렬</p>
                        <p className="text-xs text-slate-500">모든 트랙을 동일 시작점에 맞춤</p>
                    </div>
                    <Switch checked={alignStart} onCheckedChange={setAlignStart} />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                        <p className="font-semibold text-sm">길이 맞춤</p>
                        <p className="text-xs text-slate-500">가장 긴 트랙에 맞춰 조정</p>
                    </div>
                    <Switch checked={matchDuration} onCheckedChange={setMatchDuration} />
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2">
                        <RefreshCw className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold">자동 동기화</p>
                            <p className="text-xs mt-1">
                                영상과 오디오를 자동으로 정렬하고 동기화합니다
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                    <Video className="w-4 h-4 mr-2" />
                    저장
                </Button>
            </div>
        </div>
    );
};

export default SyncVideoInspector;
