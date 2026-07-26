import React, { useState, useRef, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import {
    Clock,
    TrendingUp,
    Eye,
    CheckCircle2,
    MoreVertical,
    Play,
    FileText,
    Users
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { resolveFileUrl } from "@/utils/fileUrl";

export interface VideoAsset {
    id: number;
    title: string;
    thumbnail_path?: string;
    thumbnail_url?: string;
    file_path?: string;
    duration: number;
    viral_score: number;
    velocity_score: number;
    view_count: number;
    upload_date: string;
    channel?: {
        name: string;
        thumbnail_url?: string;
        thumbnail_path?: string;
        subscriber_count?: number;
    };
    metadata_json?: any;
    upload_status?: string;
}

interface VideoAssetCardProps {
    video: VideoAsset;
    selected: boolean;
    onClick: () => void;
    onDetail?: () => void;
    onGraphClick?: () => void;
    onViewSubtitle?: (video: VideoAsset) => void; // [NEW]
}

import ViralBadges from '@/components/ViralBadges';

// ... (imports)

// ... (interface VideoAssetCardProps)

const VideoAssetCard: React.FC<VideoAssetCardProps> = ({ video, selected, onClick, onDetail, onGraphClick, onViewSubtitle }) => {
    const [isHovered, setIsHovered] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [imgError, setImgError] = useState(false);

    // Formatting
    const formatCount = (num: number) => {
        if (!num) return '0';
        if (num >= 10000) return `${(num / 10000).toFixed(1)}만`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}천`;
        return num.toString();
    };

    const formatDuration = (seconds: number) => {
        if (!seconds) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Hover Video Preview Logic
    useEffect(() => {
        if (!videoRef.current) return;

        if (isHovered && video.file_path) {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => { });
            }
            videoRef.current.playbackRate = 2.0;
        } else {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
            // Optionally load? No need.
        }
    }, [isHovered, video.file_path]);

    const thumbnailSrc = resolveFileUrl(video.thumbnail_path || video.thumbnail_url);
    const videoSrc = resolveFileUrl(video.file_path);

    return (
        <div
            className={cn(
                "group relative w-full aspect-[16/9] rounded-xl cursor-pointer transition-all duration-200 select-none overflow-hidden bg-slate-100",
                selected ? "ring-4 ring-blue-500 shadow-xl scale-[1.02] z-10" : "hover:scale-[1.01] hover:shadow-lg ring-1 ring-slate-200"
            )}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Media Layer */}
            {isHovered && video.file_path ? (
                <video
                    ref={videoRef}
                    src={videoSrc}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                />
            ) : (
                imgError ? (
                    <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex flex-col items-center justify-center p-4">
                        <div className="w-10 h-10 rounded-full bg-slate-400 flex items-center justify-center mb-2">
                            {video.channel?.thumbnail_url ? (
                                <img src={video.channel.thumbnail_url} className="w-full h-full object-cover rounded-full opacity-50" />
                            ) : (
                                <Play className="w-5 h-5 text-white" />
                            )}
                        </div>
                        <span className="text-[10px] text-slate-500">이미지 없음</span>
                    </div>
                ) : (
                    <img
                        src={thumbnailSrc}
                        alt={video.title}
                        className="w-full h-full object-cover transition-opacity"
                        onError={() => setImgError(true)}
                    />
                )
            )}

            {/* Gradient Overlay for Text Readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

            {/* Overlays */}

            {/* Top Left: Viral Badges + Subtitle Button */}
            <div className="absolute top-2 left-2 z-20 flex flex-col gap-1.5 items-start">
                <ViralBadges
                    viralScore={video.viral_score}
                    velocity={video.velocity_score}
                    onClick={onGraphClick}
                />

                {onViewSubtitle && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onViewSubtitle(video); }}
                        className="flex items-center gap-1 bg-black/60 hover:bg-black/80 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-sm cursor-pointer transition-colors border border-slate-200 shadow-sm"
                        title="자막 보기"
                    >
                        <FileText className="w-3 h-3 text-indigo-300" />
                        <span className="font-medium">자막 보기</span>
                    </div>
                )}
            </div>

            {/* Selected Indicator */}
            {selected && (
                <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1 shadow-md animate-in zoom-in duration-200 z-10">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
            )}

            {/* Overlay Buttons (Subtitle, Detail) - Always show on hover if handlers exist */}
            <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">

                {onDetail && !selected && (
                    <div className="bg-black/40 hover:bg-black/60 rounded-full p-1 cursor-pointer backdrop-blur-sm shadow-sm"
                        onClick={(e) => { e.stopPropagation(); onDetail(); }}>
                        <MoreVertical className="w-4 h-4 text-white" />
                    </div>
                )}
            </div>



            {/* Bottom Right: Duration */}
            <div className="absolute bottom-14 right-2 flex items-center gap-1 text-white text-[10px] bg-black/70 px-1.5 py-0.5 rounded backdrop-blur-sm font-mono">
                <Clock className="w-3 h-3" />
                <span>{formatDuration(video.duration || 0)}</span>
            </div>

            {/* Metadata Area (Bottom Panel) */}
            <div className="absolute bottom-0 left-0 right-0 p-3 pt-6 bg-gradient-to-t from-black via-black/80 to-transparent">
                <h3 className="text-white text-sm font-semibold line-clamp-1 mb-1 leading-tight" title={video.title}>
                    {video.title}
                </h3>

                <div className="flex items-center justify-between text-[10px] text-slate-700">
                    {/* Channel */}
                    <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-4 h-4 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">
                            {resolveFileUrl(video.channel?.thumbnail_path || video.channel?.thumbnail_url) ? (
                                <img src={resolveFileUrl(video.channel?.thumbnail_path || video.channel?.thumbnail_url)} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-indigo-500 flex items-center justify-center text-[8px]">
                                    {(video.channel?.name || video.metadata_json?.uploader || "?")[0]}
                                </div>
                            )}
                        </div>
                        <span className="truncate max-w-[80px]">
                            {video.channel?.name || video.metadata_json?.uploader || "Unknown"}
                        </span>
                        <span className="text-slate-500">•</span>
                        <span>{video.upload_date ? new Date(video.upload_date).toLocaleDateString() : '-'}</span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-2 flex-shrink-0 font-medium">
                        <div className="flex items-center gap-0.5" title="구독자 수">
                            <Users className="w-3 h-3 text-slate-600" />
                            <span>{formatCount(video.channel?.subscriber_count || 0)}</span>
                        </div>
                        <div className="flex items-center gap-0.5" title="조회수">
                            <Eye className="w-3 h-3 text-slate-600" />
                            <span>{formatCount(video.view_count || 0)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoAssetCard;
