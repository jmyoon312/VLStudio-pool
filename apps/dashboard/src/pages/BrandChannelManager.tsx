import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { getBrandChannels, updateBrandChannel, deleteBrandChannel, BrandChannel } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Trash2, RefreshCw, UserCheck, AlertTriangle, ShieldCheck,
    Settings2, Clock, LogOut
} from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
    SheetClose
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Types extended with Backend Models
interface GoogleProject {
    id: number;
    project_name: string;
    quota_used: number;
    quota_limit: number;
    is_exhausted: boolean;
    last_reset: string;
}

interface WorkerAccount {
    id: number;
    email: string;
    name: string;
    picture: string;
    google_projects: GoogleProject[];
}

const BrandChannelManager = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // -- Data Fetching --
    const { data: channels, isLoading } = useQuery({
        queryKey: ['brand-channels'],
        queryFn: getBrandChannels,
        refetchInterval: 60000 // Refresh every minute for quota updates
    });

    const handleOAuth = (mode: 'worker' | 'channel', loginHint?: string) => {
        api.get(`/auth/login_url?type=${mode}${loginHint ? `&login_hint=${loginHint}` : ''}`)
            .then(res => {
                if (res.data.url) window.location.href = res.data.url;
            })
            .catch(err => toast({ title: "Error", description: "Failed to start OAuth", variant: "destructive" }));
    };

    const handleDeleteWorker = async (workerId: number) => {
        try {
            await api.delete(`/auth/workers/${workerId}`);
            queryClient.invalidateQueries({ queryKey: ['brand-channels'] });
            toast({ title: "Success", description: "Worker account disconnected" });
        } catch (e) {
            toast({ title: "Error", description: "Failed to delete worker", variant: "destructive" });
        }
    };

    const handleDeleteChannel = async (channelId: number) => {
        try {
            await deleteBrandChannel(channelId);
            queryClient.invalidateQueries({ queryKey: ['brand-channels'] });
            toast({ title: "Success", description: "Channel disconnected" });
        } catch (e) {
            toast({ title: "Error", description: "Failed to delete channel", variant: "destructive" });
        }
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading Brand System...</div>;

    // Group channels by Worker (frontend grouping)
    // Actually API returns flat list. 
    // We want to show Workers primarily? 
    // Let's map unique workers from channels.

    const workersMap = new Map<number, { worker: WorkerAccount, channels: BrandChannel[] }>();

    // Handle cases where worker is populated
    channels?.forEach(ch => {
        if (ch.worker) {
            if (!workersMap.has(ch.worker_id)) {
                // @ts-ignore - casting for safety as api.ts might be loose
                workersMap.set(ch.worker_id, { worker: ch.worker as unknown as WorkerAccount, channels: [] });
            }
            workersMap.get(ch.worker_id)?.channels.push(ch);
        }
    });

    const activeWorkers = Array.from(workersMap.values());

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto bg-background text-foreground min-h-screen">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-primary" /> Channel Manager
                </h1>
                <div className="flex justify-end items-center gap-3">
                    <Button variant="outline" onClick={() => handleOAuth('worker')} className="gap-2">
                        <UserCheck className="w-4 h-4" /> Add Worker Account
                    </Button>
                    <Button onClick={() => handleOAuth('channel')} className="gap-2 bg-primary hover:bg-primary-hover text-primary-foreground">
                        <ShieldCheck className="w-4 h-4" /> Connect Brand Channel
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="workers" className="w-full">
                <TabsList className="mb-6">
                    <TabsTrigger value="workers">My Brand Channels</TabsTrigger>
                    <TabsTrigger value="competitors">Competitor/Reference Channels</TabsTrigger>
                </TabsList>

                <TabsContent value="workers" className="space-y-8">
                    {/* Workers Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeWorkers.map(({ worker, channels }) => (
                            <WorkerCard
                                key={worker.id}
                                worker={worker}
                                channels={channels}
                                onUnlink={() => handleDeleteWorker(worker.id)}
                                onReauth={() => handleOAuth('worker', worker.email)}
                                onDeleteChannel={handleDeleteChannel}
                                onUpdateChannel={async (id, data) => {
                                    await updateBrandChannel(id, data);
                                    queryClient.invalidateQueries({ queryKey: ['brand-channels'] });
                                }}
                            />
                        ))}
                    </div>

                    {activeWorkers.length === 0 && (
                        <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed border-border">
                            <UserCheck className="w-12 h-12 text-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-foreground">No Workers Connected</h3>
                            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                                Connect a Google Workspace/Gmail account to start managing API quotas and uploading videos.
                            </p>
                            <Button onClick={() => handleOAuth('worker')}>Connect First Worker</Button>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="competitors" className="space-y-6">
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                        <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium">Reference Channels Tracker</h3>
                        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                            Channels added from the Outlier Radar will appear here. The system monitors these channels for new viral shorts and trending formats.
                        </p>
                        <Button variant="outline" className="mt-6" onClick={() => window.location.href = '/dashboard'}>
                            Go to Radar
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

// --- Sub Components ---

const WorkerCard = ({
    worker, channels, onUnlink, onReauth, onDeleteChannel, onUpdateChannel
}: {
    worker: WorkerAccount, channels: BrandChannel[],
    onUnlink: () => void, onReauth: () => void,
    onDeleteChannel: (id: number) => void,
    onUpdateChannel: (id: number, data: any) => Promise<void>
}) => {

    // Quota Calculation
    const totalLimit = worker.google_projects.reduce((acc, p) => acc + p.quota_limit, 0);
    const totalUsed = worker.google_projects.reduce((acc, p) => acc + p.quota_used, 0);
    const percent = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;

    // Health Color
    const healthColor = percent > 90 ? "bg-red-500" : percent > 70 ? "bg-amber-500" : "bg-emerald-500";
    const healthText = percent > 90 ? "Critical" : percent > 70 ? "Warning" : "Healthy";

    return (
        <Card className="overflow-hidden border-border shadow-sm hover:shadow-md transition-shadow bg-card">
            {/* Worker Header */}
            <div className="p-4 bg-muted/30 border-b border-border flex justify-between items-start">
                <div className="flex gap-3 items-center">
                    <Avatar className="h-10 w-10 border-2 border-border shadow-sm">
                        <AvatarImage src={worker.picture} />
                        <AvatarFallback>{worker.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="font-semibold text-sm text-foreground">{worker.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            {worker.email}
                            <Badge variant="outline" className="h-4 px-1 text-[10px] bg-card border-border text-muted-foreground">
                                {worker.google_projects.length} Projects
                            </Badge>
                        </div>
                    </div>
                </div>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <LogOut className="w-4 h-4" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-foreground">Disconnect Worker?</AlertDialogTitle>
                            <AlertDialogDescription className="text-muted-foreground">
                                Accompanying channels will also be unlinked. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={onUnlink} className="bg-destructive hover:bg-destructive-hover text-destructive-foreground">Disconnect</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>

            <CardContent className="p-0">
                {/* Quota Health Card */}
                <div className="p-4 bg-card border-b border-border">
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Quota Health
                        </div>
                        <div className={`text-[10px] px-2 py-0.5 rounded-full text-white font-medium ${healthColor}`}>
                            {healthText} ({percent}%)
                        </div>
                    </div>
                    <Progress value={percent} className="h-2 mb-2" indicatorColor={healthColor} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Used: {totalUsed.toLocaleString()} / {totalLimit.toLocaleString()}</span>
                        <span>Resets: Midnight PT</span>
                    </div>
                </div>

                {/* Channels List */}
                <div className="p-4 space-y-3 bg-muted/30">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Connected Channels</div>
                    {channels.map(channel => (
                        <ChannelItem
                            key={channel.id}
                            channel={channel}
                            onReauth={onReauth}
                            onDelete={() => onDeleteChannel(channel.id)}
                            onUpdate={onUpdateChannel}
                        />
                    ))}
                    {channels.length === 0 && (
                        <div className="text-center py-4 text-xs text-muted-foreground italic">
                            No channels linked to this worker
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

const ChannelItem = ({ channel, onReauth, onDelete, onUpdate }: {
    channel: BrandChannel,
    onReauth: () => void,
    onDelete: () => void,
    onUpdate: (id: number, data: any) => Promise<void>
}) => {
    // Check Token Health
    const isTokenExpired = channel.token_expiry
        ? new Date(channel.token_expiry) < new Date()
        : true; // Treat null as expired or 'unknown'

    // Parse Defaults
    let defaultTags: string[] = [];
    try {
        defaultTags = JSON.parse(channel.default_tags || '[]');
    } catch { }

    const [sheetOpen, setSheetOpen] = useState(false);
    const [tempPrivacy, setTempPrivacy] = useState(channel.default_privacy || "private");
    const [tempDelay, setTempDelay] = useState(channel.default_upload_delay_minutes?.toString() || "0");
    const [tagsInput, setTagsInput] = useState(defaultTags.join(", "));

    const saveConfig = async () => {
        const cleanedTags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
        await onUpdate(channel.id, {
            default_privacy: tempPrivacy,
            default_upload_delay_minutes: parseInt(tempDelay) || 0,
            default_tags: JSON.stringify(cleanedTags)
        });
        setSheetOpen(false);
        // Show local toast? Main component handles invalidation
    };

    return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-sm flex items-center justify-between group">
            <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 rounded-md">
                    <AvatarImage src={channel.thumbnail_url} />
                    <AvatarFallback>{channel.title[0]}</AvatarFallback>
                </Avatar>
                <div>
                    <div className="text-sm font-medium text-foreground leading-tight flex items-center gap-1">
                        {channel.title}
                        {isTokenExpired && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <AlertTriangle className="w-3 h-3 text-amber-500 cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>Token Expired - Re-authenticate</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                        {channel.default_privacy} • Delay: {channel.default_upload_delay_minutes || 0}m
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                {isTokenExpired && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-600 animate-pulse" onClick={onReauth} title="Fix Login">
                        <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                )}

                {/* Config Sheet */}
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary">
                            <Settings2 className="w-3.5 h-3.5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent className="w-[400px] sm:w-[540px] bg-card border-border text-foreground">
                        <SheetHeader>
                            <SheetTitle className="text-foreground">Channel Configuration</SheetTitle>
                            <SheetDescription className="text-muted-foreground">
                                Set default behaviors for <b>{channel.title}</b>. These settings apply to all auto-uploads.
                            </SheetDescription>
                        </SheetHeader>

                        <div className="py-6 space-y-6">
                            {/* [SAIF-2026] Sovereign Identity Section */}
                            <div className="p-4 bg-card rounded-xl border border-border shadow-inner">
                                <div className="flex items-center justify-between mb-4">
                                    <Label className="flex items-center gap-2 text-primary font-bold uppercase tracking-wider text-xs">
                                        <ShieldCheck className="w-4 h-4" /> Sovereign Identity (DNA)
                                    </Label>
                                    <Badge className="h-5 text-[9px] bg-primary/20 text-primary border-primary/30">LOCKED</Badge>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-muted-foreground uppercase font-semibold">Stealth Engine</Label>
                                        <Select 
                                            value={channel.engine_mode || "standard"} 
                                            onValueChange={(val) => onUpdate(channel.id, { engine_mode: val })}
                                        >
                                            <SelectTrigger className="bg-muted border-border text-foreground font-medium h-9 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-card border-border text-foreground">
                                                <SelectItem value="standard">Standard (Chromium Hardened)</SelectItem>
                                                <SelectItem value="cloak">Cloak (Native Masking)</SelectItem>
                                                <SelectItem value="fox">Fox (Diversified Signature)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                                        <div className="p-2 bg-muted rounded border border-border">
                                            <div className="text-muted-foreground mb-1">CPU DNA</div>
                                            <div className="text-emerald-500">{channel.warmup_config?.persistent_dna?.cpu || "8"} Cores</div>
                                        </div>
                                        <div className="p-2 bg-muted rounded border border-border">
                                            <div className="text-muted-foreground mb-1">RAM DNA</div>
                                            <div className="text-emerald-500">{channel.warmup_config?.persistent_dna?.ram || "16"} GB</div>
                                        </div>
                                        <div className="col-span-2 p-2 bg-muted rounded border border-border">
                                            <div className="text-muted-foreground mb-1">GPU Renderer</div>
                                            <div className="text-emerald-500 truncate">{channel.warmup_config?.persistent_dna?.gpu?.r || "NVIDIA RTX 3060"}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator className="bg-border" />

                            <div className="space-y-2">
                                <Label className="text-foreground">Default Privacy</Label>
                                <Select value={tempPrivacy} onValueChange={setTempPrivacy}>
                                    <SelectTrigger className="bg-muted border-border text-foreground">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground">
                                        <SelectItem value="public">Public</SelectItem>
                                        <SelectItem value="unlisted">Unlisted</SelectItem>
                                        <SelectItem value="private">Private</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[11px] text-muted-foreground">
                                    "Private" is recommended for review before publishing.
                                </p>
                            </div>

                            <Separator className="bg-border" />

                            <div className="space-y-2">
                                <Label className="text-foreground">Default Tags (Comma Separated)</Label>
                                <Input
                                    value={tagsInput}
                                    onChange={(e) => setTagsInput(e.target.value)}
                                    placeholder="e.g. funny, viral, shorts"
                                    className="bg-muted border-border text-foreground"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    These tags are automatically appended to every video.
                                </p>
                            </div>

                            <Separator className="bg-border" />

                            <div className="space-y-2">
                                <Label className="text-foreground">Upload Delay (Minutes)</Label>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    <Badge variant="outline" className="text-[9px] h-4 border-border text-muted-foreground">
                                        격리 중
                                    </Badge>
                                    <Badge className="text-[9px] h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">
                                        LTE 터널링
                                    </Badge>
                                    {/* [SAIF-2026] Hardware DNA Quick View */}
                                    <Badge className="text-[9px] h-4 bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20 font-mono">
                                        DNA: {channel.warmup_config?.persistent_dna?.cpu || "8"}C/{channel.warmup_config?.persistent_dna?.ram || "16"}G
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        value={tempDelay}
                                        onChange={(e) => setTempDelay(e.target.value)}
                                        className="w-24 bg-muted border-border text-foreground"
                                        min="0"
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Randomized delay loop (± 10%) will be applied around this value to simulate human behavior.
                                </p>
                            </div>
                        </div>

                        <SheetFooter>
                            <SheetClose asChild>
                                <Button variant="outline" className="border-border text-foreground">Cancel</Button>
                            </SheetClose>
                            <Button onClick={saveConfig}>Save Changes</Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>

                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
                    <Trash2 className="w-3.5 h-3.5" />
                </Button>
            </div>
        </div>
    );
}

export default BrandChannelManager;