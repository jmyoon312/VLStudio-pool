import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Newspaper, PlaySquare, CheckCircle, Loader2 } from 'lucide-react';
import api from '../../../lib/api';

interface DistributionInspectorProps {
    node: any;
    updateData: (data: any) => void;
}

const DistributionInspector: React.FC<DistributionInspectorProps> = ({ node, updateData }) => {
    const [selectedChannels, setSelectedChannels] = useState<string[]>(node.data.selectedChannels || []);
    const [publishMode, setPublishMode] = useState(node.data.publishMode || 'immediate');
    const [autoNotify, setAutoNotify] = useState(node.data.autoNotify !== false);
    const [channels, setChannels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/brand-channels/')
            .then(res => {
                setChannels(res.data || []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch channels', err);
                setLoading(false);
            });
    }, []);

    const toggleChannel = (channelId: string) => {
        setSelectedChannels(prev =>
            prev.includes(channelId) ? prev.filter(id => id !== channelId) : [...prev, channelId]
        );
    };

    const handleSave = () => {
        updateData({ selectedChannels, publishMode, autoNotify });
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                    <Label>배포 모드</Label>
                    <Select value={publishMode} onValueChange={setPublishMode}>
                        <SelectTrigger className="mt-2">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="immediate">즉시 업로드</SelectItem>
                            <SelectItem value="scheduled">예약 업로드</SelectItem>
                            <SelectItem value="draft">임시 저장</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <Label>대상 채널</Label>
                        <Badge>{selectedChannels.length}개 선택</Badge>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {channels.map((channel) => (
                                <div
                                    key={channel.id}
                                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedChannels.includes(channel.id)
                                            ? 'bg-blue-50 border-blue-300'
                                            : 'hover:bg-slate-50'
                                        }`}
                                    onClick={() => toggleChannel(channel.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <PlaySquare className="w-4 h-4 text-red-500" />
                                            <span className="text-sm font-medium">{channel.name}</span>
                                        </div>
                                        {selectedChannels.includes(channel.id) && (
                                            <CheckCircle className="w-5 h-5 text-blue-600" />
                                        )}
                                    </div>
                                </div>
                            ))}

                            {channels.length === 0 && (
                                <div className="text-center py-8 text-slate-600">
                                    <PlaySquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">등록된 채널이 없습니다</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                        <p className="font-semibold text-sm">자동 알림</p>
                        <p className="text-xs text-slate-500">업로드 완료 시 알림 전송</p>
                    </div>
                    <Switch checked={autoNotify} onCheckedChange={setAutoNotify} />
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-start gap-2">
                        <Newspaper className="w-5 h-5 text-green-600 mt-0.5" />
                        <div className="text-sm text-green-800">
                            <p className="font-semibold">배포 준비 완료</p>
                            <p className="text-xs mt-1">
                                {selectedChannels.length}개 채널에 {publishMode === 'immediate' ? '즉시' : '예약'} 업로드
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                    <Newspaper className="w-4 h-4 mr-2" />
                    저장
                </Button>
            </div>
        </div>
    );
};

export default DistributionInspector;
