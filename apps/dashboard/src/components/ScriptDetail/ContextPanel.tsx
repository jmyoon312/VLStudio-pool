import React from 'react';
import { ScriptAnalysis } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Target, Hash, Layers } from 'lucide-react';

interface ContextPanelProps {
    analysis: ScriptAnalysis;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({ analysis }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full overflow-auto p-1">

            {/* Left Col: Hooks & Structure */}
            <div className="space-y-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Target className="w-4 h-4 text-red-500" />
                            Hooks (First 5s)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                        {analysis.hooks.length > 0 ? (
                            analysis.hooks.map((hook, i) => (
                                <div key={i} className="bg-muted/30 p-3 rounded-md border-l-2 border-red-500">
                                    <div className="flex justify-between items-center mb-1">
                                        <Badge variant="outline" className="text-[10px] border-red-200 text-red-700 bg-red-50">
                                            {hook.type}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground">00:00 - 00:05</span>
                                    </div>
                                    <p className="text-sm font-medium">"{hook.text}"</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">No strong hook detected.</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-yellow-500" />
                            Core Message
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <p className="text-sm leading-7 whitespace-pre-line text-muted-foreground">
                            {analysis.summary_three_lines || analysis.summary_one_line}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Right Col: Structure & Audience */}
            <div className="space-y-6">
                {/* Structure Breakdown (New) */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Layers className="w-4 h-4 text-indigo-500" />
                            Structure Analysis
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                        {analysis.structure_breakdown ? (
                            <div className="space-y-3">
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Introduction (10%)</span>
                                    <p className="text-sm text-slate-700">{analysis.structure_breakdown.intro || "N/A"}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Body (80%)</span>
                                    <p className="text-sm text-slate-700">{analysis.structure_breakdown.body || "N/A"}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Conclusion (10%)</span>
                                    <p className="text-sm text-slate-700">{analysis.structure_breakdown.conclusion || "N/A"}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Structure analysis not available. Run re-analysis.</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Hash className="w-4 h-4 text-blue-500" />
                            Audience Reaction
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground">Predicted Best Comment</label>
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg text-sm text-blue-800 dark:text-blue-200 italic">
                                "{analysis.audience_reaction?.best_comment || 'N/A'}"
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground">Engagement Trigger</label>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {analysis.audience_reaction?.predicted_comments || 'N/A'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
