import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { Video, ScriptAnalysis } from '../../lib/api';
import { X, Sparkles, Loader2, BookOpen, Brain, MessageCircle, PenTool, Wand2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { InsightHeader } from './InsightHeader';
import { ScriptReader } from './ScriptReader';
import { ContextPanel } from './ContextPanel';
import { RemixPanel } from './RemixPanel'; // New component

interface ScriptDetailPanelProps {
    video: Video;
    onClose: () => void;
}

export const ScriptDetailPanel: React.FC<ScriptDetailPanelProps> = ({ video, onClose }) => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("script");

    // Fetch Script Content
    const { data: scriptContent, isLoading: isScriptLoading } = useQuery({
        queryKey: ['scriptContent', video.id],
        queryFn: async () => {
            try {
                const res = await api.get(`/videos/${video.id}/subtitle`);
                return res.data.content;
            } catch (e) {
                return "Script content not available.";
            }
        },
        enabled: !!video.id
    });

    // Fetch Analysis
    const { data: analysis, isLoading: isAnalysisLoading } = useQuery<ScriptAnalysis>({
        queryKey: ['scriptAnalysis', video.id],
        queryFn: async () => (await api.get(`/scripts/${video.id}/analysis`)).data,
        retry: false
    });

    // Run Analysis Mutation
    const analyzeMutation = useMutation({
        mutationFn: () => api.post(`/scripts/${video.id}/analyze`),
        onSuccess: (data) => {
            queryClient.setQueryData(['scriptAnalysis', video.id], data.data);
            toast.success("Analysis Complete!");
        },
        onError: (e: any) => {
            toast.error("Analysis Failed: " + (e.response?.data?.detail || e.message));
        }
    });

    return (
        <div className="fixed inset-y-0 right-0 w-[600px] md:w-[800px] lg:w-[900px] bg-background border-l shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="h-14 border-b flex items-center justify-between px-4 bg-muted/10">
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="font-semibold truncate text-sm text-muted-foreground">Script Lab</span>
                    <span className="font-bold truncate">/ {video.title}</span>
                </div>
                <div className="flex items-center gap-1">
                    {!analysis && !isAnalysisLoading && (
                        <Button
                            variant="default" size="sm"
                            onClick={() => analyzeMutation.mutate()}
                            disabled={analyzeMutation.isPending}
                            className="h-8 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {analyzeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            Run Viral Analysis
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col bg-background">
                {isAnalysisLoading ? (
                    <div className="flex flex-col items-center justify-center h-full">
                        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                        <p className="text-muted-foreground animate-pulse">Analyzing Viral DNA...</p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col h-full">
                        {/* Insight Header (Always visible if analyzed) */}
                        {analysis && <InsightHeader analysis={analysis} video={video} />}

                        {/* Tabs */}
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                            <div className="px-6 pt-2 border-b bg-muted/5">
                                <TabsList className="grid w-full grid-cols-3 max-w-md">
                                    <TabsTrigger value="script" className="gap-2 text-xs"><BookOpen className="w-3 h-3" /> Script Reader</TabsTrigger>
                                    <TabsTrigger value="analysis" className="gap-2 text-xs" disabled={!analysis}><Brain className="w-3 h-3" /> Viral DNA</TabsTrigger>
                                    <TabsTrigger value="remix" className="gap-2 text-xs" disabled={!analysis}><Wand2 className="w-3 h-3" /> Remix Lab</TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-muted/10 p-4 md:p-6">
                                <TabsContent value="script" className="mt-0 h-full">
                                    {isScriptLoading ? <div className="p-8 text-center text-muted-foreground">Loading script...</div> :
                                        <ScriptReader content={scriptContent || ""} analysis={analysis} />
                                    }
                                </TabsContent>
                                <TabsContent value="analysis" className="mt-0 h-full">
                                    {analysis && <ContextPanel analysis={analysis} />}
                                </TabsContent>
                                <TabsContent value="remix" className="mt-0 h-full">
                                    <RemixPanel
                                        originalScript={scriptContent || ""}
                                        analysis={analysis}
                                    />
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>
                )}
            </div>
        </div>
    );
};
