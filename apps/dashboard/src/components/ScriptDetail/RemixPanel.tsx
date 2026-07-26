import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api, { ScriptAnalysis } from '../../lib/api';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Zap, ArrowRight, RotateCcw, Copy, Wand2 } from 'lucide-react';
import { toast } from "sonner";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface RemixPanelProps {
    originalScript: string;
    analysis?: ScriptAnalysis;
}

export const RemixPanel: React.FC<RemixPanelProps> = ({ originalScript, analysis }) => {
    const [instruction, setInstruction] = useState("");
    const [rewrittenScript, setRewrittenScript] = useState("");
    const [mode, setMode] = useState("custom");

    const rewriteMutation = useMutation({
        mutationFn: async (data: { instruction: string }) => {
            const res = await api.post('/scripts/rewrite', {
                original_script: originalScript,
                instruction: data.instruction
            });
            return res.data;
        },
        onSuccess: (data) => {
            setRewrittenScript(data.script);
            toast.success("Script Rewritten Successfully!");
        },
        onError: (e: any) => {
            toast.error("Rewrite Failed: " + e.message);
        }
    });

    const handleQuickAction = (action: string) => {
        let prompt = "";
        switch (action) {
            case "shorten":
                prompt = "Shorten this script for Music/Shorts (under 60s reading time). Keep the hook strong.";
                break;
            case "engaging":
                prompt = "Make the tone more engaging and controversial to increase retention.";
                break;
            case "listicle":
                prompt = "Convert this script into a top 3 listicle format.";
                break;
            case "twitter":
                prompt = "Summarize this script into a 5-tweet thread.";
                break;
        }
        setInstruction(prompt);
        rewriteMutation.mutate({ instruction: prompt });
    };

    return (
        <div className="h-full flex flex-col gap-4">
            {/* AI Controls */}
            <div className="bg-card border rounded-lg p-4 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    <Button variant="outline" size="sm" onClick={() => handleQuickAction('shorten')} className="whitespace-nowrap">
                        <Zap className="w-3 h-3 mr-1 text-yellow-500" /> Shorten (Music)
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleQuickAction('engaging')} className="whitespace-nowrap">
                        <Zap className="w-3 h-3 mr-1 text-red-500" /> Max Engagement
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleQuickAction('listicle')} className="whitespace-nowrap">
                        <Zap className="w-3 h-3 mr-1 text-blue-500" /> Listicle Format
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleQuickAction('twitter')} className="whitespace-nowrap">
                        <Zap className="w-3 h-3 mr-1 text-sky-500" /> MessageCircle Thread
                    </Button>
                </div>

                <div className="flex gap-2">
                    <Textarea
                        placeholder="Enter custom instructions for AI (e.g. 'Rewrite this about Quantum Physics instead of AI')"
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        className="resize-none h-20 text-sm"
                    />
                    <Button
                        className="h-20 w-32 flex flex-col gap-1 bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => rewriteMutation.mutate({ instruction })}
                        disabled={!instruction || rewriteMutation.isPending}
                    >
                        {rewriteMutation.isPending ? <Loader2 className="animate-spin" /> : <Wand2 className="w-5 h-5" />}
                        <span className="text-xs">Rewrite</span>
                    </Button>
                </div>
            </div>

            {/* Split View */}
            <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                {/* Source */}
                <Card className="flex flex-col min-h-0 border-muted bg-muted/20">
                    <CardHeader className="py-2 px-4 border-b bg-muted/40 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Original Source</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 min-h-0">
                        <ScrollArea className="h-full p-4">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{originalScript}</p>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Result */}
                <Card className="flex flex-col min-h-0 border-indigo-200 bg-white shadow-sm ring-1 ring-indigo-50">
                    <CardHeader className="py-2 px-4 border-b bg-indigo-50/50 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-2">
                            <Sparkles className="w-3 h-3" /> AI Draft
                        </CardTitle>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(rewrittenScript); toast.success("Copied!") }}>
                                <Copy className="w-3 h-3" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 min-h-0 relative group">
                        {rewriteMutation.isPending && (
                            <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm">
                                <div className="text-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
                                    <p className="text-xs text-indigo-600 font-medium animate-pulse">Forging new content...</p>
                                </div>
                            </div>
                        )}
                        <ScrollArea className="h-full p-4">
                            {rewrittenScript ? (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground font-medium">{rewrittenScript}</p>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-xs italic">
                                    Select an option or enter an instruction to generate a rewritten script.
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
