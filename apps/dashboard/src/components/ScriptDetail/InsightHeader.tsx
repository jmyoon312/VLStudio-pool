import React from 'react';
import { ScriptAnalysis, Video } from '../../lib/api';
import { Gauge, TrendingUp, Activity, MessageSquare } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface InsightHeaderProps {
    analysis: ScriptAnalysis;
    video: Video;
}

export const InsightHeader: React.FC<InsightHeaderProps> = ({ analysis, video }) => {
    // Determine Color based on score
    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-red-500"; // Fire
        if (score >= 50) return "text-orange-500";
        return "text-blue-500";
    };

    return (
        <Card className="bg-gradient-to-r from-muted/50 to-muted/10 border-none shadow-sm mb-6">
            <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">

                    {/* Viral Score Gauge */}
                    <div className="flex flex-col items-center justify-center min-w-[120px]">
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            {/* Simple circular visualization using CSS or SVG could act as gauge */}
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-muted/30" />
                                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent"
                                    className={getScoreColor(analysis.viral_score)}
                                    strokeDasharray={251.2}
                                    strokeDashoffset={251.2 - (251.2 * analysis.viral_score) / 100}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute flex flex-col items-center">
                                <span className={`text-2xl font-bold ${getScoreColor(analysis.viral_score)}`}>{analysis.viral_score}</span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">VIRAL</span>
                            </div>
                        </div>
                    </div>

                    {/* Summary & Tags */}
                    <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                                ⚡ 흥행 분석 리포트
                            </h2>
                            <Badge variant="outline" className="text-[10px]">{analysis.tone}</Badge>
                        </div>

                        <p className="text-sm font-medium leading-relaxed text-foreground/90">
                            "{analysis.summary_one_line}"
                        </p>

                        <div className="flex flex-wrap gap-2 pt-1">
                            {analysis.keywords.map((k, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] bg-secondary/50 hover:bg-secondary">
                                    #{k}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Metrics Stats */}
                    <div className="grid grid-cols-2 gap-4 min-w-[180px] border-l pl-6">
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Activity className="w-3 h-3" /> 감성 지수
                            </span>
                            <div className="font-semibold text-sm">
                                {analysis.sentiment_label} ({Math.round(analysis.sentiment_score * 100)}%)
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" /> 훅(Hook) 강도
                            </span>
                            <div className="font-semibold text-sm">
                                {analysis.hooks.length > 0 ? "강함" : "보통"}
                            </div>
                        </div>
                    </div>

                </div>
            </CardContent>
        </Card>
    );
};
