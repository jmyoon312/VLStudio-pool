import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { Video } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Copy, Languages, BarChart2, FileJson, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SubtitleAnalysisPanelProps {
    video: Video | null;
    onClose: () => void;
}

export const SubtitleAnalysisPanel: React.FC<SubtitleAnalysisPanelProps> = ({ video, onClose }) => {
    if (!video) return null;

    const { data: analysis, isLoading: isAnalysisLoading } = useQuery({
        queryKey: ['videoAnalysis', video.id],
        queryFn: async () => {
            const res = await api.get(`/videos/${video.id}/analysis`);
            return res.data;
        },
        enabled: !!video,
    });

    const { data: subtitles, isLoading: isSubsLoading } = useQuery({
        queryKey: ['videoSubtitles', video.id],
        queryFn: async () => {
            const res = await api.get(`/videos/${video.id}/subtitles`);
            return res.data;
        },
        enabled: !!video,
    });

    // Chart Data
    const sentimentData = analysis ? [
        { name: 'Positive', value: analysis.sentiment_score * 100, color: '#22c55e' }, // green-500
        { name: 'Negative', value: (1 - analysis.sentiment_score) * 100, color: '#ef4444' } // red-500
    ] : [];

    const keywordData = analysis?.top_keywords?.slice(0, 10) || [];

    const handleCopy = () => {
        if (subtitles?.content) {
            navigator.clipboard.writeText(subtitles.content);
            // toast success
        }
    };

    return (
        <div className="h-full flex flex-col bg-background border-l shadow-xl w-[450px] fixed right-0 top-0 bottom-0 z-50">
            {/* Header */}
            <div className="p-4 border-b flex items-start justify-between bg-muted/30">
                <div className="space-y-1">
                    <h2 className="font-semibold leading-tight line-clamp-2">{video.title}</h2>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{video.is_script_only ? "Script" : "Video"}</Badge>
                        <span>{analysis?.word_count?.toLocaleString()} words</span>
                        {analysis?.sentiment_label && (
                            <Badge variant={analysis.sentiment_label === 'Positive' ? 'default' : analysis.sentiment_label === 'Negative' ? 'destructive' : 'secondary'} className="text-[10px] h-5">
                                {analysis.sentiment_label}
                            </Badge>
                        )}
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* AI Insight Card (Mock) */}
            <div className="p-4 bg-primary/5">
                <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-primary">
                    <span className="text-lg">✨</span> AI Insight
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    This content focuses heavily on <strong>{keywordData[0]?.text || "topics"}</strong>.
                    The overall sentiment appears <strong>{analysis?.sentiment_label || "neutral"}</strong> based on keyword usage.
                    Consider exploring related content about <strong>{keywordData[1]?.text || "..."}</strong>.
                </p>
            </div>

            {/* Content */}
            <Tabs defaultValue="reading" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 border-b">
                    <TabsList className="w-full justify-start h-10 bg-transparent p-0">
                        <TabsTrigger value="reading" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-2 pt-1.5 text-xs font-medium text-muted-foreground data-[state=active]:text-foreground">
                            Reading Mode
                        </TabsTrigger>
                        <TabsTrigger value="analysis" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-2 pt-1.5 text-xs font-medium text-muted-foreground data-[state=active]:text-foreground">
                            Meta Analysis
                        </TabsTrigger>
                        <TabsTrigger value="raw" className="h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-2 pt-1.5 text-xs font-medium text-muted-foreground data-[state=active]:text-foreground">
                            Raw Data
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="reading" className="flex-1 overflow-hidden p-0 m-0 relative group">
                    <ScrollArea className="h-full">
                        <div className="p-6 text-sm leading-7 whitespace-pre-wrap font-serif text-foreground/90">
                            {isSubsLoading ? (
                                <div className="space-y-2 animate-pulse">
                                    <div className="h-4 bg-muted rounded w-3/4"></div>
                                    <div className="h-4 bg-muted rounded w-full"></div>
                                    <div className="h-4 bg-muted rounded w-5/6"></div>
                                </div>
                            ) : subtitles?.content ? (
                                subtitles.content
                            ) : (
                                <div className="text-center text-muted-foreground py-10">No subtitles available for reading.</div>
                            )}
                        </div>
                    </ScrollArea>
                    {/* Floating Actions */}
                    <div className="absolute bottom-6 right-6 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" className="rounded-full shadow-lg h-10 w-10" onClick={handleCopy} title="Copy Text">
                            <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="secondary" className="rounded-full shadow-lg h-10 w-10" title="Translate (Coming Soon)">
                            <Languages className="h-4 w-4" />
                        </Button>
                    </div>
                </TabsContent>

                <TabsContent value="analysis" className="flex-1 overflow-auto p-4 space-y-6 m-0">
                    {/* Keywords Chart */}
                    <Card>
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-sm font-medium">Top Keywords</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[200px] p-4 pt-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={keywordData} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="text" width={60} tick={{ fontSize: 10 }} interval={0} />
                                    <Tooltip contentStyle={{ fontSize: '12px', padding: '4px 8px' }} />
                                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={12} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Sentiment Chart */}
                    <Card>
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-sm font-medium">Sentiment Distribution</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[200px] p-4 pt-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={sentimentData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={70}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {sentimentData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex justify-center gap-4 text-xs mt-2">
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Positive</div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Negative</div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="raw" className="flex-1 overflow-auto p-4 m-0">
                    <pre className="text-[10px] bg-muted p-2 rounded overflow-auto h-full text-muted-foreground font-mono">
                        {JSON.stringify(video.metadata_json, null, 2)}
                    </pre>
                </TabsContent>
            </Tabs>
        </div>
    );
}
