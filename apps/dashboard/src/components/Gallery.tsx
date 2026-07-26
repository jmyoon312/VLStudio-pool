import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api, { Video, Settings, Channel, Category } from '../lib/api';
import SubtitleViewer from './SubtitleViewer';
import { AutoHDSettingsDialog } from './AutoHDSettingsDialog'; // [NEW]
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, getMediaUrl } from "@/lib/utils";
import {
    Loader2, Trash2, Play, FileText,
    Flame, Zap, TrendingUp, RefreshCw, Filter, Settings2,
    FolderOpen, Calendar, Copy, Check, Languages, CheckSquare, Square, AlertCircle, LineChart, Download,
    ExternalLink, PlaySquare
} from 'lucide-react';
import { resolveFileUrl } from "@/utils/fileUrl";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const VideoPlayer = ({ src, title, isYouTube, youtubeUrl, onYouTubeOpen }: { src: string, title: string, isYouTube?: boolean, youtubeUrl?: string, onYouTubeOpen?: () => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [localError, setLocalError] = useState(false);

    const handleSpeedChange = (speed: number) => {
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
            setPlaybackRate(speed);
        }
    };

    if (localError || isYouTube) {
        return (
            <div className="flex flex-col bg-black rounded-xl overflow-hidden">
                <div className="relative w-full aspect-video bg-black flex items-center justify-center">
                    {youtubeUrl ? (
                        <iframe
                            src={`https://www.youtube.com/embed/${new URL(youtubeUrl).searchParams.get('v') || youtubeUrl.split('/').pop()}`}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    ) : (
                        <div className="text-center text-white/60 p-8">
                            <Play className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p className="text-sm">로컬 파일을 찾을 수 없습니다</p>
                            {onYouTubeOpen && (
                                <Button variant="secondary" size="sm" className="mt-4" onClick={onYouTubeOpen}>
                                    YouTube에서 열기
                                </Button>
                            )}
                        </div>
                    )}
                </div>
                <div className="p-4 bg-white text-slate-800 border border-slate-200">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm truncate font-medium text-slate-800">{title}</h3>
                        {youtubeUrl && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-800" onClick={onYouTubeOpen}>
                                <ExternalLink className="w-3 h-3 mr-1" /> YouTube
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col bg-black rounded-xl overflow-hidden">
            <div className="relative w-full aspect-[9/16] bg-black">
                <video
                    ref={videoRef}
                    src={src}
                    className="w-full h-full object-contain"
                    controls={true}
                    playsInline
                    autoPlay
                    onError={() => setLocalError(true)}
                />
            </div>
            <div className="p-4 bg-white text-slate-800 border border-slate-200 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm truncate font-medium text-slate-800">{title}</h3>
                    {youtubeUrl && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:text-blue-800" onClick={onYouTubeOpen}>
                            <ExternalLink className="w-3 h-3 mr-1" /> YouTube
                        </Button>
                    )}
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 font-mono">Playback Speed</span>
                    <div className="flex items-center gap-1 bg-white/10 p-1 rounded-lg">
                        {[1.0, 1.25, 1.5, 2.0].map((speed) => (
                            <button
                                key={speed}
                                onClick={() => handleSpeedChange(speed)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                                    playbackRate === speed
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "hover:bg-white/10 text-slate-600 hover:text-white"
                                )}
                            >
                                {speed}x
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Gallery = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
    const [subtitleVideo, setSubtitleVideo] = useState<Video | null>(null);

    // showScriptOnly removed from UI but keeping local state default false or logic to always show?
    // User requested "Remove script view mode". I'll default to showing EVERYTHING unless explicitly told otherwise.
    // UseMemo filter below will just return true if I remove the check. 
    // Wait, "is_script_only" videos might flood the gallery if they are just scripts. 
    // I will assume "Remove mode" means "Don't toggle, just show everything" OR "Don't toggle, show standard videos".
    // Given the context of "Viral Intelligence", usually we want to see VIDEOS.
    // I'll keep the variable but remove the UI control, and default it to false (hide script only) or true?
    // The previous default was false. A checkbox let you see them.
    // If I remove the checkbox, how do they see them? Maybe they don't want to?
    // I will default `showScriptOnly` to `true` (Show All) to prevent data hiding, or remove the filter logic.
    // Let's remove the filter logic so everything is shown.
    const [showScriptOnly, setShowScriptOnly] = useState(false);

    // Fetch Videos
    const { data: videos, isLoading: isVideosLoading, isError, error } = useQuery<Video[]>({
        queryKey: ['videos'],
        queryFn: async () => {
            const res = await api.get<Video[]>('/videos/', { params: { mode: 'video' } });
            // Filter out script-only videos for Gallery (Redundant but safe)
            return res.data.filter(v => !v.is_script_only);
        }
    });

    const { data: settings } = useQuery<Settings>({
        queryKey: ['settings'],
        queryFn: async () => (await api.get('/settings/')).data
    });

    const { data: channels } = useQuery<Channel[]>({
        queryKey: ['channels'],
        queryFn: async () => { const d = (await api.get('/channels/')).data; return Array.isArray(d) ? d : []; }
    });

    const channelMap = useMemo(() => {
        if (!channels) return {};
        return channels.reduce((acc, channel) => {
            acc[channel.id] = channel;
            return acc;
        }, {} as Record<number, Channel>);
    }, [channels]);

    const { data: categories } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => { const d = (await api.get('/categories/')).data; return Array.isArray(d) ? d : []; }
    });

    const categoryMap = useMemo(() => {
        if (!categories) return {};
        return categories.reduce((acc, cat) => {
            acc[cat.id] = cat;
            return acc;
        }, {} as Record<number, Category>);
    }, [categories]);

    // Show ALL videos (Filter removed/relaxed)
    const filteredVideos = useMemo(() => {
        if (!videos) return [];
        return videos;
    }, [videos]);

    const groupedVideos = useMemo(() => {
        const groups: Record<string, Video[]> = {};
        
        filteredVideos.forEach(v => {
            let catName = "임시저장 (미분류)";
            if (v.channel_id && channelMap[v.channel_id]) {
                const ch = channelMap[v.channel_id];
                if (ch.category_id && categoryMap[ch.category_id]) {
                    catName = categoryMap[ch.category_id].name;
                }
            }
            if (!groups[catName]) groups[catName] = [];
            groups[catName].push(v);
        });
        return groups;
    }, [filteredVideos, channelMap, categoryMap]);

    const sortedCategories = useMemo(() => {
        const cats = Object.keys(groupedVideos);
        return cats.sort((a, b) => {
            if (a === "임시저장 (미분류)") return -1;
            if (b === "임시저장 (미분류)") return 1;
            return a.localeCompare(b);
        });
    }, [groupedVideos]);

    const deleteMutation = useMutation({
        mutationFn: (ids: number[]) => api.post('/videos/delete', { video_ids: ids }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['videos'] });
            setSelectedIds(new Set());
            alert('선택한 영상이 삭제되었습니다.');
        },
        onError: () => {
            alert('영상 삭제 중 오류가 발생했습니다.');
        }
    });

    const markViewedMutation = useMutation({
        mutationFn: (videoId: number) => api.post(`/videos/${videoId}/mark-viewed`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['videos'] });
        }
    });

    const hdDownloadMutation = useMutation({
        mutationFn: (videoId: number) => api.post('/videos/manual-hd-download', { video_id: videoId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['videos'] });
            alert('HD 다운로드가 완료되었습니다.');
        },
        onError: (error: any) => {
            alert(`HD 다운로드 실패: ${error.response?.data?.detail || error.message}`);
        }
    });

    // Removed getFileUrl in favor of getMediaUrl utility

    const toggleSelection = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredVideos.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredVideos.map(v => v.id)));
    };

    const handleDelete = () => {
        if (confirm(`${selectedIds.size}개의 영상을 영구 삭제하시겠습니까? (파일도 함께 삭제됩니다)`)) {
            deleteMutation.mutate(Array.from(selectedIds));
        }
    };

    const openFolder = async (path: string | null) => {
        if (!path) return;
        try {
            // [FIX] Backend now handles directory resolution if a file path is provided
            await api.post('/system/open-folder', { path });
        } catch (e) {
            alert("폴더를 열 수 없습니다.");
        }
    };

    const formatCount = (num: number | undefined) => {
        if (num === undefined || num === null) return '-';
        return new Intl.NumberFormat('ko-KR', { notation: "compact", maximumFractionDigits: 1 }).format(num);
    };

    const formatRelativeDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return `${diffDays}일 전`;
    };



    const handlePlayVideo = (video: Video) => {
        const meta = video.metadata_json as any;
        const hasLocalFile = !!video.file_path;
        const ytUrl = video.url || meta?.embed_url || (video.video_id ? `https://www.youtube.com/watch?v=${video.video_id}` : null);
        if (!hasLocalFile && ytUrl) {
            if (meta?.embed_url) {
                setPlayingVideo(video);
            } else {
                window.open(ytUrl, '_blank');
            }
            markViewedMutation.mutate(video.id);
            return;
        }
        if (hasLocalFile && ytUrl) {
            setPlayingVideo(video);
            markViewedMutation.mutate(video.id);
            return;
        }
        if (ytUrl) {
            window.open(ytUrl, '_blank');
            markViewedMutation.mutate(video.id);
            return;
        }
        toast.error("재생할 수 없는 영상입니다.");
    };

    const handleViewSubtitle = (video: Video) => {
        setSubtitleVideo(video);
        markViewedMutation.mutate(video.id);
    };

    // Helper to get Viral Badge
    const getViralBadge = (viralScore: number | undefined, velocity: number | undefined) => {
        const score = viralScore || 0;
        const vel = velocity || 0;

        const badges = [];

        // Viral Score Badges - S/A/B/C Grades
        // Font size increased to text-xs (12px) and specific pixel sizes if needed.
        // Shininess: animate-pulse + shadow
        if (score >= 300) {
            badges.push(
                <Badge key="viral" className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white gap-1 text-[11px] h-6 px-2 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)] border-0 ring-1 ring-white/20">
                    <Flame className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300" />
                    <span className="font-bold">S등급</span> {score.toFixed(0)}%
                </Badge>
            );
        } else if (score >= 100) {
            badges.push(
                <Badge key="trending" className="bg-orange-500 hover:bg-orange-600 text-white gap-1 text-[11px] h-6 px-2 shadow-sm border-orange-400">
                    <Zap className="w-3.5 h-3.5 fill-white" />
                    <span className="font-bold">A등급</span> {score.toFixed(0)}%
                </Badge>
            );
        } else if (score >= 30) {
            badges.push(
                <Badge key="organic" className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1 text-[11px] h-6 px-2 border-emerald-400 shadow-sm">
                    <span className="text-white font-bold text-xs">🌱</span>
                    <span className="font-bold">B등급</span> {score.toFixed(0)}%
                </Badge>
            );
        } else {
            badges.push(
                <Badge key="normal" variant="secondary" className="gap-1 text-[11px] h-6 px-2 bg-slate-100 text-slate-500 border-slate-200">
                    <span className="text-slate-600">☁️</span> C등급 {score.toFixed(1)}%
                </Badge>
            );
        }

        // Velocity Badge
        if (vel > 0) {
            const isHighVelocity = vel > 1000;
            badges.push(
                <Badge key="velocity" className={cn(
                    "gap-1 text-[11px] h-6 px-2 border transition-all",
                    isHighVelocity
                        ? "bg-indigo-600 text-white animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)] border-indigo-500"
                        : "bg-blue-50 text-blue-600 border-blue-200"
                )}>
                    <TrendingUp className={cn("w-3.5 h-3.5", isHighVelocity && "fill-white")} />
                    {vel > 1000 ? (vel / 1000).toFixed(1) + 'K' : vel.toFixed(0)}/hr
                </Badge>
            );
        }

        return <div className="flex flex-col gap-1.5 items-start mt-1">{badges}</div>;
    };

    // Stats Graph Logic
    const [statsVideo, setStatsVideo] = useState<Video | null>(null);
    const { data: videoHistory } = useQuery({
        queryKey: ['history', statsVideo?.id],
        queryFn: async () => (await api.get(`/videos/${statsVideo?.id}/history`)).data,
        enabled: !!statsVideo
    });

    // Graph Data Calculation
    const chartData = useMemo(() => {
        if (!videoHistory || videoHistory.length === 0 || !statsVideo) return [];
        const sorted = [...videoHistory].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Determine calculation mode: Sparse (< 5 points) vs Dense
        // Actually, with the Hybrid Logic, we treat all points roughly the same:
        // "Show me change if there is change, otherwise show me average."
        // We can drop the explicit 'isSparse' check or just keep logic universal.
        const uploadDate = new Date(statsVideo.upload_date).getTime();

        return sorted.map((item, i) => {
            let velocity = 0;
            const itemTime = new Date(item.timestamp).getTime();

            // Lifetime Velocity (Safe calculation)
            const hoursSinceUpload = Math.max(0.1, (itemTime - uploadDate) / (1000 * 60 * 60));
            const lifetimeVelocity = item.view_count / hoursSinceUpload;

            if (i === 0) {
                // First point: Use Lifetime Velocity
                velocity = lifetimeVelocity;
            } else {
                // Calculate Instant Velocity
                const prev = sorted[i - 1];
                const prevTime = new Date(prev.timestamp).getTime();
                const timeDiff = itemTime - prevTime;
                const hours = timeDiff / (1000 * 60 * 60);

                let instantVelocity = 0;
                if (hours > 0) {
                    const viewDiff = item.view_count - prev.view_count;
                    instantVelocity = viewDiff / hours;
                }

                if (instantVelocity > 0) {
                    // Growth -> Show Kink
                    velocity = instantVelocity;
                } else {
                    // Stagnant -> Show Lifetime Average (Prevent 0 drop)
                    velocity = lifetimeVelocity;
                }
            }

            return {
                ...item,
                velocity: Math.max(0, Math.floor(velocity))
            };
        });
    }, [videoHistory, statsVideo]);

    // Drag Logic
    const [isDragging, setIsDragging] = useState(false);
    const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
    const videoRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
    const dragStartSelectedIds = useRef<Set<number>>(new Set());

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !selectionBox) return;
            const newSelectionBox = { ...selectionBox, endX: e.pageX, endY: e.pageY };
            setSelectionBox(newSelectionBox);

            const boxRect = {
                left: Math.min(newSelectionBox.startX, newSelectionBox.endX),
                top: Math.min(newSelectionBox.startY, newSelectionBox.endY),
                right: Math.max(newSelectionBox.startX, newSelectionBox.endX),
                bottom: Math.max(newSelectionBox.startY, newSelectionBox.endY)
            };

            const newSelected = new Set(e.ctrlKey || e.shiftKey ? dragStartSelectedIds.current : []);

            Object.entries(videoRefs.current).forEach(([idStr, el]) => {
                if (!el) return;
                const rect = el.getBoundingClientRect();
                const scrollX = window.scrollX;
                const scrollY = window.scrollY;
                const elLeft = rect.left + scrollX;
                const elTop = rect.top + scrollY;
                const elRight = elLeft + rect.width;
                const elBottom = elTop + rect.height;

                const isIntersecting = !(boxRect.left > elRight || boxRect.right < elLeft || boxRect.top > elBottom || boxRect.bottom < elTop);
                if (isIntersecting) newSelected.add(Number(idStr));
            });
            setSelectedIds(newSelected);
        };

        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                setSelectionBox(null);
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, selectionBox]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.checkbox-area') || (e.target as HTMLElement).closest('.action-btn')) return;
        if (!e.ctrlKey && !e.shiftKey) {
            setSelectedIds(new Set());
            dragStartSelectedIds.current = new Set();
        } else {
            dragStartSelectedIds.current = new Set(selectedIds);
        }
        setIsDragging(true);
        setSelectionBox({ startX: e.pageX, startY: e.pageY, endX: e.pageX, endY: e.pageY });
    };

    if (isVideosLoading || !settings) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-destructive gap-2">
                <AlertCircle className="w-8 h-8" />
                <p>영상 목록을 불러오는데 실패했습니다.</p>
                <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 md:p-8" onMouseDown={handleMouseDown}>
            {/* Selection Box Overlay */}
            {isDragging && selectionBox && (
                <div
                    className="fixed pointer-events-none border border-primary bg-primary/20 z-50"
                    style={{
                        left: Math.min(selectionBox.startX, selectionBox.endX) - window.scrollX,
                        top: Math.min(selectionBox.startY, selectionBox.endY) - window.scrollY,
                        width: Math.abs(selectionBox.endX - selectionBox.startX),
                        height: Math.abs(selectionBox.endY - selectionBox.startY),
                    }}
                />
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 select-none">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">갤러리</h1>
                    <p className="text-muted-foreground mt-2">
                        수집된 영상 데이터를 <strong>바이럴 지수</strong>를 통해 분석합니다 ({filteredVideos.length}개)
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* [NEW] Auto HD Settings Button */}
                    <AutoHDSettingsDialog
                        trigger={
                            <Button variant="outline" size="sm" className="h-[36px] gap-1.5 text-primary border-primary/20 hover:bg-primary/10">
                                <Settings2 className="w-4 h-4" />
                                Auto HD 설정
                            </Button>
                        }
                    />

                    <Button variant="outline" onClick={toggleSelectAll} className="gap-2 h-[36px]">
                        {selectedIds.size === filteredVideos.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        {selectedIds.size === filteredVideos.length ? '전체 해제' : '전체 선택'}
                    </Button>

                    {selectedIds.size > 0 && (
                        <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending} className="gap-2">
                            {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            삭제 ({selectedIds.size})
                        </Button>
                    )}
                </div>
            </div>

            {/* Grouped Grid */}
            <div className="space-y-12 select-none">
                {sortedCategories.map(catName => {
                    const groupVids = groupedVideos[catName];
                    if (groupVids.length === 0) return null;
                    return (
                        <div key={catName} className="space-y-4">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                                {catName === "임시저장 (미분류)" ? <FolderOpen className="text-muted-foreground w-5 h-5"/> : <Filter className="text-primary w-5 h-5"/>}
                                {catName} <Badge variant="secondary" className="ml-2 font-mono text-sm">{groupVids.length}</Badge>
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                                {groupVids.map((video) => {
                    const thumbUrl = getMediaUrl(video.thumbnail_path, settings?.root_download_path);
                    const videoUrl = getMediaUrl(video.file_path, settings?.root_download_path);
                    const isSelected = selectedIds.has(video.id);

                    return (
                        <div
                            key={video.id}
                            ref={el => videoRefs.current[video.id] = el}
                            className={`relative group rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 ${video.metadata_json?.is_hd
                                ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 ring-2 ring-amber-400/50'
                                : 'bg-card'
                                }`}
                        >
                            <Card className={cn(
                                "overflow-hidden hover:shadow-xl transition-all duration-300 border-border/60 hover:border-primary/50 bg-card",
                                isSelected && "ring-2 ring-primary scale-[0.99] bg-accent/10"
                            )}>
                                {/* Thumbnail Section */}
                                <div className="relative aspect-video bg-muted overflow-hidden">
                                    {/* Thumbnail / Fallback Area */}
                                    {thumbUrl && (
                                        <img
                                            src={thumbUrl}
                                            alt={video.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 absolute inset-0 z-10"
                                            onError={(e) => { 
                                                const img = e.currentTarget;
                                                if (img.src.includes('maxresdefault.jpg')) {
                                                    img.src = img.src.replace('maxresdefault.jpg', 'hqdefault.jpg');
                                                } else if (img.src.includes('hqdefault.jpg')) {
                                                    img.src = img.src.replace('hqdefault.jpg', 'mqdefault.jpg');
                                                } else {
                                                    img.style.display = 'none'; 
                                                }
                                            }}
                                        />
                                    )}
                                    <div className="flex items-center justify-center w-full h-full text-muted-foreground/30 bg-muted absolute inset-0 z-0">
                                        <Play className="w-12 h-12 absolute" />
                                        {videoUrl && (
                                            <video
                                                src={videoUrl + "#t=0.1"}
                                                className="w-full h-full object-cover pointer-events-none relative z-10"
                                                muted
                                                preload="metadata"
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        )}
                                    </div>

                                    {/* Select Checkbox */}
                                    <div className="absolute top-2 right-2 z-30 checkbox-area transition-opacity opacity-0 group-hover:opacity-100 data-[selected=true]:opacity-100" data-selected={isSelected}>
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleSelection(video.id)}
                                            className="bg-white data-[state=checked]:bg-primary border-white/50 shadow-sm w-5 h-5 rounded-md"
                                        />
                                    </div>

                                    {/* Viral Badge Overlays */}
                                    <div className="absolute top-2 left-2 z-20">
                                        {getViralBadge(video.viral_score, video.velocity_score)}
                                    </div>

                                    {/* Overlays on Hover */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20 backdrop-blur-[2px]">
                                        <Button size="icon" variant="secondary" className="rounded-full h-9 w-9 bg-white/20 hover:bg-white/40 text-white backdrop-blur-sm border-0 action-btn ring-1 ring-white/30" onClick={() => handlePlayVideo(video)} title="재생">
                                            <Play className="w-4 h-4 fill-current" />
                                        </Button>
                                        <Button size="icon" variant="secondary" className="rounded-full h-9 w-9 bg-red-500/40 hover:bg-red-500/60 text-white backdrop-blur-sm border-0 action-btn ring-1 ring-red-400/30" onClick={(e) => { e.stopPropagation(); const yt = video.url || `https://www.youtube.com/watch?v=${video.video_id}`; if (yt) window.open(yt, '_blank'); }} title="YouTube에서 열기">
                                            <PlaySquare className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="secondary" className="rounded-full h-9 w-9 bg-white/20 hover:bg-white/40 text-white backdrop-blur-sm border-0 action-btn ring-1 ring-white/30" onClick={() => handleViewSubtitle(video)} title="자막">
                                            <FileText className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="secondary" className="rounded-full h-9 w-9 bg-white/20 hover:bg-white/40 text-white backdrop-blur-sm border-0 action-btn ring-1 ring-white/30" onClick={() => setStatsVideo(video)} title="통계">
                                            <LineChart className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="secondary" className="rounded-full h-9 w-9 bg-gradient-to-br from-amber-500/30 to-orange-600/30 hover:from-amber-500/50 hover:to-orange-600/50 text-white backdrop-blur-sm border-0 action-btn ring-1 ring-amber-400/40" onClick={(e) => { e.stopPropagation(); hdDownloadMutation.mutate(video.id); }} title="HD 재다운로드" disabled={hdDownloadMutation.isPending}>
                                            {hdDownloadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                        </Button>
                                        <Button size="icon" variant="secondary" className="rounded-full h-9 w-9 bg-white/20 hover:bg-white/40 text-white backdrop-blur-sm border-0 action-btn ring-1 ring-white/30" onClick={(e) => { e.stopPropagation(); openFolder(video.file_path); }} title="폴더">
                                            <FolderOpen className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    {/* Duration / Format */}
                                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm font-medium tracking-wide">
                                        {video.metadata_json?.is_hd && <span className="text-amber-300 font-bold mr-1">HD</span>}
                                        MP4
                                    </div>
                                </div>

                                {/* Content */}
                                <CardContent className={cn(
                                    "p-4 space-y-3",
                                    video.metadata_json?.is_hd && "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30"
                                )}>
                                    <h3
                                        className="font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5rem] tracking-tight cursor-pointer hover:text-primary transition-colors hover:underline"
                                        title={video.title}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (video.url) window.open(video.url, '_blank');
                                        }}
                                    >
                                        {video.title}
                                    </h3>

                                    <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border pb-2">
                                        <div className="flex items-center gap-1.5 overflow-hidden">
                                            {/* [FIX] Channel Profile Image */}
                                            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border relative">
                                                <img
                                                    src={getMediaUrl(video.channel_id && channelMap[video.channel_id] ? channelMap[video.channel_id].thumbnail_path : null, settings?.root_download_path)}
                                                    alt="Ch"
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        // Fallback to Initial Letter if image fails
                                                        e.currentTarget.style.display = 'none';
                                                        const p = e.currentTarget.parentElement;
                                                        if (p) {
                                                            const chName = video.channel_id && channelMap[video.channel_id] ? channelMap[video.channel_id].name : (video.metadata_json?.uploader || "?");
                                                            p.innerText = chName[0] || '?';
                                                            p.className = "w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0 border border-border";
                                                        }
                                                    }}
                                                />
                                            </div>
                                            {/* [FIX] Prefer Channel Map Name */}
                                            <span className="truncate font-medium text-foreground">
                                                {video.channel_id && channelMap[video.channel_id]
                                                    ? channelMap[video.channel_id].name
                                                    : ((video.metadata_json as any)?.uploader || (video.metadata_json as any)?.channel_name || "Unknown")}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground">
                                            <Calendar className="w-3 h-3" />
                                            <span>{new Date(video.upload_date).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                                        <div className="text-muted-foreground font-medium">조회수</div>
                                        <div className="font-mono text-right font-bold text-foreground">{formatCount(video.view_count ?? video.metadata_json?.view_count)}</div>

                                        <div className="text-muted-foreground font-medium">구독자</div>
                                        <div className="font-mono text-right font-medium text-muted-foreground">
                                            {video.channel_id && channelMap[video.channel_id]
                                                ? formatCount(channelMap[video.channel_id].subscriber_count)
                                                : "-"}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Video Player Modal */}
            <Dialog open={!!playingVideo} onOpenChange={(open) => !open && setPlayingVideo(null)}>
                <DialogContent className={cn(
                    "p-0 overflow-hidden bg-black border-none rounded-xl",
                    (playingVideo?.metadata_json as any)?.embed_url || (playingVideo?.url || playingVideo?.video_id) ? "w-full max-w-[720px]" : "w-full max-w-[380px]"
                )}>
                    <DialogHeader className="sr-only">
                        <DialogTitle>{playingVideo?.title}</DialogTitle>
                    </DialogHeader>
                    {playingVideo && (() => {
                        const meta = playingVideo.metadata_json as any;
                        const embedUrl = meta?.embed_url;
                        const ytUrl = playingVideo.url || `https://www.youtube.com/watch?v=${playingVideo.video_id}`;
                        const localSrc = getMediaUrl(playingVideo.file_path, settings?.root_download_path);
                        const handleYT = () => { if (ytUrl) { window.open(ytUrl, '_blank'); setPlayingVideo(null); } };
                        return (
                            <VideoPlayer
                                src={embedUrl || localSrc}
                                title={playingVideo.title}
                                isYouTube={!!embedUrl}
                                youtubeUrl={embedUrl ? undefined : ytUrl}
                                onYouTubeOpen={handleYT}
                            />
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Subtitle Viewer Modal */}
            <SubtitleViewer
                open={!!subtitleVideo}
                onOpenChange={(open) => !open && setSubtitleVideo(null)}
                videoId={subtitleVideo?.id || null}
                title={subtitleVideo?.title || ''}
                description={(subtitleVideo as any)?.description}
            />

            {/* Stats Graph Modal */}
            <Dialog open={!!statsVideo} onOpenChange={(open) => !open && setStatsVideo(null)}>
                <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle>바이럴 변화 추이</DialogTitle>
                        <DialogDescription>{statsVideo?.title}</DialogDescription>
                    </DialogHeader>
                    <div className="h-[300px] w-full mt-4">
                        {videoHistory && videoHistory.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsLineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                    <XAxis
                                        dataKey="timestamp"
                                        tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        stroke="#888"
                                        fontSize={12}
                                    />
                                    <YAxis yAxisId="left" stroke="#6366f1" fontSize={12} tickFormatter={(val) => formatCount(val)} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={12} tickFormatter={(val) => formatCount(val) + '/h'} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        labelFormatter={(label) => new Date(label).toLocaleString()}
                                    />
                                    <Line yAxisId="left" type="monotone" dataKey="view_count" name="누적 조회수" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    <Line yAxisId="right" type="monotone" dataKey="velocity" name="시간당 조회수 (Vel)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
                                </RechartsLineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                <TrendingUp className="w-8 h-8 mr-2 opacity-50" />
                                데이터가 충분하지 않습니다.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Gallery;
