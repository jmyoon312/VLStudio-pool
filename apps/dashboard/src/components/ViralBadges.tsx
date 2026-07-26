import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Flame, Zap, TrendingUp } from 'lucide-react';
import { cn } from "@/lib/utils";

interface ViralBadgesProps {
    viralScore?: number;
    velocity?: number;
    className?: string;
    onClick?: () => void;
}

const ViralBadges: React.FC<ViralBadgesProps> = ({ viralScore = 0, velocity = 0, className, onClick }) => {

    // Viral Score Badges
    const renderScoreBadge = () => {
        if (viralScore >= 300) {
            return (
                <Badge className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white gap-1 text-[11px] h-6 px-2 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)] border-0 ring-1 ring-white/20">
                    <Flame className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300" />
                    <span className="font-bold">S등급</span> {viralScore.toFixed(0)}%
                </Badge>
            );
        } else if (viralScore >= 100) {
            return (
                <Badge className="bg-orange-500 hover:bg-orange-600 text-white gap-1 text-[11px] h-6 px-2 shadow-sm border-orange-400">
                    <Zap className="w-3.5 h-3.5 fill-white" />
                    <span className="font-bold">A등급</span> {viralScore.toFixed(0)}%
                </Badge>
            );
        } else if (viralScore >= 30) {
            return (
                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1 text-[11px] h-6 px-2 border-emerald-400 shadow-sm">
                    <span className="text-white font-bold text-xs">🌱</span>
                    <span className="font-bold">B등급</span> {viralScore.toFixed(0)}%
                </Badge>
            );
        } else {
            return (
                <Badge variant="secondary" className="gap-1 text-[11px] h-6 px-2 bg-slate-100/90 backdrop-blur text-slate-500 border-slate-200">
                    <span className="text-slate-600">☁️</span> C등급 {viralScore.toFixed(1)}%
                </Badge>
            );
        }
    };

    // Velocity Badge
    const renderVelocityBadge = () => {
        if (velocity <= 0) return null;

        const isHighVelocity = velocity > 1000;
        return (
            <Badge className={cn(
                "gap-1 text-[11px] h-6 px-2 border transition-all",
                isHighVelocity
                    ? "bg-indigo-600 text-white animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)] border-indigo-500"
                    : "bg-blue-50/90 backdrop-blur text-blue-600 border-blue-200"
            )}>
                <TrendingUp className={cn("w-3.5 h-3.5", isHighVelocity && "fill-white")} />
                {velocity > 1000 ? (velocity / 1000).toFixed(1) + 'K' : velocity.toFixed(0)}/hr
            </Badge>
        );
    };

    return (
        <div
            className={cn("flex flex-col gap-1.5 items-start", className, onClick && "cursor-pointer hover:scale-105 transition-transform active:scale-95")}
            onClick={(e) => {
                if (onClick) {
                    e.stopPropagation();
                    onClick();
                }
            }}
        >
            {renderScoreBadge()}
            {renderVelocityBadge()}
        </div>
    );
};

export default ViralBadges;
