import React, { useState, useEffect, useRef } from 'react';
import { fetchWithRetry } from "@/lib/utils";
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
    Shield, Clock4, Hash, Paperclip, FileCheck, Files, Filter, Search, ArrowUpDown, FolderOpen, Save, Rocket
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
    const [wsConnections, setWsConnections] = useState<Map<number, WebSocket>>(new Map());
    const [dateFilter, setDateFilter] = useState('all');
    const [limit, setLimit] = useState(20);
    const [searchExternalId, setSearchExternalId] = useState('');
    const [batchId, setBatchId] = useState('');

    useEffect(() => {
        loadQueueItems();
        loadStats();
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
        try {
            let videoPath = '';
            if ((window as any).electronAPI?.selectVideoFile) {
                const r = await (window as any).electronAPI.selectVideoFile();
                if (r.success && r.path) videoPath = r.path;
            }
            if (!videoPath) {
                toast({ variant: "destructive", title: "파일을 선택하지 않음" });
                return;
            }
            const res = await fetchWithRetry(`/api/work-queue/items/${itemId}/attach`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ video_file_path: videoPath }) });
            if (res.ok) { toast({ title: "영상 첨부 완료", description: "승인 대기 상태로 변경됨" }); loadQueueItems(); }
            else throw await res.json();
        } catch (e: any) { toast({ variant: "destructive", title: "첨부 실패", description: e?.detail || '서버 오류' }); }
    };

    const handleFinalize = async (itemId: number) => {
        try {
            const res = await fetchWithRetry(`/api/work-queue/items/${itemId}/finalize`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ approval_required: false }) });
            if (res.ok) { const d = await res.json(); toast({ title: "즉시 등록", description: d.upload_queued ? "대기열 등록됨" : "승인 대기" }); loadQueueItems(); }
            else throw await res.json();
        } catch (e: any) { toast({ variant: "destructive", title: "등록 실패", description: e?.detail || '서버 오류' }); }
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
                <Button
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => { setEditingItem(null); setIsAddDialogOpen(true); }}>
                    <Upload className="w-4 h-4 mr-2" /> 새 항목
                </Button>
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
                                <QueueItemCard key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} onDelete={handleDelete} onEdit={(i: any) => { setEditingItem(i); setIsAddDialogOpen(true); }} onPlay={(i: any) => { setPlayingItem(i); setIsPlayerOpen(true); }} onAttach={handleAttachVideo} onFinalize={handleFinalize} getStatusBadge={getStatusBadge} getApprovalBadge={getApprovalBadge} selectedItems={selectedItems} toggleItemSelection={toggleItemSelection} />
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

const QueueItemCard = ({ item, onApprove, onReject, onDelete, onEdit, onPlay, onAttach, onFinalize, getStatusBadge, getApprovalBadge, selectedItems, toggleItemSelection }: any) => {
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
                            <div className="mt-3 p-3 bg-muted/50 rounded-lg text-xs space-y-2 border border-border">
                                <div className="grid grid-cols-2 gap-3">
                                    <div><span className="font-semibold text-muted-foreground">설명</span><p className="text-foreground mt-0.5">{item.description || '--'}</p></div>
                                    <div><span className="font-semibold text-muted-foreground">파일 경로</span><p className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">{item.video_file_path || '--'}</p></div>
                                    <div><span className="font-semibold text-muted-foreground">업로드 방식</span><p className="mt-0.5">{item.upload_method || 'API'}</p></div>
                                    <div><span className="font-semibold text-muted-foreground">플랫폼 설정</span><p className="mt-0.5">{item.platform_configs?.youtube?.privacy || '기본값'}</p></div>
                                </div>
                                {item.failure_reason && <p className="text-destructive text-xs pt-2 border-t border-border"><strong>실패 사유:</strong> {item.failure_reason}</p>}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {(item.status === 'DRAFT' || !item.video_file_path) && (
                            <>
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
                setForm({ ...defaultForm, ...initialData, source_external_id: initialData.source_external_id || '', tags: Array.isArray(initialData.tags) ? initialData.tags.join(', ') : (initialData.tags || ''), hashtags: Array.isArray(initialData.hashtags) ? initialData.hashtags.join(' ') : (initialData.hashtags || ''), platform_configs: initialData.platform_configs || defaultForm.platform_configs, scheduleMode: initialData.scheduled_upload_time ? 'scheduled' : 'immediate', scheduledTime: initialData.scheduled_upload_time ? (initialData.scheduled_upload_time.includes('T') ? initialData.scheduled_upload_time : initialData.scheduled_upload_time.replace(' ', 'T')).slice(0, 16) : '' });
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
            if (data.length > 0 && !form.platform_configs.youtube.channel_id) setForm(prev => ({ ...prev, platform_configs: { ...prev.platform_configs, youtube: { ...prev.platform_configs.youtube, channel_id: data[0].channel_id } } }));
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

        const payload = {
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
        if (!form.video_file_path.trim()) { toast({ variant: "destructive", title: "필수", description: "영상 파일을 선택해주세요" }); return; }
        if (form.target_platforms.includes('youtube') && !form.platform_configs.youtube.channel_id) { toast({ variant: "destructive", title: "필수", description: "채널을 선택해주세요" }); return; }

        const payload = {
            ...form,
            tags: form.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
            hashtags: form.hashtags.split(/[ ,]+/).map((t: string) => t.startsWith('#') ? t : `#${t}`).filter((t: string) => t.length > 1),
            source_external_id: form.source_external_id,
            scheduled_upload_time: form.scheduleMode === 'scheduled' ? form.scheduledTime : null,
            video_file_path: form.video_file_path
        };

        try {
            const url = initialData ? `/api/work-queue/items/${initialData.id}` : '/api/work-queue/items';
            const method = initialData ? 'PATCH' : 'POST';
            const r = await fetchWithRetry(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (r.ok) { toast({ title: "등록됨", description: "대기열에 추가되었습니다" }); setIsOpen(false); onSuccess(); setForm(defaultForm); }
            else { const e = await r.json(); toast({ variant: "destructive", title: "오류", description: e.detail }); }
        } catch (_) { toast({ variant: "destructive", title: "오류", description: "등록 실패" }); }
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

export default WorkQueue;