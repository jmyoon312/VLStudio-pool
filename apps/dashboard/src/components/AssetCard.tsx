import React, { useState, useRef, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Clock,
    TrendingUp,
    Eye,
    Users,
    Play,
    MoreVertical,
    CheckCircle2
} from 'lucide-react';
import { cn } from "@/lib/utils";

interface VideoAsset {
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
        subscriber_count?: number;
    };
    metadata_json?: any;
    upload_status?: string;
}

interface AssetCardProps {
    video: VideoAsset;
    selected: boolean;
    onClick: () => void;
    onDetail?: () => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ video, selected, onClick, onDetail }) => {
    const [isHovered, setIsHovered] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Initial Grade Calculation
    const getGrade = (score: number) => {
        if (score >= 100) return { label: 'S등급', color: 'bg-red-500' };
        if (score >= 80) return { label: 'A등급', color: 'bg-orange-500' };
        if (score >= 50) return { label: 'B등급', color: 'bg-green-500' };
        return { label: 'C등급', color: 'bg-slate-400' };
    };

    const grade = getGrade(video.viral_score);

    // Formatting
    const formatCount = (num: number) => {
        if (num >= 10000) return `${(num / 10000).toFixed(1)}만`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}천`;
        return num.toString();
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Hover Video Preview Logic
    useEffect(() => {
        if (!videoRef.current) return;

        if (isHovered && video.file_path) {
            // Play 2x speed
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => { });
            }
            videoRef.current.playbackRate = 2.0;
        } else {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    }, [isHovered, video.file_path]);

    // Use Web URL for thumbnail/video if file_path is local (adjust based on your serving setup)
    // Assuming backend serves /uploads or /media. 
    // For now assuming full URLs or handled by <img src>.
    // If local file path, frontend needs a way to access it. 
    // Usually via a valid static file server. 
    // I'll use the `video.thumbnail_path` or `video.thumbnail_url`.
    // NOTE: In previous context, we might need a transform function.
    // For this implementation, I will rely on standard `src`.

    // Quick fix for local images
    const getSrc = (path?: string) => {
        if (!path) return "/placeholder.jpg";
        if (path.startsWith("http")) return path;
        // Adjust this if you serve static files differently
        // Example: /api/static/...
        // I will assume the component consumer passes valid URLs or browser can resolve defaults ?
        // Or better, use a placeholder if invalid.
        return path;
    };

    return (
        <div
            className={cn(
                "group relative w-full aspect-[16/9] rounded-xl cursor-pointer transition-all duration-200 select-none",
                selected ? "ring-4 ring-green-500 shadow-xl scale-[1.02] z-10" : "hover:scale-[1.02] hover:shadow-lg ring-1 ring-slate-200"
            )}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Main Container */}
            <div className="absolute inset-0 rounded-xl overflow-hidden bg-white">
                {/* Image / Video Layer */}
                {isHovered && video.file_path ? (
                    <video
                        ref={videoRef}
                        src={`/stream?path=${encodeURIComponent(video.file_path)}`} // Assuming stream endpoint exists or direct file access
                        className="w-full h-full object-cover"
                        muted
                        loop
                        playsInline
                    />
                ) : (
                    <img
                        src={`/stream?path=${encodeURIComponent(video.thumbnail_path || "")}`}
                        alt={video.title}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/320x180?text=No+Preview'; }}
                    />
                )}

                {/* Gradient Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

                {/* Overlays */}

                {/* Top Left: Score Badge */}
                <div className="absolute top-2 left-2 flex gap-1">
                    <Badge className={cn("text-[10px] font-bold px-2 py-0.5 shadow-sm border-0", grade.color)}>
                        {grade.label} {Math.round(video.viral_score)}%
                    </Badge>
                </div>

                {/* Selected Indicator */}
                {selected && (
                    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1 shadow-md animate-in zoom-in duration-200">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                )}

                {!selected && onDetail && (
                    <div className="absolute top-2 right-2 bg-black/40 hover:bg-black/60 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); onDetail(); }}>
                        <MoreVertical className="w-4 h-4 text-white" />
                    </div>
                )}


                {/* Bottom Left: Velocity */}
                <div className="absolute bottom-16 left-2 flex items-center gap-1.5 text-green-400 font-bold text-xs bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
                    <TrendingUp className="w-3 h-3" />
                    <span>↗ {formatCount(video.velocity_score)}/hr</span>
                </div>

                {/* Bottom Right: Duration */}
                <div className="absolute bottom-16 right-2 flex items-center gap-1 text-white text-[10px] bg-black/70 px-1.5 py-0.5 rounded backdrop-blur-sm font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{formatDuration(video.duration)}</span>
                </div>

                {/* Metadata Area (Bottom Panel) */}
                <div className="absolute bottom-0 left-0 right-0 p-3 pt-6 bg-gradient-to-t from-black to-transparent">
                    <h3 className="text-white text-sm font-semibold line-clamp-1 mb-1 leading-tight" title={video.title}>
                        {video.title}
                    </h3>

                    <div className="flex items-center justify-between text-[10px] text-slate-700">
                        {/* Channel */}
                        <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-4 h-4 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">
                                {video.channel?.thumbnail_url ? (
                                    <img src={video.channel.thumbnail_url} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-indigo-500 flex items-center justify-center text-[8px]">C</div>
                                )}
                            </div>
                            <span className="truncate max-w-[80px]">{video.channel?.name || "Unknown"}</span>
                            <span className="text-slate-500">•</span>
                            <span>{new Date(video.upload_date).toLocaleDateString()}</span>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-2 flex-shrink-0 font-medium">
                            <div className="flex items-center gap-0.5" title="Subscribers">
                                <Users className="w-3 h-3 text-slate-600" />
                                <span>{formatCount(video.channel?.subscriber_count || 0)}</span>
                            </div>
                            <div className="flex items-center gap-0.5" title="Views">
                                <Eye className="w-3 h-3 text-slate-600" />
                                <span>{formatCount(video.view_count)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetCard;
