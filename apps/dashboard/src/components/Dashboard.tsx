import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { Channel, Settings } from '../lib/api';
import { 
    Activity, Download, HardDrive, Users, PlayCircle, AlertCircle, 
    CheckCircle2, XCircle, FileText, ChevronRight, Flame, Zap, 
    TrendingUp, Database, BrainCircuit 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, getMediaUrl } from "@/lib/utils";
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from 'framer-motion';
import CognitiveTrace from './CognitiveTrace';

const Dashboard = () => {
    const navigate = useNavigate();

    const { data: channels } = useQuery<Channel[]>({
        queryKey: ['channels'],
        queryFn: async () => (await api.get('/channels/')).data
    });

    const { data: stats } = useQuery({
        queryKey: ['dashboardStats'],
        queryFn: async () => (await api.get('/dashboard/stats')).data
    });

    const { data: settings } = useQuery<Settings>({
        queryKey: ['settings'],
        queryFn: async () => (await api.get('/settings/')).data
    });

    const totalChannels = stats?.total_channels || 0;
    const activeChannels = stats?.active_channels || 0;
    const totalVideos = stats?.total_videos || 0;
    const downloadedToday = stats?.downloaded_today || 0;
    const recentDownloads = stats?.recent_videos || [];
    const recentScripts = stats?.recent_scripts || [];

    const formatCount = (num: number | undefined) => {
        if (num === undefined || num === null) return '-';
        return new Intl.NumberFormat('ko-KR', { notation: "compact", maximumFractionDigits: 1 }).format(num);
    };

    const getViralBadge = (viralScore: number | undefined, velocity: number | undefined) => {
        const score = viralScore || 0;
        const vel = velocity || 0;
        const badges = [];

        if (score >= 300) {
            badges.push(
                <Badge key="viral" className="bg-gradient-to-r from-red-500 to-rose-600 border-0 text-white gap-1 text-[10px] h-5 px-1.5 whitespace-nowrap">
                    <Flame className="w-3 h-3 fill-yellow-300 text-yellow-300" />
                    <span>S {score.toFixed(0)}%</span>
                </Badge>
            );
        } else if (score >= 100) {
            badges.push(
                <Badge key="trending" className="bg-orange-500 border-0 text-white gap-1 text-[10px] h-5 px-1.5 whitespace-nowrap">
                    <Zap className="w-3 h-3 fill-white" />
                    <span>A {score.toFixed(0)}%</span>
                </Badge>
            );
        } else if (score >= 30) {
            badges.push(
                <Badge key="organic" className="bg-emerald-500 border-0 text-white gap-1 text-[10px] h-5 px-1.5 whitespace-nowrap">
                    <span className="text-white text-[10px]">🌱</span>
                    <span>B {score.toFixed(0)}%</span>
                </Badge>
            );
        } else {
            badges.push(
                <Badge key="normal" variant="secondary" className="bg-slate-100 text-slate-500 border-0 gap-1 text-[10px] h-5 px-1.5 whitespace-nowrap">
                    <span className="text-slate-600">☁️</span> C {score.toFixed(0)}%
                </Badge>
            );
        }

        if (vel > 0) {
            const isHighVelocity = vel > 1000;
            badges.push(
                <Badge key="velocity" className={cn(
                    "gap-1 text-[10px] h-5 px-1.5 border whitespace-nowrap",
                    isHighVelocity ? "bg-indigo-600 text-white border-indigo-500" : "bg-blue-50 text-blue-600 border-blue-200"
                )}>
                    <TrendingUp className={cn("w-3 h-3", isHighVelocity && "fill-white")} />
                    {vel > 1000 ? (vel / 1000).toFixed(1) + 'K' : vel.toFixed(0)}/hr
                </Badge>
            );
        }
        return <div className="flex flex-row gap-1.5 items-center flex-wrap">{badges}</div>;
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Header: Enterprise Style */}
            <div className="flex flex-col gap-2 relative">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
                <h1 className="text-4xl font-black tracking-tight sovereign-text uppercase">
                    Sovereign Command Center
                </h1>
                <p className="text-muted-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    Monitoring 300+ Autonomous Swarm Agents • Phase 4: Evolution Active
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                    { title: "Swarm Population", value: totalChannels, icon: Users, detail: `Active: ${activeChannels}` },
                    { title: "Knowledge Base", value: totalVideos, icon: Database, detail: "Semantic Vector Store" },
                    { title: "Daily Throughput", value: downloadedToday, icon: Activity, detail: "Global Syndication" },
                    { title: "Persistence Layer", value: "HEALTHY", icon: HardDrive, detail: "PgBouncer (Tx Mode)" }
                ].map((stat, i) => (
                    <div key={i} className="sovereign-card">
                        <div className="flex flex-row items-center justify-between pb-2">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-white/50">{stat.title}</h3>
                            <stat.icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-2xl font-black tracking-tighter">{formatCount(stat.value as any)}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tight">
                            {stat.detail}
                        </p>
                    </div>
                ))}
            </div>

            {/* Live Cognitive Telemetry & Scaling Control */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <CognitiveTrace />
                </div>
                
                <div className="flex flex-col gap-4">
                    <div className="sovereign-card flex-1 border-primary/20 bg-primary/5 relative overflow-hidden">
                        <div className="scanline" />
                        <div className="flex items-center gap-3 mb-6">
                            <BrainCircuit className="w-5 h-5 text-primary" />
                            <h3 className="font-bold text-sm uppercase tracking-widest">Infra Telemetry</h3>
                        </div>
                        <div className="space-y-6">
                            {[
                                { label: "PgBouncer Pool", val: 82, color: "bg-primary" },
                                { label: "KEDA Scale", val: 14, color: "bg-green-500", max: 300 },
                                { label: "RabbitMQ Consumers", val: 124, color: "bg-blue-500", max: 300 }
                            ].map((item, i) => (
                                <div key={i}>
                                    <div className="flex justify-between text-[10px] uppercase font-bold mb-1.5 text-white/40">
                                        <span>{item.label}</span>
                                        <span className="text-white">{item.val}{item.max ? `/${item.max}` : '%'}</span>
                                    </div>
                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${item.max ? (item.val/item.max)*100 : item.val}%` }}
                                            className={`h-full ${item.color} shadow-[0_0_10px_rgba(59,130,246,0.3)]`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <Button variant="outline" className="glass-panel border-slate-200 hover:bg-white/5 h-12 uppercase tracking-widest text-[10px] font-bold">
                        Emergency Swarm Reboot
                    </Button>
                </div>
            </div>

            {/* Recents Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="glass-panel border-0">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold uppercase tracking-tight">Recent Acquisitions</CardTitle>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/gallery')} className="text-xs uppercase tracking-tighter">
                            View All <ChevronRight className="ml-1 w-4 h-4" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentDownloads.map((video: any) => (
                                <div key={video.id} className="flex gap-4 items-center p-2 hover:bg-white/5 rounded-xl cursor-pointer transition-all border border-transparent hover:border-white/5">
                                    <div className="w-20 aspect-video bg-muted rounded-lg overflow-hidden flex-shrink-0 relative border border-white/5">
                                        {video.thumbnail_path && (
                                            <img src={getMediaUrl(video.thumbnail_path, settings?.root_download_path)} alt={video.title} className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-xs truncate mb-1 uppercase tracking-tight">{video.title}</h4>
                                        <div className="flex items-center gap-2">
                                            {getViralBadge(video.viral_score, video.velocity_score)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass-panel border-0">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold uppercase tracking-tight">Semantic Lab</CardTitle>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/script-lab')} className="text-xs uppercase tracking-tighter">
                            Open Lab <ChevronRight className="ml-1 w-4 h-4" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {recentScripts.map((script: any) => (
                                <div key={script.id} className="flex gap-3 items-center p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-all group">
                                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                        <FileText className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-xs truncate uppercase tracking-tight">{script.title}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase">{new Date(script.downloaded_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
