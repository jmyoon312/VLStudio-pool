import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { Video, Settings } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    AlertCircle, RefreshCw, ExternalLink, CheckCircle, Clock,
    UploadCloud, PlayCircle, Loader2, PlaySquare, Trash2,
    Star, MoreHorizontal, Edit3, ArrowUpCircle, Share2
} from 'lucide-react';
import { getMediaUrl } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from "@/components/ui/separator";
import { ShieldCheck } from 'lucide-react';

const OperationsDashboard: React.FC = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("queue");
    const [selectedVideos, setSelectedVideos] = useState<number[]>([]);
    const [editVideo, setEditVideo] = useState<Video | null>(null);

    // -- Queries --
    const { data: videos, isLoading: isVideosLoading } = useQuery<Video[]>({
        queryKey: ['videos', 'operations'],
        queryFn: async () => (await api.get('/videos/?limit=100&sort_by=priority')).data,
        refetchInterval: 10000 // Live updates for status
    });

    const { data: settings } = useQuery<Settings>({
        queryKey: ['settings'],
        queryFn: async () => (await api.get('/settings/')).data
    });

    // [SAIF-2026] Network Status Query
    const { data: netStatus } = useQuery({
        queryKey: ['network-status'],
        queryFn: async () => (await api.get('/network/status')).data,
        refetchInterval: 15000 // Keep an eye on the isolation
    });

    // -- Mutations --
    const rotateMutation = useMutation({
        mutationFn: async () => {
            await api.post('/network/rotate-ip');
        },
        onSuccess: () => {
            toast({ title: "IP Rotation Triggered", description: "Network isolation sequence in progress..." });
            setTimeout(() => queryClient.invalidateQueries({ queryKey: ['network-status'] }), 15000);
        }
    });

    const batchUploadMutation = useMutation({
        mutationFn: async (ids: number[]) => {
            await api.post('/videos/batch/upload/', { video_ids: ids });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['videos'] });
            toast({ title: "일괄 업로드 시작", description: `${selectedVideos.length}개의 영상이 대기열에 추가되었습니다.` });
            setSelectedVideos([]);
        },
        onError: (err: any) => toast({ title: "오류", description: err.message, variant: "destructive" })
    });

    const batchDeleteMutation = useMutation({
        mutationFn: async (ids: number[]) => {
            await api.post('/videos/batch/delete/', { video_ids: ids });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['videos'] });
            toast({ title: "삭제 완료", description: `${selectedVideos.length}개의 영상이 삭제되었습니다.` });
            setSelectedVideos([]);
        }
    });

    const updateVideoMutation = useMutation({
        mutationFn: async (data: { id: number, payload: any }) => {
            await api.patch(`/videos/${data.id}/`, data.payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['videos'] });
            setEditVideo(null); // Close dialog if open
            toast({ title: "업데이트 완료", description: "영상 정보가 수정되었습니다." });
        }
    });

    // -- Helpers --
    // Removed getFileUrl in favor of getMediaUrl utility

    const toggleSelection = (id: number) => {
        setSelectedVideos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const togglePriority = (video: Video) => {
        const newPriority = (video.priority_level || 0) > 0 ? 0 : 1;
        updateVideoMutation.mutate({ id: video.id, payload: { priority_level: newPriority } });
    };

    // -- Filtering & Sorting --
    const filteredVideos = useMemo(() => {
        if (!videos) return { queue: [], active: [], completed: [] };
        return {
            queue: videos.filter(v => ['PENDING', 'FAILED', null, undefined].includes(v.upload_status || null)),
            active: videos.filter(v => ['UPLOADING', 'WAITING_FOR_MOBILE', 'PENDING_UPLOAD'].includes(v.upload_status || '')),
            completed: videos.filter(v => v.upload_status === 'COMPLETED')
        };
    }, [videos]);

    // -- Renderers --
    const renderVideoRow = (video: Video) => {
        const isSelected = selectedVideos.includes(video.id);
        const isHighPriority = (video.priority_level || 0) > 0;

        return (
            <div key={video.id} className={`group flex gap-4 p-3 border rounded-lg transition-all ${isSelected ? 'bg-blue-500/10 border-blue-500/20' : 'bg-card hover:bg-accent/40 border-border'}`}>
                {/* Checkbox */}
                <div className="flex items-center justify-center pl-1">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(video.id)} />
                </div>

                {/* Thumbnail */}
                <div className="w-32 aspect-video bg-muted rounded overflow-hidden relative flex-shrink-0 cursor-pointer" onClick={() => setEditVideo(video)}>
                    {video.thumbnail_path ? (
                        <img
                            src={getMediaUrl(video.thumbnail_path, settings?.root_download_path)}
                            alt={video.title}
                            className="w-full h-full object-cover"
                            onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No Image</div>
                    )}
                    {video.duration && (
                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded font-mono">
                            {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3
                                className="font-semibold text-sm line-clamp-1 cursor-pointer hover:text-primary hover:underline decoration-primary/50 underline-offset-2 text-foreground"
                                onClick={() => setEditVideo(video)}
                            >
                                {video.title}
                            </h3>
                            {isHighPriority && <Star className="w-3 h-3 fill-amber-400 text-amber-400" />}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary" className={`h-5 px-1.5 font-normal ${video.upload_status === 'FAILED' ? 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20' :
                                video.upload_status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20' :
                                    'bg-muted text-muted-foreground'
                                }`}>
                                {video.upload_status || "준비됨"}
                            </Badge>
                            
                            {/* [SAIF-2026] Security Wash Status */}
                            {video.metadata_json?.saif_mutated ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                <ShieldCheck size={10} className="fill-emerald-500/20" />
                                                <span className="text-[10px] font-bold">WASHED</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>SAIF-2026 Semantic Mutation & Hash Protection Applied</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : (
                                <div className="flex items-center gap-1 text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border grayscale">
                                    <ShieldCheck size={10} />
                                    <span className="text-[10px] font-medium">RAW</span>
                                </div>
                            )}

                            <span>{(video.channel_id ? '채널 할당됨' : '채널 없음')}</span>
                            <span>• {new Date(video.upload_date).toLocaleDateString()}</span>
                        </div>
                    </div>
                    {video.failure_reason && (
                        <div className="text-red-500 dark:text-red-400 text-xs flex items-center gap-1 mt-1 font-medium bg-red-500/10 p-1 rounded w-fit">
                            <AlertCircle size={12} />
                            <span className="truncate max-w-[300px]">{video.failure_reason}</span>
                        </div>
                    )}
                </div>

                {/* Active Progress */}
                {activeTab === 'active' && (
                    <div className="w-32 flex flex-col justify-center px-2">
                        <div className="text-[10px] text-muted-foreground mb-1 text-right">업로드 중...</div>
                        <Progress value={45} className="h-1.5 animate-pulse" />
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-amber-500" onClick={() => togglePriority(video)}>
                                    <Star className={`w-4 h-4 ${isHighPriority ? 'fill-amber-400 text-amber-400' : ''}`} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>우선순위 변경</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditVideo(video)}>
                                <Edit3 className="w-4 h-4 mr-2" /> 빠른 수정
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => batchDeleteMutation.mutate([video.id])}>
                                <Trash2 className="w-4 h-4 mr-2" /> 삭제
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {video.uploaded_video_id && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={() => window.open(`https://youtu.be/${video.uploaded_video_id}`, '_blank')}>
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    if (isVideosLoading) return <div className="p-12 flex justify-center text-muted-foreground"><Loader2 className="animate-spin w-8 h-8" /></div>;

    const currentList = filteredVideos[activeTab as keyof typeof filteredVideos] as Video[];

    return (
        <div className="space-y-6 container mx-auto p-6 max-w-7xl">
            {/* [SAIF-2026] Tactical Network Control Center */}
            <Card className="bg-card border-border shadow-md overflow-hidden mb-6 relative">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                    <ShieldCheck className="w-24 h-24 text-foreground" />
                </div>
                <CardContent className="p-6 relative z-10">
                    <div className="flex flex-col lg:flex-row gap-8 items-center justify-between">
                        {/* Status Group */}
                        <div className="flex flex-wrap gap-6 items-center">
                            <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1">
                                    <div className={`w-2 h-2 rounded-full animate-pulse ${netStatus?.status_detail !== 'WIFI_MODE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                    Network Isolation
                                </div>
                                <div className="text-xl font-black text-foreground flex items-center gap-2">
                                    {netStatus?.status_detail === 'LTE_MODE' ? 'FULL-TUNNEL ACTIVE' : 
                                     netStatus?.status_detail === 'DUAL_MODE' ? 'DUAL BINDING' : 'WIFI EXPOSED'}
                                    {netStatus?.status_detail === 'WIFI_MODE' && <AlertCircle className="text-red-500 w-5 h-5 animate-bounce" />}
                                </div>
                            </div>

                            <Separator orientation="vertical" className="h-10 bg-border hidden lg:block" />

                            <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Public Identity (IP)</div>
                                <div className="text-sm font-mono text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                    {netStatus?.public_ip || "SCANNING..."}
                                </div>
                            </div>

                            <Separator orientation="vertical" className="h-10 bg-border hidden lg:block" />

                            <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">ADB Tethering</div>
                                <div className="text-sm font-medium">
                                    {netStatus?.adb_connected ? (
                                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
                                            CONNECTED ({netStatus?.device_count})
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive">DISCONNECTED</Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Action Group */}
                        <div className="flex gap-3 w-full lg:w-auto">
                            <Button 
                                variant="outline" 
                                className="bg-card border-border text-foreground hover:bg-accent flex-1 lg:flex-none h-12 shadow-sm"
                                onClick={() => rotateMutation.mutate()}
                                disabled={rotateMutation.isPending}
                            >
                                {rotateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                Force IP Rotation
                            </Button>
                            <Button 
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 h-12 flex-1 lg:flex-none shadow-sm shadow-primary/20"
                                onClick={() => queryClient.invalidateQueries({ queryKey: ['network-status'] })}
                            >
                                Security Audit
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-between items-end">
                {/* Tactical Operations Control */}
                <div />

                {/* Floating Batch Actions */}
                <div className={`flex gap-2 transition-all duration-300 ${selectedVideos.length > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                    <Button variant="secondary" onClick={() => setSelectedVideos([])}>
                        취소 ({selectedVideos.length})
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => {
                            if (confirm(`${selectedVideos.length}개의 영상을 삭제하시겠습니까?`)) batchDeleteMutation.mutate(selectedVideos);
                        }}
                    >
                        <Trash2 className="w-4 h-4 mr-2" /> 삭제
                    </Button>
                    <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => batchUploadMutation.mutate(selectedVideos)}
                    >
                        <UploadCloud className="w-4 h-4 mr-2" /> 일괄 업로드
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="queue" className="w-full" onValueChange={setActiveTab}>
                <TabsList className="grid w-full max-w-md grid-cols-3">
                    <TabsTrigger value="queue">대기열 ({filteredVideos.queue.length})</TabsTrigger>
                    <TabsTrigger value="active">진행 중 ({filteredVideos.active.length})</TabsTrigger>
                    <TabsTrigger value="completed">완료됨 ({filteredVideos.completed.length})</TabsTrigger>
                </TabsList>

                <div className="mt-6 space-y-4 min-h-[500px]">
                    <Card className="border-border bg-card shadow-sm">
                        <CardHeader className="pb-3 border-b border-border">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-lg text-foreground">
                                        {activeTab === 'queue' ? '업로드 대기열' : activeTab === 'active' ? '진행 중인 작업' : '완료된 기록'}
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        {activeTab === 'queue' ? '배포 준비가 완료된 영상들입니다. 일괄 업로드를 선택하세요.' :
                                            activeTab === 'active' ? '실시간 업로드 진행 상황을 모니터링합니다.' :
                                                ' 성공적으로 게시된 영상들의 아카이브입니다.'}
                                    </CardDescription>
                                </div>
                                {activeTab === 'queue' && (
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedVideos(currentList.map(v => v.id))}>
                                        전체 선택
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {currentList.length === 0 ? (
                                <div className="py-20 text-center text-muted-foreground flex flex-col items-center">
                                    <Clock className="w-12 h-12 mb-4 opacity-20" />
                                    <p>이 뷰에는 영상이 없습니다.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {currentList.map(renderVideoRow)}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </Tabs>

            {/* Quick Edit Modal */}
            <Dialog open={!!editVideo} onOpenChange={(open) => !open && setEditVideo(null)}>
                <DialogContent className="sm:max-w-[500px] bg-card border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">빠른 메타데이터 수정</DialogTitle>
                        <DialogDescription className="text-muted-foreground">업로드 전에 세부 정보를 수정하세요.</DialogDescription>
                    </DialogHeader>
                    {editVideo && (
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="title" className="text-foreground">제목</Label>
                                <Input
                                    id="title"
                                    defaultValue={editVideo.title}
                                    className="bg-background border-border text-foreground"
                                    onChange={(e) => setEditVideo({ ...editVideo, title: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="desc" className="text-foreground">설명</Label>
                                <Textarea
                                    id="desc"
                                    className="h-24 bg-background border-border text-foreground"
                                    defaultValue={editVideo.metadata_json?.description || ""}
                                    onChange={(e) => {
                                        const meta = editVideo.metadata_json || {};
                                        setEditVideo({ ...editVideo, metadata_json: { ...meta, description: e.target.value } })
                                    }}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="submit" onClick={() => {
                            if (editVideo) updateVideoMutation.mutate({
                                id: editVideo.id,
                                payload: {
                                    title: editVideo.title,
                                    metadata_json: editVideo.metadata_json
                                }
                            });
                        }}>변경사항 저장</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default OperationsDashboard;
