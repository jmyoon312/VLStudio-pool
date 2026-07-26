import React, { useState, useRef, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import {
    FileText,
    CheckCircle2,
    TrendingUp,
    Users,
    Eye,
    MoreVertical
} from 'lucide-react';
import { cn } from "@/lib/utils";
import ViralBadges from '@/components/ViralBadges';

// ----------------------------------------------------------------------
// Types (비디오와 동일한 데이터 구조 지원)
// ----------------------------------------------------------------------
export interface ScriptAsset {
    id: number;
    filename: string;
    content?: string;
    created_at?: string;
    upload_date?: string;
    title?: string;
    viral_score?: number;
    velocity_score?: number;
    view_count?: number;
    channel?: {
        name: string;
        thumbnail_url?: string;
        subscriber_count?: number;
    };
    // Legacy support
    video?: {
        viral_score?: number;
        title?: string;
    };
}

interface ScriptAssetCardProps {
    script: ScriptAsset;
    selected: boolean;
    onClick: () => void;
    onDetail?: () => void;
    onGraphClick?: () => void; // 그래프 클릭 핸들러
    onViewSubtitle?: (script: ScriptAsset) => void; // [NEW] 자막(스크립트) 보기 핸들러
}

// ----------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------

const formatCount = (num: number | undefined) => {
    if (!num) return '0';
    if (num >= 10000) return `${(num / 10000).toFixed(1)}만`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}천`;
    return num.toLocaleString();
};

const ScriptAssetCard: React.FC<ScriptAssetCardProps> = ({
    script,
    selected,
    onClick,
    onDetail,
    onGraphClick,
    onViewSubtitle // [NEW]
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const textRef = useRef<HTMLDivElement>(null);
    const scrollInterval = useRef<any>(null);

    // Data Resolution
    const viralScore = script.viral_score || script.video?.viral_score || 0;
    const velocityScore = script.velocity_score || 0;
    const title = script.title || script.filename;
    const wordCount = script.content ? script.content.length : 0;

    // ------------------------------------------------------------------
    // Auto Scroll Logic (마우스 오버 시 텍스트 자동 스크롤)
    // ------------------------------------------------------------------
    useEffect(() => {
        if (isHovered && textRef.current) {
            const el = textRef.current;
            const scrollSpeed = 0.5; // 속도 조절 (부드럽게)

            scrollInterval.current = setInterval(() => {
                if (el) {
                    // 바닥에 닿으면 멈춤? 아니면 계속?
                    if (el.scrollTop + el.clientHeight >= el.scrollHeight) {
                        // Optional: Reset to top?
                    } else {
                        el.scrollTop += scrollSpeed;
                    }
                }
            }, 30);
        } else {
            if (scrollInterval.current) clearInterval(scrollInterval.current);
            if (textRef.current) textRef.current.scrollTop = 0; // Reset on leave
        }

        return () => {
            if (scrollInterval.current) clearInterval(scrollInterval.current);
        };
    }, [isHovered]);

    return (
        <div
            className={cn(
                "group relative w-full aspect-video h-full min-h-0 rounded-xl cursor-pointer transition-all duration-200 select-none overflow-hidden bg-slate-100",
                selected ? "ring-4 ring-blue-500 shadow-xl scale-[1.02] z-10" : "hover:scale-[1.01] hover:shadow-lg ring-1 ring-slate-200"
            )}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* 1. Content Layer (Background) - Z-0 */}
            <div className="absolute inset-0 bg-[#f8f9fa] z-0 p-5">
                {/* Background Icon Watermark */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none">
                    <FileText className="w-32 h-32 text-black" />
                </div>

                {/* Scrollable Text Area (Ref Here) */}
                <div
                    ref={textRef}
                    className={cn(
                        "h-full w-full overflow-y-auto scrollbar-hide text-[11px] text-slate-700 leading-relaxed font-medium font-sans whitespace-pre-wrap break-all pb-14", // pb-14 to clear footer visual area if scrolling to bottom
                    )}
                >
                    {script.content || "스크립트 내용이 없습니다.\n(자막 분석이 필요합니다)"}
                </div>
            </div>

            {/* 2. Top Gradient Overlay - Z-10 */}
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/50 to-transparent pointer-events-none z-10" />

            {/* 3. Badges (Top Left) */}
            <div className="absolute top-2 left-2 z-20 pointer-events-auto flex flex-col gap-1.5 items-start">
                <ViralBadges
                    viralScore={viralScore}
                    velocity={velocityScore}
                    onClick={onGraphClick}
                />

                {onViewSubtitle && (
                    <div
                        onClick={(e) => { e.stopPropagation(); onViewSubtitle(script); }}
                        className="flex items-center gap-1 bg-black/60 hover:bg-black/80 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-sm cursor-pointer transition-colors border border-slate-200 shadow-sm"
                        title="스크립트 보기"
                    >
                        <FileText className="w-3 h-3 text-orange-300" />
                        <span className="font-medium">스크립트 보기</span>
                    </div>
                )}
            </div>

            {/* Selected Indicator - Z-30 */}
            {selected && (
                <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1 shadow-md animate-in zoom-in duration-200 z-30 pointer-events-none">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
            )}

            {/* Context Menu Button (Hover Only) - Z-30 - Interactable */}
            {!selected && onDetail && (
                <div className="absolute top-2 right-2 bg-black/40 hover:bg-black/60 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-auto"
                    onClick={(e) => { e.stopPropagation(); onDetail(); }}>
                    <MoreVertical className="w-4 h-4 text-white" />
                </div>
            )}

            {/* 4. Text Length Indicator (Duration Equivalent) - Z-20 - Non-interactive */}
            <div className="absolute bottom-16 right-2 z-20 pointer-events-none">
                <div className="flex items-center gap-1 text-white text-[10px] bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm font-mono border border-slate-200">
                    <span className="text-xs">T</span>
                    <span>{wordCount.toLocaleString()}자</span>
                </div>
            </div>

            {/* 5. Footer Metadata (Overlay) - Z-20 - Non-interactive for now (just display) */}
            <div className="absolute bottom-0 left-0 right-0 p-3 pt-10 bg-gradient-to-t from-black via-black/80 to-transparent z-20 pointer-events-none">
                {/* Title */}
                <h3 className="text-white text-sm font-semibold line-clamp-1 mb-1 leading-tight" title={title}>
                    <FileText className="inline-block w-3.5 h-3.5 mr-1.5 text-blue-400 align-text-bottom" />
                    {title}
                </h3>

                {/* Channel & Stats Row */}
                <div className="flex items-center justify-between text-[10px] text-slate-700">
                    {/* Channel Info */}
                    <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-4 h-4 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">
                            {script.channel?.thumbnail_url ? (
                                <img src={script.channel.thumbnail_url} className="w-full h-full object-cover" alt="" />
                            ) : (
                                <div className="w-full h-full bg-indigo-500 flex items-center justify-center text-[8px] text-white">
                                    {(script.channel?.name || "S")[0]}
                                </div>
                            )}
                        </div>
                        <span className="truncate max-w-[80px]">
                            {script.channel?.name || "Unknown"}
                        </span>
                        <span className="text-slate-500">•</span>
                        <span>
                            {script.upload_date ? new Date(script.upload_date).toLocaleDateString() : '-'}
                        </span>
                    </div>

                    {/* Stats Icons */}
                    <div className="flex items-center gap-2 flex-shrink-0 font-medium">
                        <div className="flex items-center gap-0.5" title="구독자 수">
                            <Users className="w-3 h-3 text-slate-600" />
                            <span>{formatCount(script.channel?.subscriber_count)}</span>
                        </div>
                        <div className="flex items-center gap-0.5" title="조회수">
                            <Eye className="w-3 h-3 text-slate-600" />
                            <span>{formatCount(script.view_count)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScriptAssetCard;