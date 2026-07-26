import React, { useEffect, useState, useMemo } from 'react';
import { Node } from 'reactflow';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Filter, Wand2, RefreshCw, FileText, Clapperboard, CheckSquare, Square, Zap, Calendar, X, Settings2, Play } from 'lucide-react';
import api from '@/lib/api';
import VideoAssetCard, { VideoAsset } from '@/components/cards/VideoAssetCard';
import ScriptAssetCard, { ScriptAsset } from '@/components/cards/ScriptAssetCard';
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

import StatsDialog from '@/components/dialogs/StatsDialog';
import SubtitleViewer from '@/components/SubtitleViewer';

interface AssetInspectorProps {
    node: Node;
    updateData: (data: any) => void;
}

type TabMode = 'video' | 'script';

// Default Rules Configuration
const DEFAULT_VIDEO_RULES = {
    enabled: false,
    timeWindow: "7",
    minViralScore: "60",
    minVelocity: "100",
    limit: "5"
};

const DEFAULT_SCRIPT_RULES = {
    enabled: false,
    timeWindow: "30",
    minViralScore: "40",
    minVelocity: "50",
    limit: "10"
};

const AssetInspector = ({ node, updateData }: AssetInspectorProps) => {
    const { toast } = useToast();

    // View State
    const [mode, setMode] = useState<TabMode>((node.data.assetType as TabMode) || 'video');

    // Stats Modal State
    const [statsOpen, setStatsOpen] = useState(false);
    const [statsVideo, setStatsVideo] = useState<{ id: number, title: string, upload_date?: string } | null>(null);

    // Subtitle Viewer State
    const [subtitleVideo, setSubtitleVideo] = useState<{ id: number, title: string } | null>(null);

    // Data State
    const [assets, setAssets] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [channels, setChannels] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Filter State
    const [search, setSearch] = useState("");
    const [categoryId, setCategoryId] = useState<string>("all");
    const [channelId, setChannelId] = useState<string>("all");
    const [sortBy, setSortBy] = useState("priority");
    const [excludeUsed, setExcludeUsed] = useState(false);

    // Selected Assets (Synced with Node Data)
    const [selection, setSelection] = useState<number[]>(node.data.selectedIds || []);

    // Automation Rules State (Split Context)
    const [showAutoRules, setShowAutoRules] = useState(false);

    const [videoRules, setVideoRules] = useState(node.data.videoRules || DEFAULT_VIDEO_RULES);
    const [scriptRules, setScriptRules] = useState(node.data.scriptRules || DEFAULT_SCRIPT_RULES);

    // Helper: Access Active Rules dynamically
    const activeRules = mode === 'video' ? videoRules : scriptRules;
    const setActiveRules = (newPartialRules: any) => {
        if (mode === 'video') {
            setVideoRules((prev: typeof DEFAULT_VIDEO_RULES) => ({ ...prev, ...newPartialRules }));
        } else {
            setScriptRules((prev: typeof DEFAULT_SCRIPT_RULES) => ({ ...prev, ...newPartialRules }));
        }
    };

    // Initial Load
    useEffect(() => {
        loadFilters();
    }, []);

    // Reload on Filter/Mode Change
    useEffect(() => {
        loadAssets();
        // Update Node Data Type
        updateData({ assetType: mode });
    }, [mode, search, categoryId, channelId, sortBy, excludeUsed]);

    // Sync BOTH Rule Sets to Node Data
    useEffect(() => {
        updateData({
            videoRules,
            scriptRules,
            // Allow backend to easily grab "current effective rules" if needed, 
            // though backend should usually look at assetType to decide which rules to use.
        });
    }, [videoRules, scriptRules]);

    // Sync Selection to Node Data
    useEffect(() => {
        updateData({
            selectedIds: selection,
            label: `선택된 자산 (${selection.length}개)` // Localized Label
        });
    }, [selection]);

    const loadFilters = async () => {
        try {
            const [catRes, chanRes] = await Promise.all([
                api.get('/categories/'),
                api.get('/channels/')
            ]);
            setCategories(catRes.data);
            setChannels(chanRes.data);
        } catch (e) {
            console.error("Filter Load Error", e);
        }
    };

    // Sync selection to node data (for downstream use)
    useEffect(() => {
        // Only update if changed to avoid loops, though reactflow handles shallow diffs
        if (JSON.stringify(node.data.selectedIds) !== JSON.stringify(selection)) {
            updateData({ selectedIds: selection, assets: assets.filter(a => selection.includes(a.id)) });
        }
    }, [selection, assets]);

    const loadAssets = async () => {
        setLoading(true);
        try {
            // [Updated] Use new backend logic
            const params: any = {
                sort_by: sortBy === 'viral' ? 'viral_score' :
                    sortBy === 'velocity' ? 'velocity_score' :
                        sortBy === 'newest' ? 'upload_date' : 'priority',
                sort_order: 'desc',
                limit: 50,
                mode: mode, // Pass mode to backend
                exclude_used: excludeUsed
            };

            if (search) params.search = search;
            if (categoryId !== "all") params.category_id = parseInt(categoryId);
            if (channelId !== "all") params.channel_id = parseInt(channelId);

            const res = await api.get('/videos/', { params });
            setAssets(res.data);
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "오류", description: "자산을 불러오는데 실패했습니다." });
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (asset: any) => {
        const id = asset.id;
        setSelection(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleGraphClick = (asset: any) => {
        setStatsVideo({
            id: asset.id,
            title: asset.title || asset.filename,
            upload_date: asset.upload_date
        });
        setStatsOpen(true);
    };

    const handleMagicSelect = () => {
        const top5 = assets.slice(0, 5).map(a => a.id);
        setSelection(prev => Array.from(new Set([...prev, ...top5])));
        toast({ title: "자동 선택 완료", description: "상위 5개 자산이 선택되었습니다." });
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">

            {/* Sticky Header - Z-50 to stay above ScrollArea but managed relative to Overlay */}
            <div className="p-4 bg-white border-b space-y-4 shrink-0 z-50 sticky top-0 shadow-sm relative">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Filter className="w-4 h-4 text-blue-500" />
                        Asset Commander
                    </h3>

                    <div className="flex items-center gap-2">
                        {/* Automation Rules Toggle Button */}
                        <Button
                            variant={activeRules.enabled ? "default" : "outline"}
                            size="icon"
                            className={cn(
                                "w-8 h-8 transition-colors duration-300",
                                activeRules.enabled
                                    ? (mode === 'video' ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-orange-600 hover:bg-orange-700 text-white")
                                    : "text-slate-500 border-slate-200"
                            )}
                            onClick={() => setShowAutoRules(!showAutoRules)}
                            title={`${mode === 'video' ? '비디오' : '스크립트'} 자동 실행 규칙`}
                        >
                            <Zap className={cn("w-4 h-4", activeRules.enabled ? "fill-white" : "")} />
                        </Button>
                        <Badge variant="secondary">{assets.length}개 항목</Badge>
                    </div>
                </div>

                <Tabs value={mode} onValueChange={(v) => setMode(v as TabMode)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="video" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                            <Clapperboard className="w-4 h-4 mr-2" /> 비디오 (Video)
                        </TabsTrigger>
                        <TabsTrigger value="script" className="data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">
                            <FileText className="w-4 h-4 mr-2" /> 스크립트 (Script)
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-600" />
                    <Input
                        placeholder="제목 또는 키워드 검색..."
                        className="pl-9 bg-slate-50"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Unified Filters for Both Modes */}
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="모든 카테고리" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">모든 카테고리</SelectItem>
                                {categories.map(c => (
                                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={channelId} onValueChange={setChannelId}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="모든 채널" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">모든 채널</SelectItem>
                                {channels.map(c => (
                                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center justify-between px-1">
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="h-8 text-xs w-[140px]">
                                <SelectValue placeholder="정렬" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="priority">✨ 우선순위</SelectItem>
                                <SelectItem value="viral">🔥 바이럴순</SelectItem>
                                <SelectItem value="velocity">⚡ 급상승순</SelectItem>
                                <SelectItem value="newest">🕒 최신순</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex items-center space-x-2">
                            <Switch id="unused-mode" checked={excludeUsed} onCheckedChange={setExcludeUsed} />
                            <Label htmlFor="unused-mode" className="text-xs font-medium cursor-pointer text-slate-600">미사용만 보기</Label>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="default"
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md font-bold"
                        onClick={handleMagicSelect}
                    >
                        <Wand2 className="w-4 h-4 mr-2" />
                        자동 선택
                    </Button>
                    {selection.length > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            className="w-[80px]"
                            onClick={() => setSelection([])}
                        >
                            <Square className="w-4 h-4 mr-1" /> 해제
                        </Button>
                    )}
                </div>
            </div>

            {/* Grid Content - Z-0 */}
            <ScrollArea className="flex-1 p-4 bg-slate-50 z-0">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-500" />
                        <span className="text-sm">자산을 불러오는 중...</span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {assets.map((asset) => (
                            mode === 'video' ? (
                                <VideoAssetCard
                                    key={asset.id}
                                    video={asset}
                                    selected={selection.includes(asset.id)}
                                    onClick={() => toggleSelection(asset)}
                                    onGraphClick={() => handleGraphClick(asset)}
                                    onViewSubtitle={(asset) => setSubtitleVideo({ id: asset.id, title: asset.title })}
                                />
                            ) : (
                                <ScriptAssetCard
                                    key={asset.id}
                                    script={asset}
                                    selected={selection.includes(asset.id)}
                                    onClick={() => toggleSelection(asset)}
                                    onGraphClick={() => handleGraphClick(asset)}
                                    onViewSubtitle={(asset) => setSubtitleVideo({ id: asset.id, title: asset.title || asset.filename })}
                                />
                            )
                        ))}

                        {assets.length === 0 && (
                            <div className="text-center py-20 text-slate-600">
                                <p className="text-sm">조건에 맞는 자산이 없습니다.</p>
                            </div>
                        )}
                    </div>
                )}
            </ScrollArea>

            {/* Dialogs */}
            <StatsDialog
                open={statsOpen}
                onOpenChange={setStatsOpen}
                videoId={statsVideo?.id || null}
                videoTitle={statsVideo?.title}
                uploadDate={statsVideo?.upload_date}
            />

            <SubtitleViewer
                open={!!subtitleVideo}
                onOpenChange={(open) => !open && setSubtitleVideo(null)}
                videoId={subtitleVideo?.id || null}
                title={subtitleVideo?.title || ''}
            />

            {/* --- POPOVER LAYER (MOVED TO END FOR Z-INDEX FIX) --- */}

            {/* 1. THE BACKDROP (Overlay) - Z-[90] to be above sticky header */}
            {showAutoRules && (
                <div
                    className="absolute inset-0 bg-black/40 z-[90] backdrop-blur-[2px] transition-opacity duration-300"
                    onClick={() => setShowAutoRules(false)}
                />
            )}

            {/* 2. THE POPOVER (Floating Menu) - Z-[100] to be Topmost */}
            {showAutoRules && (
                <div className="absolute top-[60px] left-3 right-3 z-[100] bg-white rounded-xl shadow-2xl border border-slate-200 animate-in fade-in slide-in-from-top-2 zoom-in-95 overflow-hidden">
                    {/* Context Aware Header */}
                    <div className={cn(
                        "px-4 py-3 border-b flex items-center justify-between",
                        mode === 'video' ? "bg-blue-50 border-blue-100" : "bg-orange-50 border-orange-100"
                    )}>
                        <div className="flex items-center gap-2 font-semibold text-sm">
                            {mode === 'video' ? <Clapperboard className="w-4 h-4 text-blue-600" /> : <FileText className="w-4 h-4 text-orange-600" />}
                            <span className={mode === 'video' ? "text-blue-900" : "text-orange-900"}>
                                {mode === 'video' ? "비디오 자동 실행 규칙" : "스크립트 자동 실행 규칙"}
                            </span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-black/5" onClick={() => setShowAutoRules(false)}>
                            <X className="w-4 h-4 text-slate-500" />
                        </Button>
                    </div>

                    <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <Label htmlFor="auto-ctx-enabled" className="text-sm font-semibold text-slate-700 cursor-pointer">
                                {mode === 'video' ? '비디오' : '스크립트'} 규칙 활성화
                            </Label>
                            <Switch
                                id="auto-ctx-enabled"
                                checked={activeRules.enabled}
                                onCheckedChange={(checked) => setActiveRules({ enabled: checked })}
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> 기간 (최근 데이터)
                                </Label>
                                <Select
                                    value={activeRules.timeWindow}
                                    onValueChange={(v) => setActiveRules({ timeWindow: v })}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">1일 (24시간)</SelectItem>
                                        <SelectItem value="3">3일</SelectItem>
                                        <SelectItem value="7">1주일</SelectItem>
                                        <SelectItem value="30">1개월</SelectItem>
                                        <SelectItem value="365">전체</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] text-slate-500 font-medium">최소 등급</Label>
                                    <Select
                                        value={activeRules.minViralScore}
                                        onValueChange={(v) => setActiveRules({ minViralScore: v })}
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="80">S등급 (80+)</SelectItem>
                                            <SelectItem value="60">A등급 (60+)</SelectItem>
                                            <SelectItem value="40">B등급 (40+)</SelectItem>
                                            <SelectItem value="0">제한 없음</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] text-slate-500 font-medium">최소 급상승</Label>
                                    <Input
                                        type="number"
                                        className="h-8 text-xs"
                                        value={activeRules.minVelocity}
                                        onChange={(e) => setActiveRules({ minVelocity: e.target.value })}
                                        placeholder="100"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[11px] text-slate-500 font-medium">선택 수량 (Limit)</Label>
                                <Input
                                    type="number"
                                    className="h-8 text-xs"
                                    value={activeRules.limit}
                                    onChange={(e) => setActiveRules({ limit: e.target.value })}
                                    placeholder="5"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-3 bg-slate-50 border-t text-[11px] text-slate-500 text-center">
                        <span className="font-semibold">{mode === 'video' ? 'Video' : 'Script'}</span> 탭 활성화 시에만 적용됩니다.
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetInspector;
