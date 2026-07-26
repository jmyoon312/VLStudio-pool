import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
    Eye, Settings, Activity, Plus, Trash2, Play, Pause,
    TrendingUp, Filter, Bell, History, PlaySquare
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Channel {
    url: string;
    active: boolean;
    lastCheck?: string;
}

interface DiscoveredVideo {
    title: string;
    views: number;
    uploadedAt: string;
    channelName: string;
}

const ReferenceMonitorNode = ({ data, selected }: NodeProps) => {
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('channels');

    // 채널 설정
    const [channels, setChannels] = useState<Channel[]>(data.channels || []);
    const [newChannelUrl, setNewChannelUrl] = useState('');

    // 필터 설정
    const [minViews, setMinViews] = useState(data.minViews || 1000);
    const [minLikes, setMinLikes] = useState(data.minLikes || 50);
    const [minDuration, setMinDuration] = useState(data.minDuration || 5);
    const [maxDuration, setMaxDuration] = useState(data.maxDuration || 30);
    const [includeKeywords, setIncludeKeywords] = useState(data.includeKeywords || '');
    const [excludeKeywords, setExcludeKeywords] = useState(data.excludeKeywords || '');

    // 알림 설정
    const [autoTrigger, setAutoTrigger] = useState(data.autoTrigger !== false);
    const [emailNotif, setEmailNotif] = useState(data.emailNotif !== false);
    const [slackNotif, setSlackNotif] = useState(data.slackNotif || false);
    const [checkInterval, setCheckInterval] = useState(data.checkInterval || 10);

    // 히스토리
    const [discoveredVideos, setDiscoveredVideos] = useState<DiscoveredVideo[]>([]);

    const addChannel = () => {
        if (!newChannelUrl.trim()) return;
        setChannels([...channels, { url: newChannelUrl, active: true }]);
        setNewChannelUrl('');
    };

    const removeChannel = (index: number) => {
        setChannels(channels.filter((_, i) => i !== index));
    };

    const toggleChannel = (index: number) => {
        const newChannels = [...channels];
        newChannels[index].active = !newChannels[index].active;
        setChannels(newChannels);
    };

    const handleSave = () => {
        if (data.onChange) {
            data.onChange({
                channels,
                minViews,
                minLikes,
                minDuration,
                maxDuration,
                includeKeywords,
                excludeKeywords,
                autoTrigger,
                emailNotif,
                slackNotif,
                checkInterval
            });
        }
        setInspectorOpen(false);
    };

    const activeChannelCount = channels.filter(c => c.active).length;

    return (
        <>
            <div className={cn(
                "relative w-[260px] transition-all duration-300",
                selected ? 'ring-2 ring-emerald-500 rounded-xl' : ''
            )}>
                <Card className="overflow-hidden border-0 shadow-lg bg-white hover:shadow-xl transition-shadow">
                    <div className="h-2 bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500" />

                    <div className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center text-emerald-600">
                                <Eye className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-slate-800 truncate">{data.label}</h3>
                                <div className="flex items-center gap-1 mt-1">
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <Activity className="w-3 h-3 mr-1 animate-pulse" />
                                        모니터링 중
                                    </Badge>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => setInspectorOpen(true)}
                            >
                                <Settings className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 flex items-center gap-1">
                                    <PlaySquare className="w-3 h-3" />
                                    채널
                                </span>
                                <span className="font-medium text-emerald-700">
                                    {activeChannelCount}/{channels.length}개 활성
                                </span>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    최소 조회수
                                </span>
                                <span className="font-medium text-slate-700">{minViews.toLocaleString()}</span>
                            </div>

                            <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                                {checkInterval}분마다 체크
                            </div>
                        </div>
                    </div>
                </Card>

                <Handle
                    type="source"
                    position={Position.Right}
                    className="w-4 h-4 bg-emerald-500 border-2 border-white shadow-md"
                    isConnectable={true}
                />
            </div>

            {/* Inspector Dialog */}
            <Dialog open={inspectorOpen} onOpenChange={setInspectorOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
                    <DialogHeader className="bg-gradient-to-r from-emerald-500 to-green-600 text-white p-6">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Eye className="w-5 h-5" />
                            레퍼런스 모니터링 설정
                        </DialogTitle>
                        <p className="text-emerald-50 text-sm mt-1">YouTube 채널을 모니터링하고 새 영상을 자동으로 감지하세요</p>
                    </DialogHeader>

                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-4 mb-6">
                                <TabsTrigger value="channels">채널</TabsTrigger>
                                <TabsTrigger value="filters">필터</TabsTrigger>
                                <TabsTrigger value="notifications">알림</TabsTrigger>
                                <TabsTrigger value="history">히스토리</TabsTrigger>
                            </TabsList>

                            {/* 채널 탭 */}
                            <TabsContent value="channels" className="space-y-6">
                                <div>
                                    <Label>채널 추가</Label>
                                    <div className="flex gap-2 mt-2">
                                        <Input
                                            value={newChannelUrl}
                                            onChange={(e) => setNewChannelUrl(e.target.value)}
                                            placeholder="https://www.youtube.com/@channel"
                                            onKeyPress={(e) => e.key === 'Enter' && addChannel()}
                                        />
                                        <Button onClick={addChannel}>
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <Label>모니터링 중인 채널 ({channels.length}개)</Label>
                                    </div>

                                    <div className="space-y-2 max-h-80 overflow-y-auto">
                                        {channels.map((channel, idx) => (
                                            <div
                                                key={idx}
                                                className={cn(
                                                    "p-3 rounded-lg border flex items-center gap-3",
                                                    channel.active ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                                                )}
                                            >
                                                <PlaySquare className={cn(
                                                    "w-5 h-5 flex-shrink-0",
                                                    channel.active ? 'text-emerald-600' : 'text-slate-600'
                                                )} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{channel.url}</p>
                                                    {channel.lastCheck && (
                                                        <p className="text-xs text-slate-500">
                                                            마지막 체크: {channel.lastCheck}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => toggleChannel(idx)}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        {channel.active ? (
                                                            <Pause className="w-4 h-4 text-orange-500" />
                                                        ) : (
                                                            <Play className="w-4 h-4 text-emerald-500" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => removeChannel(idx)}
                                                        className="h-8 w-8 p-0 text-red-500"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}

                                        {channels.length === 0 && (
                                            <div className="text-center py-12 text-slate-600">
                                                <PlaySquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                                <p className="text-sm">모니터링할 채널을 추가하세요</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <Label>체크 간격</Label>
                                    <Select value={checkInterval.toString()} onValueChange={(v) => setCheckInterval(parseInt(v))}>
                                        <SelectTrigger className="mt-2">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">5분마다</SelectItem>
                                            <SelectItem value="10">10분마다</SelectItem>
                                            <SelectItem value="30">30분마다</SelectItem>
                                            <SelectItem value="60">1시간마다</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TabsContent>

                            {/* 필터 탭 */}
                            <TabsContent value="filters" className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>최소 조회수</Label>
                                        <Input
                                            type="number"
                                            value={minViews}
                                            onChange={(e) => setMinViews(parseInt(e.target.value))}
                                            min={0}
                                            className="mt-2"
                                        />
                                    </div>
                                    <div>
                                        <Label>최소 좋아요</Label>
                                        <Input
                                            type="number"
                                            value={minLikes}
                                            onChange={(e) => setMinLikes(parseInt(e.target.value))}
                                            min={0}
                                            className="mt-2"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label>영상 길이 (분)</Label>
                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <Input
                                            type="number"
                                            value={minDuration}
                                            onChange={(e) => setMinDuration(parseInt(e.target.value))}
                                            placeholder="최소"
                                            min={0}
                                        />
                                        <Input
                                            type="number"
                                            value={maxDuration}
                                            onChange={(e) => setMaxDuration(parseInt(e.target.value))}
                                            placeholder="최대"
                                            min={0}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label>포함 키워드 (쉼표로 구분)</Label>
                                    <Input
                                        value={includeKeywords}
                                        onChange={(e) => setIncludeKeywords(e.target.value)}
                                        placeholder="tutorial, guide, how to"
                                        className="mt-2"
                                    />
                                </div>

                                <div>
                                    <Label>제외 키워드 (쉼표로 구분)</Label>
                                    <Input
                                        value={excludeKeywords}
                                        onChange={(e) => setExcludeKeywords(e.target.value)}
                                        placeholder="ads, sponsored"
                                        className="mt-2"
                                    />
                                </div>

                                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Filter className="w-5 h-5 text-emerald-600" />
                                        <span className="font-semibold text-emerald-900">예상 매칭률</span>
                                    </div>
                                    <p className="text-2xl font-bold text-emerald-700">약 30%</p>
                                    <p className="text-xs text-emerald-600 mt-1">
                                        설정한 필터 조건을 만족하는 영상의 비율
                                    </p>
                                </div>
                            </TabsContent>

                            {/* 알림 탭 */}
                            <TabsContent value="notifications" className="space-y-6">
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-sm">새 영상 발견 시 즉시 워크플로우 실행</p>
                                        <p className="text-xs text-slate-500 mt-1">자동으로 다음 노드로 데이터 전달</p>
                                    </div>
                                    <Switch checked={autoTrigger} onCheckedChange={setAutoTrigger} />
                                </div>

                                <div className="space-y-3">
                                    <Label>알림 채널</Label>

                                    <div className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <Bell className="w-4 h-4 text-slate-600" />
                                            <span className="text-sm">이메일 알림</span>
                                        </div>
                                        <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
                                    </div>

                                    <div className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <Bell className="w-4 h-4 text-slate-600" />
                                            <span className="text-sm">Slack 알림</span>
                                        </div>
                                        <Switch checked={slackNotif} onCheckedChange={setSlackNotif} />
                                    </div>
                                </div>
                            </TabsContent>

                            {/* 히스토리 탭 */}
                            <TabsContent value="history" className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>발견된 영상 (최근 7일)</Label>
                                    <Badge>{discoveredVideos.length}개</Badge>
                                </div>

                                {discoveredVideos.length === 0 && (
                                    <div className="text-center py-12 text-slate-600">
                                        <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p className="text-sm">아직 발견된 영상이 없습니다</p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    {discoveredVideos.map((video, idx) => (
                                        <div key={idx} className="p-3 border rounded-lg hover:bg-slate-50">
                                            <p className="font-semibold text-sm">{video.title}</p>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                                <span>{video.channelName}</span>
                                                <span>조회수: {video.views.toLocaleString()}</span>
                                                <span>{video.uploadedAt}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Footer */}
                    <div className="border-t p-4 flex justify-end gap-2 bg-slate-50">
                        <Button variant="outline" onClick={() => setInspectorOpen(false)}>
                            취소
                        </Button>
                        <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
                            저장
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default memo(ReferenceMonitorNode);
