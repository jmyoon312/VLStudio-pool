import React, { useState, useEffect, useRef } from 'react';
import { fetchWithRetry, uint8ArrayToBase64 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import {
    Upload, FileVideo, Workflow, CheckCircle, XCircle, Clock,
    Play, Pause, Trash2, Edit, Eye, PlaySquare, Send, Settings, RotateCcw, AlertTriangle,
    Shield, Clock4, Hash, Paperclip, FileCheck, Files, Filter, Search, ArrowUpDown, FolderOpen, Save, Rocket,
    FileSpreadsheet, Layers, ArrowRight, Table, Columns2
} from 'lucide-react';

const WorkQueue = () => {
    const { toast } = useToast();
    const [queueItems, setQueueItems] = useState<any[]>([]);
    const [stats, setStats] = useState<any>({});
    const [activeTab, setActiveTab] = useState('draft');
    const [selectedItems, setSelectedItems] = useState<number[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isPlayerOpen, setIsPlayerOpen] = useState(false);
    const [playingItem, setPlayingItem] = useState<any>(null);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [wsConnections, setWsConnections] = useState<Map<number, WebSocket>>(new Map());
    const [dateFilter, setDateFilter] = useState('all');
    const [limit, setLimit] = useState(20);
    const [searchExternalId, setSearchExternalId] = useState('');
    const [batchId, setBatchId] = useState('');
    const [channels, setChannels] = useState<any[]>([]);
    const [tiktokChannels, setTiktokChannels] = useState<any[]>([]);
    const [instagramChannels, setInstagramChannels] = useState<any[]>([]);

    useEffect(() => {
        loadQueueItems();
        loadStats();
        loadAllChannels();
        const interval = setInterval(() => { loadQueueItems(); loadStats(); }, 5000);
        return () => clearInterval(interval);
    }, [activeTab, dateFilter, limit, searchExternalId, batchId]);

    useEffect(() => {
        const uploadingItems = queueItems.filter(item => item.status === 'UPLOADING');
        uploadingItems.forEach(item => {
            if (!wsConnections.has(item.id)) connectWebSocket(item.id);
        });
        wsConnections.forEach((ws, itemId) => {
            const item = queueItems.find(i => i.id === itemId);
            if (!item || item.status !== 'UPLOADING') { ws.close(); wsConnections.delete(itemId); }
        });
        return () => { wsConnections.forEach(ws => ws.close()); };
    }, [queueItems]);

    const connectWebSocket = (itemId: number) => {
        const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/work-queue/ws/progress/${itemId}`);
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setQueueItems(prevItems => prevItems.map(item => item.id === data.queue_item_id ? { ...item, upload_progress: data.progress } : item));
                if (data.progress === 100) toast({ title: "업로드 완료", description: data.message });
            } catch (_) { }
        };
        setWsConnections(prev => new Map(prev).set(itemId, ws));
    };

    const buildUrl = () => {
        const statusFilter = activeTab === 'draft' ? 'DRAFT' : activeTab === 'pending' ? 'PENDING' : activeTab === 'queued' ? 'QUEUED' : activeTab === 'uploading' ? 'UPLOADING' : activeTab === 'verifying' ? 'VERIFYING' : activeTab === 'completed' ? 'COMPLETED' : activeTab === 'failed_review' ? 'FAILED_REVIEW' : null;
        let url = `/api/work-queue/items?limit=${limit}&date_filter=${dateFilter}`;
        if (statusFilter) url += `&status=${statusFilter}`;
        if (searchExternalId) url += `&source_external_id=${encodeURIComponent(searchExternalId)}`;
        if (batchId) url += `&source_batch_id=${encodeURIComponent(batchId)}`;
        return url;
    };

    const loadQueueItems = async () => {
        try {
            const response = await fetchWithRetry(buildUrl());
            const data = await response.json();
            setQueueItems(Array.isArray(data) ? data : []);
        } catch (_) { setQueueItems([]); }
    };

    const loadStats = async () => {
        try {
            const response = await fetchWithRetry('/api/work-queue/stats');
            setStats(await response.json());
        } catch (_) { }
    };

    const loadAllChannels = async () => {
        try {
            const [r1, r2, r3] = await Promise.all([
                fetchWithRetry('/api/youtube/all'),
                fetchWithRetry('/api/tiktok-channels/'),
                fetchWithRetry('/api/instagram-channels/'),
            ]);
            if (r1.ok) {
                const data = await r1.json();
                setChannels(Array.isArray(data) ? data : []);
            }
            if (r2.ok) setTiktokChannels(await r2.json());
            if (r3.ok) setInstagramChannels(await r3.json());
        } catch (_) { }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, any> = {
            'DRAFT': { className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300', icon: Edit, text: '임시 보관' },
            'PENDING': { className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200', icon: Clock, text: '승인 대기' },
            'QUEUED': { className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200', icon: Clock, text: '대기열' },
            'UPLOADING': { className: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200', icon: Upload, text: '업로드 중' },
            'VERIFYING': { className: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200', icon: Clock4, text: '검증 중' },
            'COMPLETED': { className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200', icon: CheckCircle, text: '완료' },
            'FAILED': { className: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200', icon: XCircle, text: '실패' },
            'FAILED_REVIEW': { className: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 border-pink-200', icon: Shield, text: '실패 검토' },
            'SCHEDULED_UPLOAD': { className: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200', icon: Clock4, text: '예약됨' },
        };
        const c = variants[status] || variants['QUEUED'];
        return <Badge variant="outline" className={`flex items-center gap-1 text-xs ${c.className}`}><c.icon className="w-3 h-3" />{c.text}</Badge>;
    };

    const getApprovalBadge = (approvalStatus: string) => {
        const v: Record<string, any> = {
            'PENDING': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
            'APPROVED': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
            'REJECTED': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
            'AUTO_APPROVED': 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
        };
        return <Badge className={`text-xs ${v[approvalStatus] || ''}`}>{approvalStatus}</Badge>;
    };

    const handleApprove = async (itemId: number) => {
        try {
            await fetchWithRetry('/api/work-queue/batch/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_ids: [itemId], approved_by: 'user' }) });
            toast({ title: "승인됨", description: "업로드 대기열로 이동됨" });
            loadQueueItems();
        } catch (_) { toast({ variant: "destructive", title: "오류", description: "승인 실패" }); }
    };

    const handleReject = async (itemId: number, reason: string) => {
        try {
            await fetchWithRetry('/api/work-queue/batch/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_ids: [itemId], reason }) });
            toast({ title: "반려됨" });
            loadQueueItems();
        } catch (_) { toast({ variant: "destructive", title: "오류", description: "반려 실패" }); }
    };

    const handleDelete = async (itemId: number) => {
        if (!confirm('삭제하시겠습니까?')) return;
        try {
            await fetchWithRetry(`/api/work-queue/items/${itemId}`, { method: 'DELETE' });
            toast({ title: "삭제됨" });
            loadQueueItems();
        } catch (_) { toast({ variant: "destructive", title: "오류" }); }
    };

    const handleBatchApprove = async () => {
        if (!selectedItems.length) return;
        try {
            const res = await fetchWithRetry('/api/work-queue/batch/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_ids: selectedItems, approved_by: 'user' }) });
            const result = await res.json();
            toast({ title: "일괄 승인", description: `${result.approved}건 승인, ${result.failed}건 실패` });
            setSelectedItems([]); loadQueueItems();
        } catch (_) { toast({ variant: "destructive", title: "일괄 승인 실패" }); }
    };

    const handleBatchReject = async () => {
        if (!selectedItems.length) return;
        const reason = prompt('반려 사유:');
        if (!reason) return;
        try {
            await fetchWithRetry('/api/work-queue/batch/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_ids: selectedItems, reason }) });
            toast({ title: "일괄 반려" });
            setSelectedItems([]); loadQueueItems();
        } catch (_) { toast({ variant: "destructive", title: "일괄 반려 실패" }); }
    };

    const handleBatchDelete = async () => {
        if (!selectedItems.length || !confirm(`${selectedItems.length}개 항목을 삭제하시겠습니까?`)) return;
        try {
            await fetchWithRetry('/api/work-queue/batch/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_ids: selectedItems }) });
            toast({ title: "일괄 삭제" });
            setSelectedItems([]); loadQueueItems();
        } catch (_) { toast({ variant: "destructive", title: "일괄 삭제 실패" }); }
    };

    const handleBatchReset = async () => {
        if (!selectedItems.length) return;
        try {
            await fetchWithRetry('/api/work-queue/batch/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_ids: selectedItems }) });
            toast({ title: "초기화", description: "항목이 대기열로 이동됨" });
            setSelectedItems([]); loadQueueItems();
        } catch (_) { toast({ variant: "destructive", title: "초기화 실패" }); }
    };

    const handleBatchFinalize = async () => {
        if (!selectedItems.length) return;
        const items = selectedItems.map(id => ({ id, source_external_id: queueItems.find(q => q.id === id)?.source_external_id }));
        try {
            const res = await fetchWithRetry('/api/work-queue/batch/finalize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items.map(i => ({ source_external_id: i.source_external_id })) }) });
            const result = await res.json();
            toast({ title: "일괄 즉시 등록", description: `${result.count}개 항목이 대기열로 이동됨` });
            setSelectedItems([]); loadQueueItems();
        } catch (_) { toast({ variant: "destructive", title: "일괄 등록 실패" }); }
    };

    const handleAttachVideo = async (itemId: number) => {
        const item = queueItems.find(q => q.id === itemId);
        if (!item || item.status !== 'DRAFT') {
            toast({ variant: "destructive", title: "첨부 불가", description: "DRAFT 상태의 항목만 영상 첨부가 가능합니다" });
            return;
        }
        setEditingItem(item);
        setIsAddDialogOpen(true);
    };

    const handleFinalize = async (itemId: number) => {
        const item = queueItems.find(q => q.id === itemId);
        if (!item?.video_file_path) {
            toast({ variant: "destructive", title: "영상 필요", description: "먼저 영상을 첨부해 주세요" });
            return;
        }
        try {
            const res = await fetchWithRetry(`/api/work-queue/items/${itemId}/finalize`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approval_required: false }) });
            if (res.ok) { const d = await res.json(); toast({ title: "즉시 등록", description: d.upload_queued ? "대기열 등록됨" : "승인 대기" }); loadQueueItems(); }
            else throw await res.json();
        } catch (e: any) { toast({ variant: "destructive", title: "등록 실패", description: e?.detail || '서버 오류' }); }
    };

    const handleUpdateItem = async (itemId: number, updates: any) => {
        try {
            const res = await fetchWithRetry(`/api/work-queue/items/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
            if (res.ok) { toast({ title: "업데이트 완료" }); loadQueueItems(); }
            else throw await res.json();
        } catch (e: any) { toast({ variant: "destructive", title: "업데이트 실패", description: e?.detail || '서버 오류' }); }
    };

    const handleUpdateUploadMethod = (itemId: number, method: string) => {
        handleUpdateItem(itemId, { upload_method: method });
    };

    const handleUpdateChannel = (itemId: number, platform: string, channelId: string) => {
        const item = queueItems.find(q => q.id === itemId);
        const currentConfigs = item?.platform_configs || {};
        const key = platform === 'youtube' ? 'channel_id' : 'account_id';
        handleUpdateItem(itemId, {
            platform_configs: {
                ...currentConfigs,
                [platform]: { ...(currentConfigs[platform] || {}), [key]: channelId }
            }
        });
    };

    const toggleItemSelection = (itemId: number) => setSelectedItems(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
    const toggleAllSelection = () => setSelectedItems(selectedItems.length === queueItems.length ? [] : queueItems.map(item => item.id));

    const clearFilters = () => { setSearchExternalId(''); setBatchId(''); };

    return (
        <div className="p-6 space-y-6 bg-background text-foreground min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">자동화 작업 대기열</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">HITL 승인 및 업로드 오케스트레이션</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={() => { setEditingItem(null); setIsAddDialogOpen(true); }}>
                        <Edit className="w-4 h-4 mr-2" /> 수동 등록
                    </Button>
                    <Button
                        variant="outline"
                        className="border-indigo-300 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950"
                        onClick={() => { setShowBulkImport(true); }}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" /> 일괄 등록
                    </Button>
                </div>
            </div>

            {queueItems.some(item => item.approval_status === 'PENDING') && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative"><AlertTriangle className="w-5 h-5 text-orange-600" /><div className="absolute top-0 right-0 w-2 h-2 bg-orange-500 rounded-full animate-ping" /></div>
                        <div>
                            <h3 className="font-semibold text-orange-600 dark:text-orange-400">HITL 승인 필요</h3>
                            <p className="text-sm text-muted-foreground">에이전트가 업로드 전 사람의 승인을 기다리는 중입니다.</p>
                        </div>
                    </div>
                    <Button onClick={() => setActiveTab('pending')} className="bg-orange-500 hover:bg-orange-600 text-white">승인 대기 검토</Button>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {[{ label: '전체', value: stats.total ?? 0, icon: FileVideo, color: 'slate' },
                { label: '임시 보관', value: stats.draft ?? 0, icon: Edit, color: 'slate' },
                { label: '승인 대기', value: stats.pending ?? 0, icon: Clock, color: 'amber' },
                { label: '업로드 중', value: stats.uploading ?? 0, icon: Upload, color: 'violet' },
                { label: '검증 중', value: stats.verifying ?? 0, icon: Clock4, color: 'orange' },
                { label: '완료', value: stats.completed ?? 0, icon: CheckCircle, color: 'emerald' },
                { label: '실패', value: stats.failed ?? 0, icon: XCircle, color: 'red' },
                ].map(s => (
                    <Card key={s.label} className="border-border"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold mt-0.5">{s.value}</p></div><div className={`p-2 rounded-md ${s.color === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : s.color === 'violet' ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : s.color === 'orange' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : s.color === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : s.color === 'red' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-muted-foreground'}`}><s.icon className="w-4 h-4" /></div></div></CardContent></Card>
                ))}
            </div>

            {selectedItems.length > 0 && (
                <Card className="bg-blue-500/10 border-blue-500/20">
                    <CardContent className="p-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <Checkbox checked={selectedItems.length === queueItems.length} onCheckedChange={toggleAllSelection} />
                                <span className="font-semibold text-blue-600 dark:text-blue-400">{selectedItems.length}개 선택됨</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Button size="sm" onClick={handleBatchApprove} className="bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle className="w-3.5 h-3.5 mr-1" /> 승인</Button>
                                <Button size="sm" onClick={handleBatchReject} variant="destructive"><XCircle className="w-3.5 h-3.5 mr-1" /> 반려</Button>
                                <Button size="sm" onClick={handleBatchFinalize} className="bg-indigo-600 hover:bg-indigo-700 text-white"><FileCheck className="w-3.5 h-3.5 mr-1" /> 즉시 등록</Button>
                                <Button size="sm" onClick={handleBatchReset} variant="secondary"><RotateCcw className="w-3.5 h-3.5 mr-1" /> 초기화</Button>
                                <Button size="sm" onClick={handleBatchDelete} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 mr-1" /> 삭제</Button>
                                <Button size="sm" variant="ghost" onClick={() => setSelectedItems([])}>취소</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <VideoPlayerDialog isOpen={isPlayerOpen} setIsOpen={setIsPlayerOpen} item={playingItem} />
            <AddVideoDialog isOpen={isAddDialogOpen} setIsOpen={setIsAddDialogOpen} onSuccess={() => { loadQueueItems(); setEditingItem(null); }} initialData={editingItem} />
            <BulkImportDialog isOpen={showBulkImport} setIsOpen={setShowBulkImport} onSuccess={() => loadQueueItems()} />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                    <TabsList className="bg-muted border border-border flex-wrap h-auto p-1 gap-0.5">
                        {(['draft', 'pending', 'queued', 'uploading', 'verifying', 'completed', 'failed_review'] as const).map(t => (
                            <TabsTrigger key={t} value={t} className="text-xs px-3 py-1.5">
                                {t === 'draft' ? '임시 보관' : t === 'pending' ? '승인 대기' : t === 'queued' ? '대기열' : t === 'uploading' ? '업로드 중' : t === 'verifying' ? '검증 중' : t === 'completed' ? '완료' : '실패 검토'}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                            <Input placeholder="외부 ID" value={searchExternalId} onChange={e => setSearchExternalId(e.target.value)} className="w-32 h-8 text-xs bg-background border-border" />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Files className="w-3.5 h-3.5 text-muted-foreground" />
                            <Input placeholder="배치 ID" value={batchId} onChange={e => setBatchId(e.target.value)} className="w-36 h-8 text-xs bg-background border-border" />
                        </div>
                        <Select value={dateFilter} onValueChange={setDateFilter}>
                            <SelectTrigger className="w-28 h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="today">오늘</SelectItem><SelectItem value="week">7일</SelectItem><SelectItem value="month">30일</SelectItem><SelectItem value="all">전체</SelectItem></SelectContent>
                        </Select>
                        {(searchExternalId || batchId) && <Button size="sm" variant="ghost" onClick={clearFilters} className="h-8 text-xs"><Filter className="w-3 h-3 mr-1" /> 초기화</Button>}
                    </div>
                </div>

                <TabsContent value={activeTab} className="mt-4">
                    {queueItems.length === 0 ? (
                        <Card className="border-dashed border-2 border-border"><CardContent className="p-16 text-center"><FileVideo className="w-12 h-12 mx-auto text-muted-foreground mb-3" /><h3 className="text-lg font-semibold text-muted-foreground mb-1">대기열이 비어있음</h3><p className="text-sm text-muted-foreground">새 항목을 추가하거나 일괄 등록으로 시작하세요</p></CardContent></Card>
                    ) : (
                        <div className="grid gap-3">
                            {queueItems.map(item => (
                                <QueueItemCard key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} onDelete={handleDelete} onEdit={(i: any) => { setEditingItem(i); setIsAddDialogOpen(true); }} onPlay={(i: any) => { setPlayingItem(i); setIsPlayerOpen(true); }} onAttach={handleAttachVideo} onFinalize={handleFinalize} onUpdateUploadMethod={handleUpdateUploadMethod} onUpdateChannel={handleUpdateChannel} channels={channels} tiktokChannels={tiktokChannels} instagramChannels={instagramChannels} getStatusBadge={getStatusBadge} getApprovalBadge={getApprovalBadge} selectedItems={selectedItems} toggleItemSelection={toggleItemSelection} />
                            ))}
                            {queueItems.length >= limit && (
                                <Button variant="outline" className="w-full mt-2" onClick={() => setLimit(prev => prev + 20)}>더 불러오기 ({queueItems.length})</Button>
                            )}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

const QueueItemCard = ({ item, onApprove, onReject, onDelete, onEdit, onPlay, onAttach, onFinalize, onUpdateUploadMethod, onUpdateChannel, channels, tiktokChannels, instagramChannels, getStatusBadge, getApprovalBadge, selectedItems, toggleItemSelection }: any) => {
    const [expanded, setExpanded] = useState(false);
    return (
        <Card className="hover:shadow-md transition-shadow bg-card border-border select-none" onMouseEnter={e => { if (e.buttons === 1 && !selectedItems.includes(item.id)) toggleItemSelection(item.id); }}>
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <Checkbox checked={selectedItems.includes(item.id)} onCheckedChange={() => toggleItemSelection(item.id)} className="mt-0.5 border-border" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h3 className="font-semibold text-foreground truncate max-w-md">{item.title || '제목 없음'}</h3>
                            {getStatusBadge(item.status)}
                            {getApprovalBadge(item.approval_status)}
                            {item.source_external_id && (
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"><Hash className="w-3 h-3 mr-0.5" />{item.source_external_id}</Badge></TooltipTrigger><TooltipContent>외부 ID</TooltipContent></Tooltip></TooltipProvider>
                            )}
                            {item.source_batch_id && (
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-mono max-w-[120px] truncate">{item.source_batch_id.substring(0, 8)}...</Badge></TooltipTrigger><TooltipContent>{item.source_batch_id}</TooltipContent></Tooltip></TooltipProvider>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><FileVideo className="w-3.5 h-3.5" /> {item.source_type || 'MANUAL'}</span>
                            {item.video_file_path && (
                                <span className="cursor-pointer hover:text-blue-600 flex items-center gap-1" onClick={() => onPlay(item)}><Play className="w-3 h-3" /> 미리보기</span>
                            )}
                            <span>{new Date(item.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            {item.target_platforms?.map((p: string) => <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0">{p}</Badge>)}
                        </div>
                        {item.status === 'UPLOADING' && (
                            <div className="mt-3">
                                <div className="flex justify-between text-xs mb-1 text-muted-foreground"><span>업로드 진행률</span><span className="font-medium">{item.upload_progress}%</span></div>
                                <div className="w-full bg-muted rounded-full h-1.5"><div className="bg-indigo-600 h-1.5 rounded-full transition-all" style={{ width: `${item.upload_progress}%` }} /></div>
                            </div>
                        )}
                        {expanded && (
                            <div className="mt-3 p-3 bg-muted/50 rounded-lg text-xs space-y-3 border border-border">
                                <div className="grid grid-cols-2 gap-3">
                                    <div><span className="font-semibold text-muted-foreground">제목</span><p className="text-foreground mt-0.5">{item.title || '--'}</p></div>
                                    <div><span className="font-semibold text-muted-foreground">설명</span><p className="text-foreground mt-0.5">{item.description || '--'}</p></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><span className="font-semibold text-muted-foreground">파일 경로</span><p className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">{item.video_file_path || '--'}</p></div>
                                    <div><span className="font-semibold text-muted-foreground">상태</span><p className="mt-0.5">{item.status} ({item.approval_status})</p></div>
                                </div>
                                {item.upload_progress > 0 && (
                                    <div><span className="font-semibold text-muted-foreground">업로드 진행률</span><p className="mt-0.5 text-indigo-600 font-medium">{item.upload_progress}%</p></div>
                                )}
                                <div className="grid grid-cols-3 gap-3">
                                    <div><span className="font-semibold text-muted-foreground">소스 유형</span><p className="mt-0.5">{item.source_type || 'MANUAL'}</p></div>
                                    <div><span className="font-semibold text-muted-foreground">업로드 방식</span><p className="mt-0.5">{item.upload_method || 'API'}</p></div>
                                    <div><span className="font-semibold text-muted-foreground">우선순위</span><p className="mt-0.5">{item.upload_priority ?? 0}</p></div>
                                </div>
                                <div><span className="font-semibold text-muted-foreground">태그</span><p className="mt-0.5">{item.tags?.length ? item.tags.join(', ') : '--'}</p></div>
                                <div><span className="font-semibold text-muted-foreground">해시태그</span><p className="mt-0.5">{item.hashtags?.length ? item.hashtags.join(' ') : '--'}</p></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><span className="font-semibold text-muted-foreground">외부 ID</span><p className="font-mono text-[10px] mt-0.5">{item.source_external_id || '--'}</p></div>
                                    <div><span className="font-semibold text-muted-foreground">배치 ID</span><p className="font-mono text-[10px] mt-0.5 truncate">{item.source_batch_id || '--'}</p></div>
                                </div>
                                {item.platform_configs && (
                                    <div className="border-t border-border pt-2">
                                        <span className="font-semibold text-muted-foreground">플랫폼 설정</span>
                                        <div className="mt-1 grid grid-cols-2 gap-2">
                                            {item.platform_configs.youtube && (
                                                <div className="bg-muted/60 rounded px-2 py-1.5"><p className="text-blue-600 dark:text-blue-400 font-medium">YouTube</p><p className="text-[10px]">공개: {item.platform_configs.youtube.privacy || '--'} | 헤드리스: {String(item.platform_configs.youtube.headless_mode || false)}</p></div>
                                            )}
                                            {item.platform_configs.tiktok && (
                                                <div className="bg-muted/60 rounded px-2 py-1.5"><p className="text-pink-600 dark:text-pink-400 font-medium">TikTok</p><p className="text-[10px]">공개: {item.platform_configs.tiktok.privacy || '--'} | 댓글: {String(item.platform_configs.tiktok.allow_comments ?? true)}</p></div>
                                            )}
                                            {item.platform_configs.instagram && (
                                                <div className="bg-muted/60 rounded px-2 py-1.5"><p className="text-purple-600 dark:text-purple-400 font-medium">Instagram</p><p className="text-[10px]">피드 공유: {String(item.platform_configs.instagram.share_to_feed || false)}</p></div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {item.scheduled_upload_time && (
                                    <div><span className="font-semibold text-muted-foreground">예약 시간</span><p className="mt-0.5">{new Date(item.scheduled_upload_time).toLocaleString('ko-KR')}</p></div>
                                )}
                                {item.uploaded_urls && (
                                    <div><span className="font-semibold text-muted-foreground">업로드 URL</span><p className="font-mono text-[10px] mt-0.5 break-all">{JSON.stringify(item.uploaded_urls)}</p></div>
                                )}
                                {item.enable_shopping_tag && (
                                    <div><span className="font-semibold text-muted-foreground">쇼핑 태그 키워드</span><p className="mt-0.5">{item.shopping_tag_keyword || '--'}</p></div>
                                )}
                                {item.failure_reason && <p className="text-destructive pt-2 border-t border-border"><strong>실패 사유:</strong> {item.failure_reason}</p>}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {(item.status === 'DRAFT' || !item.video_file_path) && (
                            <>
                                <Select value={item.upload_method || 'BROWSER_AUTO'} onValueChange={(v) => onUpdateUploadMethod(item.id, v)}>
                                    <SelectTrigger className="h-8 w-[110px] text-[11px] bg-background border-border">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="API">Google API</SelectItem>
                                        <SelectItem value="BROWSER_AUTO">브라우저 자동</SelectItem>
                                        <SelectItem value="MANUAL">수동</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="outline" onClick={() => onAttach(item.id)} className="h-8 text-xs border-border"><Paperclip className="w-3.5 h-3.5 mr-1" />영상 첨부</Button>
                                <Button size="sm" variant="outline" onClick={() => onFinalize(item.id)} className="h-8 text-xs border-orange-200 text-orange-600 hover:bg-orange-50"><Rocket className="w-3.5 h-3.5 mr-1" />즉시 등록</Button>
                            </>
                        )}
                        {item.approval_status === 'PENDING' && item.video_file_path && (
                            <>
                                <Button size="sm" onClick={() => onApprove(item.id)} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle className="w-3.5 h-3.5 mr-1" />승인</Button>
                                <Button size="sm" variant="destructive" onClick={() => onReject(item.id, '품질 문제')} className="h-8 text-xs"><XCircle className="w-3.5 h-3.5 mr-1" />반려</Button>
                            </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)} className="h-8 w-8 p-0"><Eye className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => onEdit(item)} className="h-8 w-8 p-0"><Edit className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(item.id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                    </div>
            </div>
            {expanded && item.target_platforms?.length > 0 && (
                <div className="mt-2 ml-8 p-2 bg-muted/40 rounded-lg border border-border grid grid-cols-3 gap-2 text-xs">
                    {item.target_platforms.includes('youtube') && (
                        <div>
                            <span className="text-blue-600 dark:text-blue-400 font-medium text-[10px]">YouTube 채널</span>
                            <Select value={(item.platform_configs?.youtube?.channel_id) || ''} onValueChange={(v) => onUpdateChannel(item.id, 'youtube', v)}>
                                <SelectTrigger className="h-7 text-[10px] mt-0.5 bg-background"><SelectValue placeholder="채널 선택" /></SelectTrigger>
                                <SelectContent>{channels.map((ch: any) => <SelectItem key={ch.channel_id} value={ch.channel_id}>{ch.channel_name || ch.title} ({ch.subscriber_count?.toLocaleString()}명)</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}
                    {item.target_platforms.includes('tiktok') && (
                        <div>
                            <span className="text-pink-600 dark:text-pink-400 font-medium text-[10px]">TikTok 계정</span>
                            <Select value={(item.platform_configs?.tiktok?.account_id) || ''} onValueChange={(v) => onUpdateChannel(item.id, 'tiktok', v)}>
                                <SelectTrigger className="h-7 text-[10px] mt-0.5 bg-background"><SelectValue placeholder="계정 선택" /></SelectTrigger>
                                <SelectContent>{tiktokChannels.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nickname || c.id}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}
                    {item.target_platforms.includes('instagram') && (
                        <div>
                            <span className="text-purple-600 dark:text-purple-400 font-medium text-[10px]">Instagram 계정</span>
                            <Select value={(item.platform_configs?.instagram?.account_id) || ''} onValueChange={(v) => onUpdateChannel(item.id, 'instagram', v)}>
                                <SelectTrigger className="h-7 text-[10px] mt-1 bg-background"><SelectValue placeholder="계정 선택" /></SelectTrigger>
                                <SelectContent>{instagramChannels.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nickname || c.id}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            )}
            </CardContent>
        </Card>
    );
};

const VideoPlayerDialog = ({ isOpen, setIsOpen, item }: any) => {
    if (!item) return null;
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-3xl bg-black p-1 border-border">
                <DialogHeader className="sr-only"><DialogTitle>{item.title}</DialogTitle></DialogHeader>
                <video src={`/api/work-queue/stream?path=${encodeURIComponent(item.video_file_path)}`} controls autoPlay className="w-full aspect-video" />
                <div className="p-3 bg-card text-foreground"><h3 className="font-semibold">{item.title}</h3><p className="text-xs text-muted-foreground truncate">{item.video_file_path}</p></div>
            </DialogContent>
        </Dialog>
    );
};

const AddVideoDialog = ({ isOpen, setIsOpen, onSuccess, initialData }: any) => {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [channels, setChannels] = useState<any[]>([]);
    const [tiktokChannels, setTiktokChannels] = useState<any[]>([]);
    const [instagramChannels, setInstagramChannels] = useState<any[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const defaultForm = {
        title: '', description: '', hashtags: '', tags: '', video_file_path: '', source_external_id: '',
        enable_shopping_tag: false, shopping_tag_keyword: '',
        source_type: 'MANUAL', approval_required: false, upload_method: 'BROWSER_AUTO',
        target_platforms: ['youtube'],
        platform_configs: {
            youtube: { channel_id: '', privacy: 'private', category: '22', made_for_kids: false, headless_mode: true },
            tiktok: { account_id: '', privacy: 'private', allow_comments: true, allow_duet: true },
            instagram: { account_id: '', caption: '', share_to_feed: false }
        },
        scheduleMode: 'immediate' as 'immediate' | 'scheduled', scheduledTime: ''
    };
    const [form, setForm] = useState(defaultForm);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                const pc = initialData.platform_configs || {};
                const mergedConfigs = {
                    youtube: { ...defaultForm.platform_configs.youtube, ...(pc.youtube || {}) },
                    tiktok: { ...defaultForm.platform_configs.tiktok, ...(pc.tiktok || {}) },
                    instagram: { ...defaultForm.platform_configs.instagram, ...(pc.instagram || {}) },
                };
                const safeData: any = {};
                for (const key of Object.keys(initialData)) {
                    if (initialData[key] != null) safeData[key] = initialData[key];
                }
                setForm({
                    ...defaultForm,
                    ...safeData,
                    source_external_id: safeData.source_external_id || '',
                    video_file_path: safeData.video_file_path || '',
                    description: safeData.description || '',
                    tags: Array.isArray(safeData.tags) ? safeData.tags.join(', ') : (safeData.tags || ''),
                    hashtags: Array.isArray(safeData.hashtags) ? safeData.hashtags.join(' ') : (safeData.hashtags || ''),
                    platform_configs: mergedConfigs,
                    target_platforms: safeData.target_platforms || defaultForm.target_platforms,
                    scheduleMode: safeData.scheduled_upload_time ? 'scheduled' : 'immediate',
                    scheduledTime: safeData.scheduled_upload_time ? (safeData.scheduled_upload_time.includes('T') ? safeData.scheduled_upload_time : safeData.scheduled_upload_time.replace(' ', 'T')).slice(0, 16) : '',
                });
            } else setForm(defaultForm);
        }
        loadChannels();
        loadSocialChannels();
    }, [isOpen, initialData]);

    const loadSocialChannels = async () => {
        try {
            const [r1, r2] = await Promise.all([fetchWithRetry('/api/tiktok-channels/'), fetchWithRetry('/api/instagram-channels/')]);
            if (r1.ok) setTiktokChannels(await r1.json());
            if (r2.ok) setInstagramChannels(await r2.json());
        } catch (_) { }
    };

    const loadChannels = async () => {
        try {
            const r = await fetchWithRetry('/api/youtube/all');
            if (!r.ok) throw new Error();
            const data = await r.json();
            setChannels(Array.isArray(data) ? data : []);
            if (data.length > 0 && !form.platform_configs?.youtube?.channel_id) setForm(prev => ({ ...prev, platform_configs: { ...prev.platform_configs, youtube: { ...(prev.platform_configs?.youtube || {}), channel_id: data[0].channel_id } } }));
        } catch (_) { setChannels([]); }
    };

    const handleBrowseVideo = async () => {
        if ((window as any).electronAPI?.selectVideoFile) {
            const r = await (window as any).electronAPI.selectVideoFile();
            if (r.success && r.path) {
                setForm({ ...form, video_file_path: r.path });
                return;
            }
        }
        fileInputRef.current?.click();
    };

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setForm({ ...form, video_file_path: file.name });
        toast({ title: "파일 선택됨", description: file.name });
    };

    const handleDraftSave = async () => {
        if (!form.title.trim()) { toast({ variant: "destructive", title: "필수", description: "제목은 필수입니다" }); return; }

        const payload: any = {
            title: form.title,
            description: form.description,
            tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
            hashtags: form.hashtags.split(/[ ,]+/).map((t: string) => t.startsWith('#') ? t : `#${t}`).filter((t: string) => t.length > 1),
            source_external_id: form.source_external_id,
            source_type: form.source_type,
            target_platforms: form.target_platforms,
            platform_configs: form.platform_configs,
            upload_method: form.upload_method
        };
        if (form.video_file_path) payload.video_file_path = form.video_file_path;

        try {
            const url = initialData ? `/api/work-queue/items/${initialData.id}` : '/api/work-queue/items/draft';
            const method = initialData ? 'PATCH' : 'POST';
            const r = await fetchWithRetry(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (r.ok) { toast({ title: "임시 보관됨", description: "기본 정보가 저장되었습니다. 나중에 영상을 첨부하고 즉시 등록할 수 있습니다." }); setIsOpen(false); onSuccess(); setForm(defaultForm); }
            else { const e = await r.json(); toast({ variant: "destructive", title: "오류", description: e.detail }); }
        } catch (_) { toast({ variant: "destructive", title: "오류", description: "임시 저장 실패" }); }
    };

    const handleImmediateSubmit = async (e: any) => {
        e.preventDefault();
        if (!form.title.trim()) { toast({ variant: "destructive", title: "필수", description: "제목은 필수입니다" }); return; }

        const payload = {
            ...form,
            tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
            hashtags: form.hashtags.split(/[ ,]+/).map((t: string) => t.startsWith('#') ? t : `#${t}`).filter((t: string) => t.length > 1),
            source_external_id: form.source_external_id,
            scheduled_upload_time: form.scheduleMode === 'scheduled' ? form.scheduledTime : null,
        };

        const isEditingDraft = initialData && (initialData.status === 'DRAFT' || initialData.status === 'PENDING');
        const videoChanged = isEditingDraft && form.video_file_path && form.video_file_path !== initialData.video_file_path;

        // Validation: must have video unless it's an existing draft with video already attached
        const alreadyHasVideo = isEditingDraft && initialData.video_file_path && !videoChanged;
        if (!form.video_file_path.trim() && !alreadyHasVideo) {
            toast({ variant: "destructive", title: "필수", description: "영상 파일을 선택해주세요" });
            return;
        }
        if (form.target_platforms.includes('youtube') && !form.platform_configs.youtube.channel_id) {
            toast({ variant: "destructive", title: "필수", description: "채널을 선택해주세요" });
            return;
        }

        try {
            if (isEditingDraft) {
                // Step 1: Update metadata
                const metaPayload: any = {
                    title: payload.title,
                    description: payload.description,
                    hashtags: payload.hashtags,
                    tags: payload.tags,
                    source_external_id: payload.source_external_id,
                    source_type: payload.source_type,
                    target_platforms: payload.target_platforms,
                    platform_configs: payload.platform_configs,
                    upload_method: payload.upload_method,
                    scheduled_upload_time: payload.scheduled_upload_time,
                };
                const r1 = await fetchWithRetry(`/api/work-queue/items/${initialData.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(metaPayload)
                });
                if (!r1.ok) { const e = await r1.json(); throw new Error(e.detail || 'Metadata update failed'); }

                // Step 2: Attach video if changed
                if (videoChanged) {
                    const r2 = await fetchWithRetry(`/api/work-queue/items/${initialData.id}/attach`, {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ video_file_path: form.video_file_path })
                    });
                    if (!r2.ok) { const e = await r2.json(); throw new Error(e.detail || 'Video attach failed'); }
                }

                // Step 3: Finalize (DRAFT/PENDING → QUEUED + trigger upload)
                const r3 = await fetchWithRetry(`/api/work-queue/items/${initialData.id}/finalize`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        approval_required: false,
                        upload_method: form.upload_method,
                        target_platforms: form.target_platforms,
                        scheduled_upload_time: form.scheduleMode === 'scheduled' ? form.scheduledTime : null,
                    })
                });
                if (!r3.ok) { const e = await r3.json(); throw new Error(e.detail || 'Finalize failed'); }
                const f3 = await r3.json();
                toast({ title: "등록됨", description: f3.upload_queued ? "대기열 등록 및 업로드 시작됨" : "대기열에 등록됨" });
            } else {
                // New item: use the full POST with video
                const fullPayload = { ...payload, video_file_path: form.video_file_path };
                const r = await fetchWithRetry('/api/work-queue/items', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fullPayload)
                });
                if (r.ok) { toast({ title: "등록됨", description: "대기열에 추가되었습니다" }); }
                else { const e = await r.json(); toast({ variant: "destructive", title: "오류", description: e.detail }); return; }
            }
            setIsOpen(false);
            onSuccess();
            setForm(defaultForm);
        } catch (err: any) {
            toast({ variant: "destructive", title: "등록 실패", description: err?.message || '서버 오류' });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card text-foreground border-border">
                <DialogHeader><DialogTitle>{initialData ? '항목 수정' : '새 항목'}</DialogTitle><DialogDescription>기본 정보를 입력하고 영상을 첨부하세요</DialogDescription></DialogHeader>
                <form onSubmit={handleImmediateSubmit} className="space-y-4">
                    <Tabs defaultValue="basic" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-3"><TabsTrigger value="basic">기본 정보</TabsTrigger><TabsTrigger value="upload">업로드 설정</TabsTrigger><TabsTrigger value="platform">플랫폼</TabsTrigger></TabsList>
                        <TabsContent value="basic" className="space-y-4">
                            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
                                <div><Label>제목 *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-background border-border" /></div>
                                <div><Label>설명</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} className="bg-background border-border" /></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><Label>해시태그</Label><Input value={form.hashtags} onChange={e => setForm({ ...form, hashtags: e.target.value })} placeholder="#shorts #viral" className="bg-background border-border" /></div>
                                    <div><Label>태그 (쉼표 구분)</Label><Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="tag1, tag2" className="bg-background border-border" /></div>
                                </div>
                                <div>
                                    <Label>영상 파일 *</Label>
                                    <div className="flex gap-2 mt-1">
                                        <Input value={form.video_file_path} onChange={e => setForm({ ...form, video_file_path: e.target.value })} placeholder="파일을 선택하거나 경로를 입력하세요" className="bg-background border-border flex-1" />
                                        <Button type="button" variant="outline" onClick={handleBrowseVideo} className="shrink-0">
                                            <FolderOpen className="w-4 h-4 mr-1" /> 찾아보기
                                        </Button>
                                        <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelected} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><Label>외부 ID</Label><Input value={form.source_external_id} onChange={e => setForm({ ...form, source_external_id: e.target.value })} placeholder="예: CSV 행 ID" className="bg-background border-border" /></div>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t">
                                    <div>
                                        <Label>쇼핑 태그</Label><p className="text-xs text-muted-foreground">업로드 시 제품 자동 태깅</p>
                                    </div>
                                    <Switch checked={form.enable_shopping_tag} onCheckedChange={c => setForm({ ...form, enable_shopping_tag: c })} />
                                </div>
                                {form.enable_shopping_tag && (
                                    <div className="bg-muted/40 p-3 rounded-lg">
                                        <Label>제품 키워드</Label>
                                        <div className="flex gap-2 mt-1">
                                            <Input value={form.shopping_tag_keyword} onChange={e => setForm({ ...form, shopping_tag_keyword: e.target.value })} placeholder="예: 캠핑 의자" className="bg-background border-border" />
                                            <Button type="button" variant="secondary" onClick={async () => {
                                                try {
                                                    const r = await fetchWithRetry('/api/work-queue/extract-shopping-keyword', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: form.title, description: form.description }) });
                                                    const d = await r.json();
                                                    if (d.keyword) setForm({ ...form, shopping_tag_keyword: d.keyword });
                                                } catch (_) { }
                                            }} disabled={isGenerating}>AI 추출</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                        <TabsContent value="upload" className="space-y-4">
                            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
                                <div><Label>소스</Label><Select value={form.source_type} onValueChange={v => setForm({ ...form, source_type: v })}><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MANUAL">수동</SelectItem><SelectItem value="WORKFLOW">워크플로우</SelectItem><SelectItem value="BULK_IMPORT">일괄 가져오기</SelectItem></SelectContent></Select></div>
                                <div><Label>업로드 방식</Label><Select value={form.upload_method} onValueChange={v => setForm({ ...form, upload_method: v })}><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="API">Google API</SelectItem><SelectItem value="BROWSER_AUTO">브라우저 자동화</SelectItem><SelectItem value="MANUAL">수동</SelectItem></SelectContent></Select></div>
                                <div className="flex items-center gap-2 pt-3 border-t"><Checkbox checked={form.approval_required} onCheckedChange={c => setForm({ ...form, approval_required: !!c })} /><Label>승인 필요 (체크 해제 시 자동 대기열)</Label></div>
                                <div>
                                    <Label>스케줄</Label>
                                    <div className="flex gap-4 mt-1">
                                        <label className="flex items-center gap-2"><input type="radio" checked={form.scheduleMode === 'immediate'} onChange={() => setForm({ ...form, scheduleMode: 'immediate' })} /> 즉시</label>
                                        <label className="flex items-center gap-2"><input type="radio" checked={form.scheduleMode === 'scheduled'} onChange={() => setForm({ ...form, scheduleMode: 'scheduled' })} /> 예약</label>
                                    </div>
                                    {form.scheduleMode === 'scheduled' && (
                                        <div className="mt-2"><Input type="datetime-local" value={form.scheduledTime} onChange={e => setForm({ ...form, scheduledTime: e.target.value })} className="bg-background border-border" /></div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="platform" className="space-y-4">
                            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
                                <Label>대상 플랫폼</Label>
                                <div className="flex gap-4">{['youtube', 'tiktok', 'instagram'].map(p => <label key={p} className="flex items-center gap-2"><Checkbox checked={form.target_platforms.includes(p)} onCheckedChange={c => c ? setForm({ ...form, target_platforms: [...form.target_platforms, p] }) : setForm({ ...form, target_platforms: form.target_platforms.filter(x => x !== p) })} /> <span className="capitalize">{p}</span></label>)}</div>
                            </div>
                            {form.target_platforms.includes('youtube') && (
                                <div className="space-y-3 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-200">
                                    <h4 className="font-semibold text-sm text-blue-700 dark:text-blue-400">YouTube</h4>
                                    <div><Label>채널 *</Label><Select value={form.platform_configs.youtube.channel_id} onValueChange={v => setForm({ ...form, platform_configs: { ...form.platform_configs, youtube: { ...form.platform_configs.youtube, channel_id: v } } })} disabled={channels.length === 0}><SelectTrigger className="bg-background"><SelectValue placeholder={channels.length ? "채널 선택" : "연결된 채널 없음"} /></SelectTrigger><SelectContent>{channels.map(ch => <SelectItem key={ch.channel_id} value={ch.channel_id}>{ch.channel_name || ch.title} ({ch.subscriber_count?.toLocaleString()}명)</SelectItem>)}</SelectContent></Select></div>
                                    <div><Label>공개 설정</Label><Select value={form.platform_configs.youtube.privacy} onValueChange={v => setForm({ ...form, platform_configs: { ...form.platform_configs, youtube: { ...form.platform_configs.youtube, privacy: v } } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">공개</SelectItem><SelectItem value="unlisted">미등록</SelectItem><SelectItem value="private">비공개</SelectItem></SelectContent></Select></div>
                                    <div className="flex items-center gap-2"><Checkbox checked={form.platform_configs.youtube.headless_mode} onCheckedChange={c => setForm({ ...form, platform_configs: { ...form.platform_configs, youtube: { ...form.platform_configs.youtube, headless_mode: !!c } } })} disabled={form.upload_method !== 'BROWSER_AUTO'} /><Label>헤드리스 모드</Label></div>
                                </div>
                            )}
                            {form.target_platforms.includes('tiktok') && (
                                <div className="space-y-3 p-4 bg-pink-50/50 dark:bg-pink-900/10 rounded-lg border border-pink-200">
                                    <h4 className="font-semibold text-sm text-pink-700 dark:text-pink-400">TikTok</h4>
                                    <div><Label>계정 *</Label><Select value={form.platform_configs.tiktok.account_id} onValueChange={v => setForm({ ...form, platform_configs: { ...form.platform_configs, tiktok: { ...form.platform_configs.tiktok, account_id: v } } })}><SelectTrigger className="bg-background"><SelectValue placeholder="계정 선택" /></SelectTrigger><SelectContent>{tiktokChannels.map(c => <SelectItem key={c.id} value={c.id}>{c.nickname || c.id}</SelectItem>)}</SelectContent></Select></div>
                                    <div><Label>공개 설정</Label><Select value={form.platform_configs.tiktok.privacy} onValueChange={v => setForm({ ...form, platform_configs: { ...form.platform_configs, tiktok: { ...form.platform_configs.tiktok, privacy: v } } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">공개</SelectItem><SelectItem value="private">비공개</SelectItem></SelectContent></Select></div>
                                    <div className="flex gap-4"><label className="flex items-center gap-2"><Checkbox checked={form.platform_configs.tiktok.allow_comments} onCheckedChange={c => setForm({ ...form, platform_configs: { ...form.platform_configs, tiktok: { ...form.platform_configs.tiktok, allow_comments: !!c } } })} /> 댓글</label><label className="flex items-center gap-2"><Checkbox checked={form.platform_configs.tiktok.allow_duet} onCheckedChange={c => setForm({ ...form, platform_configs: { ...form.platform_configs, tiktok: { ...form.platform_configs.tiktok, allow_duet: !!c } } })} /> Duet</label></div>
                                </div>
                            )}
                            {form.target_platforms.includes('instagram') && (
                                <div className="space-y-3 p-4 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg border border-purple-200">
                                    <h4 className="font-semibold text-sm text-purple-700 dark:text-purple-400">Instagram</h4>
                                    <div><Label>계정 *</Label><Select value={form.platform_configs.instagram.account_id} onValueChange={v => setForm({ ...form, platform_configs: { ...form.platform_configs, instagram: { ...form.platform_configs.instagram, account_id: v } } })}><SelectTrigger className="bg-background"><SelectValue placeholder="계정 선택" /></SelectTrigger><SelectContent>{instagramChannels.map(c => <SelectItem key={c.id} value={c.id}>{c.nickname || c.id}</SelectItem>)}</SelectContent></Select></div>
                                    <div><Label>캡션</Label><Textarea value={form.platform_configs.instagram.caption} onChange={e => setForm({ ...form, platform_configs: { ...form.platform_configs, instagram: { ...form.platform_configs.instagram, caption: e.target.value } } })} rows={2} placeholder="릴스 캡션..." /></div>
                                    <label className="flex items-center gap-2"><Checkbox checked={form.platform_configs.instagram.share_to_feed} onCheckedChange={c => setForm({ ...form, platform_configs: { ...form.platform_configs, instagram: { ...form.platform_configs.instagram, share_to_feed: !!c } } })} /> 피드 공유</label>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-between gap-2 pt-3 border-t">
                        <div>
                            <Button type="button" variant="outline" onClick={handleDraftSave} className="border-slate-300">
                                <Save className="w-4 h-4 mr-1" /> 임시 보관
                            </Button>
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>취소</Button>
                            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                <Rocket className="w-4 h-4 mr-1" /> {initialData ? '수정 완료' : '즉시 등록'}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const BulkImportDialog = ({ isOpen, setIsOpen, onSuccess }: { isOpen: boolean; setIsOpen: (v: boolean) => void; onSuccess: () => void }) => {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [parsedRows, setParsedRows] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [batchId, setBatchId] = useState('');
    const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'done'>('idle');
    const cachedFileBytes = useRef<Uint8Array | null>(null);
    const cachedFileName = useRef<string>('');

    const parseCSVField = (line: string): string[] => {
        const fields: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
                    else { inQuotes = false; }
                } else { current += ch; }
            } else {
                if (ch === '"') { inQuotes = true; }
                else if (ch === ',') { fields.push(current.trim()); current = ''; }
                else { current += ch; }
            }
        }
        fields.push(current.trim());
        return fields;
    };

    const parseCSV = (text: string) => {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { toast({ variant: "destructive", title: "Invalid CSV", description: "Need at least 2 rows (header + data)" }); return; }
        const h = parseCSVField(lines[0]);
        const rows = lines.slice(1).map(line => {
            const vals = parseCSVField(line);
            const obj: any = {};
            h.forEach((k, i) => obj[k] = vals[i] ?? '');
            return obj;
        });
        setHeaders(h);
        normalizeRows(rows, h);
    };

    const parseExcel = async (file: File, rawBytes?: Uint8Array) => {
        try {
            const XLSX = await import('xlsx');
            const ab = rawBytes || new Uint8Array(await file.arrayBuffer());
            const workbook = XLSX.read(ab, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
            if (json.length < 2) { toast({ variant: "destructive", title: "Invalid Excel", description: "Need at least 2 rows" }); return; }
            const h = json[0].map((c: any) => String(c || '').trim());
            setHeaders(h);
            const rows = json.slice(1).map(row => {
                const obj: any = {};
                h.forEach((k: string, i: number) => obj[k] = row[i] != null ? String(row[i]).trim() : '');
                return obj;
            });
            normalizeRows(rows, h);
        } catch (err: any) {
            toast({ variant: "destructive", title: "Excel parse error", description: err?.message || 'Failed to read file' });
        }
    };

    const normalizeRows = (rows: any[], h: string[]) => {
        const tCol = h.find(h => ['title', '제목', 'name'].includes(h.toLowerCase()));
        const dCol = h.find(h => ['description', 'desc', '설명'].includes(h.toLowerCase()));
        const eCol = h.find(h => ['external_id', 'id', '외부id'].includes(h.toLowerCase()));
        const hCol = h.find(h => ['hashtags'].includes(h.toLowerCase()));
        const tagCol = h.find(h => ['tags', '태그'].includes(h.toLowerCase()));
        const umCol = h.find(h => ['upload_method', '업로드방식'].includes(h.toLowerCase()));
        const platCol = h.find(h => ['platforms', '플랫폼'].includes(h.toLowerCase()));
        const ppCol = h.find(h => ['platform_privacy', '공개설정'].includes(h.toLowerCase()));
        const stCol = h.find(h => ['scheduled_time', '예약시간'].includes(h.toLowerCase()));

        if (!tCol) {
            toast({ variant: "destructive", title: "title 컬럼 없음", description: "title, 제목, name 중 하나의 컬럼이 반드시 필요합니다. 템플릿을 다운로드하여 참고하세요." });
            return;
        }

        let skipped = 0;
        const mapped: any[] = [];
        rows.forEach((r, i) => {
            const titleVal = String(r[tCol] || '').trim();
            if (!titleVal) { skipped++; return; }

            const hashtagsRaw = hCol ? String(r[hCol] || '') : '';
            const tagsRaw = tagCol ? String(r[tagCol] || '') : '';

            const item: any = {
                external_id: (eCol ? String(r[eCol] || '') : `row_${i + 1}`).trim() || `row_${i + 1}`,
                title: titleVal,
                description: (dCol ? String(r[dCol] || '') : ''),
                hashtags: hashtagsRaw.split(/[ ,]+/).map((t: string) => t.startsWith('#') ? t : `#${t}`).filter((t: string) => t.length > 1),
                tags: tagsRaw.split(',').map((t: string) => t.trim()).filter(Boolean),
                upload_method: umCol ? String(r[umCol] || '').trim() || 'BROWSER_AUTO' : 'BROWSER_AUTO',
                target_platforms: platCol ? String(r[platCol] || '').split(',').map((p: string) => p.trim()).filter(Boolean) : ['youtube'],
                platform_privacy: ppCol ? String(r[ppCol] || '').trim().toLowerCase() || 'public' : 'public',
                scheduled_time: stCol ? String(r[stCol] || '').trim() || null : null,
            };
            if (item.target_platforms.length === 0) item.target_platforms = ['youtube'];

            mapped.push(item)
        });

        setParsedRows(mapped);
        if (skipped > 0) {
            toast({ title: `${mapped.length} rows parsed`, description: `${skipped}개 항목은 title이 없어 건너뛰었습니다. 총 ${mapped.length}개를 등록합니다.` });
        } else {
            toast({ title: `${mapped.length} rows parsed`, description: `Columns: ${h.join(', ')}` });
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        cachedFileName.current = file.name;
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'csv') {
            const text = await file.text();
            cachedFileBytes.current = new TextEncoder().encode(text);
            parseCSV(text);
        } else if (ext === 'xlsx' || ext === 'xls') {
            const ab = await file.arrayBuffer();
            const bytes = new Uint8Array(ab);
            cachedFileBytes.current = bytes;
            await parseExcel(file, bytes);
        } else {
            toast({ variant: "destructive", title: "Unsupported", description: "Only .csv and .xlsx files are supported" });
        }
    };

    const handleSendDrafts = async () => {
        if (!parsedRows.length) return;
        setSendStatus('sending');
        try {
            const fileName = cachedFileName.current;
            const bytes = cachedFileBytes.current;
            if (bytes && fileName.endsWith('.xlsx')) {
                const base64 = uint8ArrayToBase64(bytes);
                const res = await fetchWithRetry('/api/work-queue/bulk/upload-file', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64_file: base64, file_name: fileName, source_batch_id: batchId || undefined })
                });
                if (!res.ok) {
                    const errBody = await res.json().catch(() => ({}));
                    throw new Error(errBody.detail || `Server error ${res.status}`);
                }
                const result = await res.json();
                if (result.batch_id) setBatchId(result.batch_id);
                toast({ title: `${result.count} drafts created`, description: `Batch: ${result.batch_id?.substring(0, 8)}...` });
                setSendStatus('done');
                setIsOpen(false);
                onSuccess();
                return;
            }
            const items = parsedRows.map(r => {
                const platformConfigs: any = {};
                if (r.platform_privacy) {
                    r.target_platforms?.forEach((p: string) => {
                        platformConfigs[p] = { ...(platformConfigs[p] || {}), privacy: r.platform_privacy };
                    });
                }
                return {
                    title: r.title,
                    description: r.description || '',
                    hashtags: r.hashtags || [],
                    tags: r.tags || [],
                    source_external_id: r.external_id,
                    source_type: 'BULK_IMPORT',
                    upload_method: r.upload_method || 'BROWSER_AUTO',
                    target_platforms: r.target_platforms || ['youtube'],
                    platform_configs: Object.keys(platformConfigs).length ? platformConfigs : null,
                    scheduled_upload_time: r.scheduled_time || null,
                };
            });
            const res = await fetchWithRetry('/api/work-queue/items/bulk/import', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, source_batch_id: batchId || undefined })
            });
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(errBody.detail || `Server error ${res.status}`);
            }
            const result = await res.json();
            if (result.batch_id) setBatchId(result.batch_id);
            toast({ title: `${result.count} imported items`, description: `Batch: ${result.batch_id?.substring(0, 8)}...` });
            setSendStatus('done');
            setIsOpen(false);
            onSuccess();
        } catch (err: any) {
            toast({ variant: "destructive", title: "Import failed", description: err?.message || 'Server error' });
            setSendStatus('idle');
        }
    };

    const reset = () => { setParsedRows([]); setHeaders([]); setBatchId(''); setSendStatus('idle'); cachedFileBytes.current = null; cachedFileName.current = ''; if (fileInputRef.current) fileInputRef.current.value = ''; };

    return (
        <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) reset(); }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card text-foreground border-border">
                <DialogHeader><DialogTitle>일괄 등록</DialogTitle><DialogDescription>CSV 또는 Excel 파일로 여러 항목을 한번에 대기열에 등록합니다</DialogDescription></DialogHeader>
                <div className="space-y-4">
                    <Card className="border-2 border-dashed border-border hover:border-indigo-300 transition-colors">
                        <CardContent className="p-8 text-center">
                            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="hidden" id="bulk-import-file-input" />
                            <label htmlFor="bulk-import-file-input" className="cursor-pointer block">
                                <Layers className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                                <h3 className="font-semibold text-foreground mb-1">CSV 또는 Excel 파일 선택</h3>
                                <div className="text-xs text-muted-foreground mb-4">.csv / .xlsx 지원. 첫 행 = 컬럼 헤더</div>
                                <span className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
                                    <FileSpreadsheet className="w-4 h-4 mr-2" />파일 선택
                                </span>
                            </label>
                            <div className="text-xs text-muted-foreground mt-3 flex gap-3 justify-center">
                                <a href="/api/work-queue/template/csv" download className="text-indigo-600 hover:underline flex items-center gap-1"><FileSpreadsheet className="w-3 h-3" />.csv 템플릿</a>
                                <a href="/api/work-queue/template/xlsx" download className="text-indigo-600 hover:underline flex items-center gap-1"><FileSpreadsheet className="w-3 h-3" />.xlsx 템플릿</a>
                            </div>
                        </CardContent>
                    </Card>

                    {parsedRows.length > 0 && (
                        <>
                            <div className="bg-muted/40 rounded-lg p-3 border border-border">
                                <div className="text-xs text-muted-foreground">검출된 컬럼: {headers.map(h => (
                                    <Badge key={h} variant="outline" className="ml-1 text-[11px]">{h}</Badge>
                                ))}</div>
                                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1">
                                    매핑:{" "}
                                    <Badge variant="outline" className="text-[11px]">title→제목</Badge>
                                    <Badge variant="outline" className="text-[11px]">description→설명</Badge>
                                    <Badge variant="outline" className="text-[11px]">external_id→외부ID</Badge>
                                    <Badge variant="outline" className="text-[11px]">hashtags→해시태그</Badge>
                                    <Badge variant="outline" className="text-[11px]">tags→태그</Badge>
                                    <Badge variant="outline" className="text-[11px]">upload_method→업로드방식</Badge>
                                    <Badge variant="outline" className="text-[11px]">platforms→플랫폼</Badge>
                                    <Badge variant="outline" className="text-[11px]">platform_privacy→공개설정</Badge>
                                    <Badge variant="outline" className="text-[11px]">scheduled_time→예약시간</Badge>
                                </div>
                            </div>

                            <div className="max-h-64 overflow-auto rounded border border-border">
                                <table className="w-full text-xs border-collapse">
                                    <thead><tr className="bg-muted/50">
                                        <th className="p-2 text-left border-b w-8">#</th>
                                        <th className="p-2 text-left border-b">외부 ID</th>
                                        <th className="p-2 text-left border-b">제목</th>
                                        <th className="p-2 text-left border-b">설명</th>
                                        <th className="p-2 text-left border-b">해시태그</th>
                                        <th className="p-2 text-left border-b">플랫폼</th>
                                        <th className="p-2 text-left border-b">공개</th>
                                        <th className="p-2 text-left border-b">예약</th>
                                    </tr></thead>
                                    <tbody>{parsedRows.slice(0, 100).map((row: any, i: number) => (
                                        <tr key={i} className="hover:bg-muted/30">
                                            <td className="p-2 text-xs text-muted-foreground border-b">{i + 1}</td>
                                            <td className="p-2 text-xs font-mono border-b">{row.external_id}</td>
                                            <td className="p-2 text-sm truncate max-w-48 border-b">{row.title}</td>
                                            <td className="p-2 text-xs text-muted-foreground truncate max-w-64 border-b">{row.description}</td>
                                            <td className="p-2 text-xs text-muted-foreground max-w-32 border-b truncate">{row.hashtags?.join(' ') || '--'}</td>
                                            <td className="p-2 text-xs text-muted-foreground border-b">{row.target_platforms?.join(', ') || 'youtube'}</td>
                                            <td className="p-2 text-xs text-muted-foreground border-b">{row.platform_privacy || 'public'}</td>
                                            <td className="p-2 text-xs text-muted-foreground border-b">{row.scheduled_time || '--'}</td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                                {parsedRows.length > 100 && <div className="text-xs text-muted-foreground p-2">처음 100개 / 총 {parsedRows.length}개 항목</div>}
                            </div>
                        </>
                    )}
                </div>
                <div className="flex justify-between gap-2 pt-3 border-t">
                    <Button variant="outline" onClick={() => { setIsOpen(false); reset(); }}>취소</Button>
                    <Button onClick={handleSendDrafts} disabled={sendStatus === 'sending' || !parsedRows.length} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        {sendStatus === 'sending' ? '저장 중...' : sendStatus === 'done' ? '수신됨' : <><ArrowRight className="w-4 h-4 mr-2" /> 대기열로 보내기 ({parsedRows.length})</>}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default WorkQueue;