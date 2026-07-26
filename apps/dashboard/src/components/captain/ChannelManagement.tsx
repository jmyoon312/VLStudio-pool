import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ExternalLink, TrendingUp, Users, Eye, DollarSign } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import axios from 'axios';

const API_BASE = typeof window !== 'undefined' && window.location.protocol === 'file:' ? 'http://127.0.0.1:8000/api' : '/api';

interface ChannelManagementProps {
    profileId: string;
}

interface Channel {
    channel_id: string;
    channel_name: string;
    channel_handle: string;
    thumbnail_url: string;
    subscriber_count: number;
    view_count: number;
    video_count: number;
    estimated_revenue: number;
    health_score: number;
    can_upload: boolean | null;
    is_monetized: boolean | null;
    last_updated: string | null;
    // [SAIF] Security Fields
    engine_mode?: string;
    stealth_trust_score?: number;
    is_network_isolated?: boolean;
    // [Cultivation] Fields
    cultivation_strategy?: string;
    cultivation_active?: boolean;
}

const ChannelManagement: React.FC<ChannelManagementProps> = ({ profileId }) => {
    const { toast } = useToast();
    const [refreshing, setRefreshing] = useState(false);
    const [updatingMap, setUpdatingMap] = useState<Record<string, boolean>>({});

    // Fetch dashboard data
    const { data: dashboardData, isLoading, refetch } = useQuery({
        queryKey: ['captain-channels', profileId],
        queryFn: async () => {
            const response = await axios.get(`${API_BASE}/captain/${profileId}/channels?view=dashboard`);
            return response.data;
        },
        staleTime: 1000 * 5, // 5 seconds cache to load fresh data immediately
    });

    const channels: Channel[] = dashboardData?.channels || [];

    const handleUpdateSecurity = async (channelId: string, mode: string) => {
        setUpdatingMap(prev => ({ ...prev, [channelId]: true }));
        try {
            await axios.patch(`${API_BASE}/youtube/channels/${channelId}/security`, { engine_mode: mode });
            toast({
                title: "보안 설정 변경",
                description: `엔진 모드가 ${mode.toUpperCase()}(으)로 변경되었습니다.`,
            });
            refetch();
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "변경 실패",
                description: "보안 설정을 업데이트할 수 없습니다.",
            });
        } finally {
            setUpdatingMap(prev => ({ ...prev, [channelId]: false }));
        }
    };

    const handleAudit = async (channelId: string) => {
        toast({ title: "감사 시작", description: "Sentinel Audit을 수행 중입니다..." });
        try {
            const resp = await axios.post(`${API_BASE}/youtube/channels/${channelId}/audit`);
            toast({
                title: "감사 완료",
                description: `지문 신뢰도 점수: ${resp.data.score}%`,
            });
            refetch();
        } catch (error) {
            toast({ variant: "destructive", title: "감사 실패", description: "보안 진단을 수행할 수 없습니다." });
        }
    };

    const formatNumber = (num: number) => {
        if (num >= 10000) return `${(num / 10000).toFixed(1)}만`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}천`;
        return num.toLocaleString();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">스텔스 채널 관리 (TinCan)</h2>
                    <p className="text-slate-500 mt-1">
                        관리 중인 {channels.length}개 채널의 격리 및 Stealth 상태를 모니터링합니다.
                    </p>
                </div>
                <Button
                    onClick={() => refetch()}
                    disabled={refreshing}
                    className="gap-2"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    상태 업데이트
                </Button>
            </div>

            {/* Channel Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {channels.map((channel) => (
                    <Card key={channel.channel_id} className="hover:shadow-lg transition-shadow border-t-4 border-t-indigo-500">
                        <CardHeader className="pb-3">
                            <div className="flex items-start gap-3">
                                {channel.thumbnail_url ? (
                                    <img
                                        src={channel.thumbnail_url}
                                        alt={channel.channel_name || 'Channel'}
                                        className="w-12 h-12 rounded-full object-cover border border-slate-200"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold">
                                        {channel.channel_name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-base truncate">
                                            {channel.channel_name || channel.channel_id}
                                        </CardTitle>
                                        <Badge className="text-[8px] h-3.5 bg-slate-100 text-slate-500 border-slate-200 font-mono">
                                            ID: SAIF-{channel.channel_id.substring(0, 4).toUpperCase()}
                                        </Badge>
                                    </div>
                                    <CardDescription className="text-xs truncate">
                                        {channel.channel_handle || `ID: ${channel.channel_id.substring(0, 12)}...`}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-2 text-sm border-b pb-3">
                                <div className="flex items-center gap-1 text-slate-600">
                                    <Users className="w-3 h-3" />
                                    <span>{formatNumber(channel.subscriber_count || 0)}</span>
                                </div>
                                <div className="flex items-center gap-1 text-slate-600">
                                    <Eye className="w-3 h-3" />
                                    <span>{formatNumber(channel.view_count || 0)}</span>
                                </div>
                            </div>

                            {/* [SAIF] Security Section */}
                            <div className="bg-slate-50 p-3 rounded-lg space-y-2 border border-slate-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                        🛡️ TinCan Stealth 엔진 상태
                                    </span>
                                    <Badge 
                                        className="text-[10px] px-1 py-0"
                                        variant={channel.stealth_trust_score && channel.stealth_trust_score > 80 ? "default" : "outline"}
                                    >
                                        Trust: {channel.stealth_trust_score || 0}%
                                    </Badge>
                                </div>
                                <div className="flex gap-1 items-center">
                                    <div className="relative flex-1">
                                        <select 
                                            className="text-xs border rounded px-1 py-1 bg-white w-full pr-8 appearance-none"
                                            value={channel.engine_mode || "standard"}
                                            onChange={(e) => handleUpdateSecurity(channel.channel_id, e.target.value)}
                                            disabled={updatingMap[channel.channel_id]}
                                        >
                                            <option value="standard">Patchright (Stealth Mode) - 권장</option>
                                            <option value="cloak">Patchright (Hardened) - 고보안</option>
                                            <option value="fox">API Upload Only - 비상용</option>
                                        </select>
                                        <div className="absolute right-2 top-1.5 pointer-events-none flex items-center gap-1">
                                            <Badge className="text-[7px] px-1 h-3 bg-blue-500 hover:bg-blue-500">SYSTEM</Badge>
                                        </div>
                                    </div>
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-7 w-7"
                                        onClick={() => handleAudit(channel.channel_id)}
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                    </Button>
                                </div>
                                
                                {/* Engine Mode Explanation */}
                                <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[10px] text-slate-600 leading-relaxed mt-2 mb-2">
                                    {channel.engine_mode === 'cloak' ? (
                                        <><span className="font-bold text-indigo-700">고보안(Hardened) 모드:</span> 섀도우밴 집중 감시 기간(Death Valley)이거나 경고 누적 채널에 필수적입니다. 모든 요청에 극강의 지문 변조와 프록시 회전이 강제되어 속도는 느리지만 생존율을 극대화합니다.</>
                                    ) : channel.engine_mode === 'fox' ? (
                                        <><span className="font-bold text-amber-700">API Upload Only 모드:</span> 브라우저 웜업 로직을 생략하고 공식 API만 사용하여 초고속으로 업로드합니다. 이미 인큐베이팅을 거쳐 신뢰도가 완벽히 확보된 채널에만 사용하세요.</>
                                    ) : (
                                        <><span className="font-bold text-blue-700">권장(Stealth) 모드:</span> 99%의 채널에 적합한 기본 모드입니다. 휴먼 딜레이와 적절한 스텔스 기능이 균형있게 적용되어 알고리즘에 자연스러운 채널로 인식되도록 돕습니다.</>
                                    )}
                                </div>

                                {/* [SAIF-2026] DNA Profile Visualization */}
                                <div className="space-y-1 mb-2">
                                    <div className="flex items-center gap-1.5">
                                        <Badge variant="outline" className="text-[8px] h-3.5 bg-indigo-50 text-indigo-600 border-indigo-100">
                                            네트워크 및 기기 격리 적용 (Device Isolation)
                                        </Badge>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-1 mt-2">
                                    <div className="bg-white/50 border border-slate-200 rounded p-1.5 flex flex-col">
                                        <span className="text-[8px] text-slate-600 uppercase font-bold">BROWSER ENGINE</span>
                                        <span className="text-[10px] font-mono text-indigo-600 font-bold">Patchright v1.4</span>
                                    </div>
                                    <div className="bg-white/50 border border-slate-200 rounded p-1.5 flex flex-col">
                                        <span className="text-[8px] text-slate-600 uppercase font-bold">NETWORK ISOLATION</span>
                                        <span className="text-[10px] font-mono text-indigo-600 font-bold">
                                            {channel.is_network_isolated ? 'LTE Tethering' : 'Proxy Routing'}
                                        </span>
                                    </div>
                                    <div className="col-span-2 bg-white/50 border border-slate-200 rounded p-1.5 flex flex-col">
                                        <span className="text-[8px] text-slate-600 uppercase font-bold">CULTIVATION STRATEGY</span>
                                        <span className="text-[9px] font-mono text-slate-600 truncate flex items-center justify-between">
                                            {channel.cultivation_strategy ? (
                                                <>
                                                    <span>{channel.cultivation_strategy}</span>
                                                    <Badge variant={channel.cultivation_active ? "default" : "secondary"} className="text-[8px] h-3">
                                                        {channel.cultivation_active ? "진행 중" : "일시 정지"}
                                                    </Badge>
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground">수동 모드 (미지정)</span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Status Badges */}
                            <div className="flex flex-wrap gap-1">
                                {channel.health_score !== null && (
                                    <Badge variant={channel.health_score >= 70 ? "secondary" : "destructive"} className="text-[10px]">
                                        건강도 {channel.health_score}%
                                    </Badge>
                                )}
                                {channel.is_network_isolated && (
                                    <Badge className="bg-green-100 text-green-700 text-[10px] border-green-200">
                                        LTE 격리됨
                                    </Badge>
                                )}
                                <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-600 bg-indigo-50/50">
                                    패턴 회피 활성
                                </Badge>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 text-xs"
                                    onClick={() => window.open(`https://youtube.com/channel/${channel.channel_id}`, '_blank')}
                                >
                                    YouTube
                                </Button>
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="flex-1 text-xs"
                                    onClick={() => axios.post(`${API_BASE}/youtube/channels/${channel.channel_id}/launch`)}
                                >
                                    원격 접속
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {channels.length === 0 && (
                <Card className="p-12 text-center">
                    <p className="text-slate-500">관리 중인 채널이 없습니다.</p>
                </Card>
            )}
        </div>
    );
};

export default ChannelManagement;
