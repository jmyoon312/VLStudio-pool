import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api, { apiLong, Settings as SettingsType } from '../lib/api';
import { Save, FolderOpen, Loader2, Download, Upload, AlertTriangle, FileText, Play, RefreshCcw, XCircle, Settings as SettingsIcon, BrainCircuit, Mic2, MessageSquare, Wrench, Globe, Info, Trash2, Server, Plus, Minus, Search, Zap, Cpu, ExternalLink, Home, Terminal, TrendingUp, RadioReceiver } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import AIModelSelector from '@/components/shared/AIModelSelector';
import { SystemSettingsTab } from './SystemSettingsTab';
import LoopieTab from './LoopieTab';

// Helper Component for Key Lists
const KeyListInput = ({
    label,
    keys,
    onChange,
    placeholder = "sk-..."
}: {
    label: string,
    keys: string[],
    onChange: (keys: string[]) => void,
    placeholder?: string
}) => {
    const [inputVal, setInputVal] = useState("");

    const addKey = () => {
        if (inputVal.trim()) {
            onChange([...keys, inputVal.trim()]);
            setInputVal("");
        }
    };

    return (
        <div className="space-y-2">
            <Label className="text-sm font-medium">{label}</Label>
            <div className="border rounded-md p-2 bg-muted/20 space-y-2 max-h-[120px] overflow-y-auto">
                {keys.length === 0 && <p className="text-xs text-muted-foreground text-center">키가 없습니다.</p>}
                {keys.map((k, i) => (
                    <div key={i} className="flex gap-2">
                        <Input value={k} readOnly className="h-8 text-xs bg-white" type="password" />
                        <Button variant="ghost" size="sm" onClick={() => onChange(keys.filter((_, idx) => idx !== i))} className="h-8 w-8 text-red-500"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <Input
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    placeholder={placeholder}
                    className="h-9 text-sm"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKey())}
                />
                <Button variant="secondary" size="sm" onClick={addKey} className="shrink-0">추가</Button>
            </div>
            <p className="text-[10px] text-muted-foreground">여러 키를 등록하면 순환 사용됩니다.</p>
        </div>
    );
};

const CloakBrowserUpdater = () => {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ['cloakbrowser_version'],
        queryFn: async () => {
            const res = await api.get('/system/cloakbrowser/version');
            return res.data;
        }
    });

    const updateMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post('/system/cloakbrowser/update');
            return res.data;
        },
        onSuccess: (data) => {
            if (data.success) {
                toast.success(data.message || "업데이트 성공");
                queryClient.invalidateQueries({ queryKey: ['cloakbrowser_version'] });
            } else {
                toast.error(data.message || "업데이트 실패");
                console.error(data.logs);
            }
        },
        onError: (err: any) => {
            toast.error("오류 발생: " + err.message);
        }
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                <div className="space-y-1">
                    <div className="font-medium flex items-center gap-2">
                        현재 설치된 버전
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                v{data?.version || 'Unknown'}
                            </Badge>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        CloakBrowser는 유튜브/틱톡 업로드 시 봇 탐지를 우회하는 핵심 엔진입니다.
                    </p>
                </div>
                <Button 
                    onClick={() => updateMutation.mutate()} 
                    disabled={updateMutation.isPending}
                    variant={updateMutation.isPending ? "outline" : "default"}
                    className="min-w-[120px]"
                >
                    {updateMutation.isPending ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            업데이트 중...
                        </>
                    ) : (
                        <>
                            <RefreshCcw className="w-4 h-4 mr-2" />
                            최신버전 패치
                        </>
                    )}
                </Button>
            </div>
            
            {updateMutation.data && !updateMutation.data.success && updateMutation.data.logs && (
                <div className="mt-4 p-3 bg-red-50 text-red-800 text-xs rounded border border-red-200 whitespace-pre-wrap font-mono h-32 overflow-y-auto">
                    {updateMutation.data.logs}
                </div>
            )}
        </div>
    );
};

const Settings = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    // Default global_auto_download to TRUE
    const [formData, setFormData] = useState<Partial<SettingsType>>({
        global_auto_download: true
    });
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Logs State
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [isUpdatingOpenClaw, setIsUpdatingOpenClaw] = useState(false);
    const [isSyncingPaperclip, setIsSyncingPaperclip] = useState(false);
    const [isUpdatingPaperclip, setIsUpdatingPaperclip] = useState(false);
    const [isSyncingOpenClaude, setIsSyncingOpenClaude] = useState(false);
    const [isUpdatingOpenClaude, setIsUpdatingOpenClaude] = useState(false);
    const [isUpdatingYtdlp, setIsUpdatingYtdlp] = useState(false);
    const [agentVersions, setAgentVersions] = useState<Record<string, any>>({});

    const fetchVersions = async () => {
        try {
            const res = await api.get('/settings/versions');
            setAgentVersions(res.data);
        } catch (e) {
            console.error("Failed to fetch versions:", e);
        }
    };

    useEffect(() => {
        fetchVersions();
    }, []);

    // [NEW] Connectivity Test State
    const [testResults, setTestResults] = useState<Record<string, { loading: boolean, success?: boolean, message?: string }>>({});

    // [NEW] Quick Chat Test State
    const [chatInput, setChatInput] = useState("");
    const [chatResponse, setChatResponse] = useState("");
    const [isChatLoading, setIsChatLoading] = useState(false);

    const handleTestChat = async () => {
        if (!chatInput.trim()) return;

        setIsChatLoading(true);
        setChatResponse("");

        try {
            const res = await api.post('/creative/test-chat', {
                message: chatInput,
                provider: formData.script_analysis_provider || 'opencode',
                model: formData.script_analysis_model || 'opencode/deepseek-v4-flash-free'
            });

            setChatResponse(res.data.content || JSON.stringify(res.data, null, 2));
            toast.success("채팅 테스트 응답 성공");
        } catch (e: any) {
            const errorMsg = e.response?.data?.detail || e.message;
            setChatResponse(`오류 발생: ${errorMsg}`);
            toast.error(`채팅 테스트 실패: ${errorMsg}`);
        } finally {
            setIsChatLoading(false);
        }
    };

    const testConnection = async (provider: string, data: any) => {
        setTestResults(prev => ({ ...prev, [provider]: { loading: true } }));
        try {
            const res = await api.post('/settings/test-connection', {
                provider,
                base_url: data.base_url,
                api_key: data.api_key
            });
            setTestResults(prev => ({
                ...prev,
                [provider]: {
                    loading: false,
                    success: res.data.success,
                    message: res.data.message || (res.data.success ? "연결 성공!" : "연결 실패")
                }
            }));
            if (res.data.success) toast.success(`${provider} 연결 성공!`);
            else toast.error(`${provider} 연결 실패: ${res.data.message}`);
        } catch (e: any) {
            setTestResults(prev => ({
                ...prev,
                [provider]: { loading: false, success: false, message: e.message }
            }));
            toast.error(`${provider} 테스트 오류: ${e.message}`);
        }
    };

    // [NEW] Scheduler Status
    const [nextRunTime, setNextRunTime] = useState<string | null>(null);

    const [timeLeft, setTimeLeft] = useState<string>("");

    // [NEW] Cleanup State
    const [cleanupDays, setCleanupDays] = useState<number>(10);

    // [NEW] Fetch Old Videos Count based on cleanupDays
    const { data: oldVideosData, refetch: refetchOldVideos } = useQuery({
        queryKey: ['oldVideosCount', cleanupDays],
        queryFn: async () => (await api.get(`/maintenance/old-videos-count?days=${cleanupDays}`)).data,
        enabled: true
    });

    const handleCleanup = async () => {
        if (!oldVideosData || oldVideosData.count === 0) return;

        if (!confirm(`${cleanupDays}일이 경과한 ${oldVideosData.count}개의 파일을 영구 삭제하시겠습니까?\n\n- 예상 확보 용량: ${oldVideosData.total_size_mb} MB`)) {
            return;
        }

        try {
            const res = await api.post(`/maintenance/cleanup-old-videos?days=${cleanupDays}&dry_run=false`);
            toast.success(`삭제 완료: ${res.data.deleted_count}개 파일 정리됨`);
            refetchOldVideos();
            queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
        } catch (e: any) {
            toast.error(`삭제 실패: ${e.message}`);
        }
    };

    // Poll logs when dialog is open
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isLogOpen) {
            fetchLogs(); // Initial fetch
            fetchSchedulerStatus(); // [NEW] Fetch schedule
            interval = setInterval(fetchLogs, 2000);
        }
        return () => clearInterval(interval);
    }, [isLogOpen]);

    // [NEW] Countdown Timer
    useEffect(() => {
        if (!nextRunTime) {
            setTimeLeft("");
            return;
        }

        const updateTimer = () => {
            const now = new Date();
            const target = new Date(nextRunTime);
            const diff = target.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft("실행 중...");
                // Refetch to see next run if it finished
                if (diff < -5000) fetchSchedulerStatus();
            } else {
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${minutes}분 ${seconds}초 후 실행`);
            }
        };

        updateTimer();
        const timer = setInterval(updateTimer, 1000);
        return () => clearInterval(timer);
    }, [nextRunTime]);

    const fetchSchedulerStatus = async () => {
        try {
            const res = await api.get('/system/scheduler-status');
            if (res.data.next_run) {
                setNextRunTime(res.data.next_run);
            } else {
                setNextRunTime(null);
                setTimeLeft("스케줄러 대기 중");
            }
        } catch (e) {
            console.error("Scheduler status error", e);
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await api.get('/logs/scheduler?lines=500');
            setLogs(res.data.logs || []);
        } catch (e) {
            console.error("Failed to fetch logs", e);
        }
    };

    const clearLogs = async () => {
        if (!confirm("로그 기록을 삭제하시겠습니까?")) return;
        try {
            await api.delete('/logs/scheduler');
            setLogs([]);
            toast.success("로그가 삭제되었습니다.");
        } catch (e) {
            toast.error("로그 삭제 실패");
        }
    };

    const triggerScan = async () => {
        try {
            setIsScanning(true);
            await api.post('/logs/scan');
            toast.success("스캔 요청이 전송되었습니다. 잠시 후 데이터가 갱신됩니다.");

            // [FIX] Aggressive Invalidation to catch Async Backend Updates
            // The backend scan is backgrounded, so we invalidate repeatedly to catch the completion.
            const keys = [['videos'], ['channels'], ['dashboard_stats']];

            // Immediate
            keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));

            // Delayed Refresh Sequence (3s, 8s, 15s)
            [3000, 8000, 15000].forEach(delay => {
                setTimeout(() => {
                    keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
                }, delay);
            });

        } catch (e) {
            toast.error("스캔 시작 실패");
        } finally {
            // Keep spinning for a bit implies "working"
            setTimeout(() => setIsScanning(false), 3000);
        }
    };

    const { data: settings, isLoading } = useQuery<SettingsType>({
        queryKey: ['settings'],
        queryFn: async () => (await api.get('/settings/')).data
    });

    const { data: maintenanceStatus, refetch: refetchMaintenance } = useQuery({
        queryKey: ['maintenanceStatus'],
        queryFn: async () => (await api.get('/system/maintenance-status')).data
    });

    const { data: ytdlpVersion, refetch: refetchVersion } = useQuery({
        queryKey: ['ytdlpVersion'],
        queryFn: async () => (await api.get('/system/ytdlp-version')).data
    });

    // Fetch Available Models for Script AI - Now handled by AIModelSelector component

    useEffect(() => {
        if (settings) {
            setFormData({
                ...settings,
                kokoro_tts_url: settings.kokoro_tts_url || 'https://tts1.gogloo.gleeze.com'
            });
        }
    }, [settings]);

    const updateMutation = useMutation({
        mutationFn: (data: Partial<SettingsType>) => api.put('/settings', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
            toast.success('설정이 저장되었습니다.');
            setIsSaving(false);
        },
        onError: () => {
            toast.error('설정 저장 실패');
            setIsSaving(false);
        }
    });

    const restoreMutation = useMutation({
        mutationFn: (data: Partial<SettingsType>) => api.post('/settings/restore', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
            toast.success('설정이 성공적으로 복원되었습니다.');
        },
        onError: (e: any) => {
            toast.error(`복원 실패: ${e.response?.data?.detail || e.message}`);
        }
    });

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        updateMutation.mutate(formData);
    };

    const handlePickPath = async (field: keyof SettingsType, type: 'folder' | 'file') => {
        try {
            const endpoint = type === 'folder' ? '/system/pick-folder' : '/system/pick-file';
            const res = await api.post(endpoint);
            if (res.data.path) {
                setFormData(prev => ({ ...prev, [field]: res.data.path }));
            }
        } catch (e) {
            console.error("Path picker failed", e);
            toast.error(`${type === 'folder' ? '폴더' : '파일'} 선택 창을 열 수 없습니다.`);
        }
    };

    // --- Backup & Restore Logic ---
    const handleBackup = () => {
        if (!confirm("주의: 백업 파일에는 API 키가 포함됩니다.\n안전한 곳에 보관하세요.\n\n계속하시겠습니까?")) {
            return;
        }

        const backupData = {
            timestamp: new Date().toISOString(),
            settings: formData
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `settings_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success("설정 백업 파일이 다운로드되었습니다.");
    };

    const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (json.settings) {
                    if (confirm(`백업 일자: ${json.timestamp}\n\n이 설정으로 복원하시겠습니까?`)) {
                        restoreMutation.mutate(json.settings);
                    }
                } else {
                    toast.error("올바르지 않은 백업 파일 형식입니다.");
                }
            } catch (err) {
                toast.error("JSON 파싱 오류: 파일이 손상되었거나 올바르지 않습니다.");
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    const handleOpenClawUpdate = async () => {
        if (!confirm("OpenClaw 시스템 최신 업데이트를 진행하시겠습니까?\n(git pull & npm install 수행)")) return;

        setIsUpdatingOpenClaw(true);
        try {
            const res = await api.post('/settings/openclaw/update');
            if (res.data.status === 'success') {
                toast.success(res.data.message || "OpenClaw 업데이트 성공!");
                fetchVersions();
                queryClient.invalidateQueries({ queryKey: ['availableModels'] });
            } else {
                toast.error(`업데이트 실패: ${res.data.message}`);
                console.error("Update logs:", res.data);
            }
        } catch (e: any) {
            toast.error(`업데이트 서버 오류: ${e.message}`);
        } finally {
            setIsUpdatingOpenClaw(false);
        }
    };

    const handlePaperclipSync = () => {
        queryClient.invalidateQueries({ queryKey: ['availableModels'] });
        toast.success("최신 모델 리스트를 동기화했습니다.");
    };

    const handlePaperclipUpdate = async () => {
        if (!confirm("Paperclip 시스템 업데이트를 진행하시겠습니까?")) return;
        setIsUpdatingPaperclip(true);
        try {
            const res = await api.post('/settings/paperclip/update');
            toast.success(res.data.message || "Paperclip 업데이트 완료");
            fetchVersions();
        } catch (e: any) {
            toast.error(`업데이트 실패: ${e.response?.data?.detail || e.message}`);
        } finally {
            setIsUpdatingPaperclip(false);
        }
    };

    const handleOpenClaudeSync = () => {
        queryClient.invalidateQueries({ queryKey: ['availableModels'] });
        toast.success("최신 모델 리스트를 동기화했습니다.");
    };

    const handleOpenClaudeUpdate = async () => {
        if (!confirm("OpenClaude 시스템 업데이트를 진행하시겠습니까?")) return;
        setIsUpdatingOpenClaude(true);
        try {
            const res = await api.post('/settings/openclaude/update');
            toast.success(res.data.message || "OpenClaude 업데이트 완료");
            fetchVersions();
        } catch (e: any) {
            toast.error(`업데이트 실패: ${e.response?.data?.detail || e.message}`);
        } finally {
            setIsUpdatingOpenClaude(false);
        }
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-8 max-w-4xl mx-auto pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">설정</h1>
                    <p className="text-muted-foreground">애플리케이션의 전역 설정을 관리합니다.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleBackup} className="h-9">
                        <Download className="w-4 h-4 mr-2" />
                        설정 백업 (Export)
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-9">
                        <Upload className="w-4 h-4 mr-2" />
                        설정 복원 (Import)
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".json"
                        onChange={handleRestore}
                    />
                </div>
            </div>

            <div className="flex-1">
                <Tabs defaultValue="general" className="w-full">
                    <TabsList className="mb-4 bg-muted/50 p-1 h-auto flex-wrap w-full justify-start">
                        <TabsTrigger value="general" className="gap-2 px-4 h-9">
                            <SettingsIcon className="w-4 h-4" /> 일반
                        </TabsTrigger>
                        <TabsTrigger value="intelligence" className="gap-2 px-4 h-9">
                            <BrainCircuit className="w-4 h-4" /> AI 지능
                        </TabsTrigger>
                        <TabsTrigger value="voice" className="gap-2 px-4 h-9">
                            <Mic2 className="w-4 h-4" /> 음성
                        </TabsTrigger>
                        <TabsTrigger value="subtitles" className="gap-2 px-4 h-9">
                            <MessageSquare className="w-4 h-4" /> 자막
                        </TabsTrigger>
                        <TabsTrigger value="maintenance" className="gap-2 px-4 h-9">
                            <Wrench className="w-4 h-4" /> 관리
                        </TabsTrigger>
                        <TabsTrigger value="hermes" className="gap-2 px-4 h-9">
                            <BrainCircuit className="w-4 h-4 text-indigo-500" /> Loopie 지능
                        </TabsTrigger>
                        <TabsTrigger value="system" className="gap-2 px-4 h-9">
                            <SettingsIcon className="w-4 h-4" /> 시스템
                        </TabsTrigger>
                        <TabsTrigger value="aigrid" className="gap-2 px-4 h-9">
                            <Zap className="w-4 h-4 text-amber-500" /> AI Grid (분산 노드)
                        </TabsTrigger>
                        <TabsTrigger value="browser" className="gap-2 px-4 h-9">
                            <Globe className="w-4 h-4 text-emerald-500" /> 안티디텍트 브라우저
                        </TabsTrigger>
                    </TabsList>

                    {/* --- TAB 1: GENERAL --- */}
                    <TabsContent value="general">
                        <Card>
                            <CardHeader>
                                <CardTitle>다운로드 및 시스템</CardTitle>
                                <CardDescription>파일 경로와 자동화 설정을 관리합니다.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSave} className="space-y-6">
                                    {/* Download Path */}
                                    <div className="space-y-2">
                                        <Label>기본 다운로드 경로</Label>
                                        <div className="flex gap-2">
                                            <input type="text" value={formData.root_download_path || ''} readOnly className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" />
                                            <button type="button" onClick={() => handlePickPath('root_download_path', 'folder')} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-10 px-4 py-2 w-32">
                                                <FolderOpen className="w-4 h-4 mr-2" /> 선택
                                            </button>
                                        </div>
                                    </div>

                                    {/* Cookies */}
                                    <div className="space-y-2">
                                        <Label>쿠키 파일 경로 (선택)</Label>
                                        <div className="flex gap-2">
                                            <input type="text" value={formData.cookies_path || ''} readOnly placeholder="선택된 파일 없음" className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm" />
                                            <button type="button" onClick={() => handlePickPath('cookies_path', 'file')} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-10 px-4 py-2 w-32">
                                                <FolderOpen className="w-4 h-4 mr-2" /> 선택
                                            </button>
                                        </div>
                                    </div>

                                    {/* Auto Download Switch */}
                                    <div className="flex items-center space-x-2 border p-3 rounded bg-slate-50">
                                        <Switch id="global_dl" checked={formData.global_auto_download} onCheckedChange={(c) => setFormData({ ...formData, global_auto_download: c })} />
                                        <Label htmlFor="global_dl" className="cursor-pointer">전역 자동 다운로드 활성화</Label>
                                    </div>

                                    {/* Scan Interval */}
                                    <div className="space-y-2">
                                        <Label>스캔 주기 (분)</Label>
                                        <div className="flex gap-2 items-center">
                                            <Input type="number" value={formData.scan_interval_minutes || 60} onChange={(e) => setFormData({ ...formData, scan_interval_minutes: parseInt(e.target.value) })} className="h-10" />
                                            <Button type="button" variant="outline" onClick={triggerScan} disabled={isScanning} className="shrink-0 gap-2">
                                                {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} 즉시 스캔
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Auto Delete Interval */}
                                    <div className="space-y-2 pt-4 border-t border-dashed">
                                        <Label>영상 파일 자동 삭제 주기 (용량 확보)</Label>
                                        <div className="flex gap-2 items-center">
                                            <Select
                                                value={(formData as any).auto_delete_mp4_days?.toString() || "7"}
                                                onValueChange={(val) => setFormData({ ...formData, auto_delete_mp4_days: parseInt(val) } as any)}
                                            >
                                                <SelectTrigger className="w-[200px] bg-white">
                                                    <SelectValue placeholder="자동 삭제 주기 선택" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="7">7일 후 삭제</SelectItem>
                                                    <SelectItem value="15">15일 후 삭제</SelectItem>
                                                    <SelectItem value="30">1개월 후 삭제</SelectItem>
                                                    <SelectItem value="60">2개월 후 삭제</SelectItem>
                                                    <SelectItem value="0">삭제 안 함</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            * 설정한 기간이 지나면 MP4 영상 파일만 자동 삭제되며, 메타데이터 기록은 유지됩니다.
                                        </p>
                                    </div>

                                    {/* [NEW] Outlier Pre-filtering Configuration */}
                                    <div className="space-y-4 pt-4 border-t border-dashed">
                                        <div className="space-y-0.5">
                                            <Label className="font-bold flex items-center gap-2">
                                                <TrendingUp className="w-4 h-4 text-purple-600" />
                                                수집 기준 (Outlier Thresholds)
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                자동 스캔 시 해당 기준을 넘지 못하는 평범한 영상은 DB에 수집되지 않습니다.
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 border rounded-lg">
                                            <div className="space-y-2">
                                                <Label>쇼츠 영상 EV 기준 (%)</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        value={formData.outlier_ev_threshold ?? 120}
                                                        onChange={e => setFormData({ ...formData, outlier_ev_threshold: parseInt(e.target.value) || 0 })}
                                                    />
                                                    <span className="text-sm font-bold text-muted-foreground">%</span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">
                                                    최근 채널 평균 조회수 대비 목표. (예: 120% = 평균보다 1.2배 높을 때 수집)
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>일반 영상 Ratio 기준</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number" step="0.1"
                                                        value={formData.outlier_ratio_threshold ?? 1.5}
                                                        onChange={e => setFormData({ ...formData, outlier_ratio_threshold: parseFloat(e.target.value) || 0 })}
                                                    />
                                                    <span className="text-sm font-bold text-muted-foreground">x</span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">
                                                    채널 구독자 수 대비 조회수 비율. (예: 1.5 = 구독자보다 1.5배 많을 때 수집)
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Cleanup Old Videos Section */}
                                    <div className="space-y-2 pt-4 border-t border-dashed">
                                        <Label>오래된 영상 정리 (Clean up old videos)</Label>
                                        <div className="flex items-end gap-3 p-3 bg-slate-50 border rounded-lg">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">보관 기간 (일)</Label>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-9 w-9"
                                                        onClick={() => setCleanupDays(Math.max(1, cleanupDays - 1))}
                                                    >
                                                        -
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        value={cleanupDays}
                                                        onChange={(e) => setCleanupDays(Math.max(1, parseInt(e.target.value) || 1))}
                                                        className="h-9 w-16 text-center"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-9 w-9"
                                                        onClick={() => setCleanupDays(cleanupDays + 1)}
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="destructive"
                                                className="h-9 flex-1"
                                                disabled={!oldVideosData || oldVideosData.count === 0}
                                                onClick={handleCleanup}
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                {cleanupDays}일 경과 즉시 삭제
                                                {oldVideosData && oldVideosData.count > 0 && (
                                                    <span className="ml-1 text-xs opacity-80">
                                                        ({oldVideosData.count}개, {oldVideosData.total_size_mb} MB)
                                                    </span>
                                                )}
                                            </Button>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            * 설정한 기간이 지난 원본 영상과 스크립트 파일을 즉시 삭제합니다.
                                        </p>
                                    </div>

                                    <Button type="submit" disabled={isSaving} className="w-full md:w-auto">
                                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 저장
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* --- TAB 2: INTELLIGENCE (LLM + Search) --- */}
                    <TabsContent value="intelligence">
                        <div className="space-y-6">
                            <Alert className="bg-blue-50 border-blue-200">
                                <BrainCircuit className="h-4 w-4 text-blue-600" />
                                <AlertTitle className="text-blue-800">AI 모델 및 검색 설정</AlertTitle>
                                <AlertDescription className="text-blue-700 text-xs">
                                    대본 작성, 분석, 그리고 웹 검색을 위한 API 키를 관리합니다. 여러 키를 입력하면 자동으로 순환하여 사용됩니다.
                                </AlertDescription>
                            </Alert>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                {/* Left Column: LLM Keys */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>LLM API 설정</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <KeyListInput
                                            label="Groq API Keys (Llama 3 고속 생성)"
                                            keys={formData.groq_api_keys || []}
                                            onChange={k => setFormData({ ...formData, groq_api_keys: k })}
                                            placeholder="gsk_..."
                                        />
                                        <KeyListInput
                                            label="Gemini API Keys"
                                            keys={formData.gemini_api_keys || []}
                                            onChange={k => setFormData({ ...formData, gemini_api_keys: k })}
                                            placeholder="sk-..."
                                        />
                                        <KeyListInput
                                            label="Fal.ai API Keys (Video/Image Gen)"
                                            keys={formData.fal_api_keys || []}
                                            onChange={k => setFormData({ ...formData, fal_api_keys: k })}
                                            placeholder="fal_..."
                                        />
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <Label>OpenRouter API Key</Label>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 text-[10px] px-2"
                                                    onClick={() => testConnection("openrouter", { api_key: formData.openrouter_api_key })}
                                                    disabled={testResults["openrouter"]?.loading}
                                                >
                                                    {testResults["openrouter"]?.loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCcw className="w-3 h-3 mr-1" />}
                                                    테스트
                                                </Button>
                                            </div>
                                            <Input type="password" value={formData.openrouter_api_key || ''} onChange={e => setFormData({ ...formData, openrouter_api_key: e.target.value })} placeholder="or-..." />
                                        </div>

                                        <div className="space-y-2 pt-4 border-t border-dashed">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <Zap className="w-4 h-4 text-purple-600" />
                                                    <Label className="font-bold">OpenCode Zen API Keys</Label>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 gap-1"
                                                    onClick={() => testConnection("opencode", { api_key: formData.opencode_api_keys?.[0] })}
                                                    disabled={testResults["opencode"]?.loading}
                                                >
                                                    {testResults["opencode"]?.loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCcw className="w-3 h-3 mr-1" />}
                                                    테스트
                                                </Button>
                                            </div>
                                            <KeyListInput
                                                label=""
                                                keys={formData.opencode_api_keys || []}
                                                onChange={k => setFormData({ ...formData, opencode_api_keys: k })}
                                                placeholder="sk-..."
                                            />
                                            <p className="text-[10px] text-muted-foreground">
                                                * OpenAI 호환 무료 모델 (DeepSeek V4 Flash, Nemotron 3, Qwen 3.6 등) 지원
                                            </p>
                                            {testResults["opencode"] && !testResults["opencode"].loading && (
                                                <Alert className={cn("py-2", testResults["opencode"].success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
                                                    <AlertDescription className={cn("text-[10px]", testResults["opencode"].success ? "text-green-700" : "text-red-700")}>
                                                        {testResults["opencode"].message}
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                        </div>

                                        {/* [NEW] Ollama Settings */}
                                        <div className="pt-4 border-t border-dashed space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Server className="w-4 h-4 text-orange-600" />
                                                    <Label className="font-bold">로컬 지능 (Ollama)</Label>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 gap-1"
                                                    onClick={() => testConnection("ollama", { base_url: formData.ollama_api_base_url })}
                                                    disabled={testResults["ollama"]?.loading}
                                                >
                                                    {testResults["ollama"]?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                                                    연결 확인
                                                </Button>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">API Base URL</Label>
                                                <Input
                                                    value={formData.ollama_api_base_url || 'http://localhost:11434/v1'}
                                                    onChange={e => setFormData({ ...formData, ollama_api_base_url: e.target.value })}
                                                    placeholder="http://localhost:11434/v1"
                                                />
                                                <p className="text-[10px] text-muted-foreground">
                                                    * 로컬에 설치된 Ollama 서버 주소입니다. (Gemma 3/4 백업용)
                                                </p>
                                            </div>
                                            {testResults["ollama"] && !testResults["ollama"].loading && (
                                                <Alert className={cn("py-2", testResults["ollama"].success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
                                                    <AlertDescription className={cn("text-[10px]", testResults["ollama"].success ? "text-green-700" : "text-red-700")}>
                                                        {testResults["ollama"].message}
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                        </div>

                                        <KeyListInput
                                            label="SambaNova API Keys (Multi-line)"
                                            keys={formData.sambanova_api_keys || []}
                                            onChange={k => setFormData({ ...formData, sambanova_api_keys: k })}
                                            placeholder="sk-..."
                                        />
                                        <div className="pt-4 border-t border-dashed space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Cpu className="w-4 h-4 text-green-600" />
                                                    <Label className="font-bold">NVIDIA NIM (Cloud/API)</Label>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 gap-1"
                                                    onClick={() => testConnection("nvidia", { api_key: formData.nvidia_api_keys?.[0] })}
                                                    disabled={testResults["nvidia"]?.loading}
                                                >
                                                    {testResults["nvidia"]?.loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCcw className="w-3 h-3 mr-1" />}
                                                    테스트
                                                </Button>
                                            </div>
                                            <KeyListInput
                                                label=""
                                                keys={formData.nvidia_api_keys || []}
                                                onChange={k => setFormData({ ...formData, nvidia_api_keys: k })}
                                                placeholder="nvapi-..."
                                            />
                                        </div>
                                        <KeyListInput
                                            label="Cerebras API Keys (Multi-line)"
                                            keys={formData.cerebras_api_keys || []}
                                            onChange={k => setFormData({ ...formData, cerebras_api_keys: k })}
                                            placeholder="sk-..."
                                        />
                                        <div className="pt-4 border-t border-dashed space-y-4">
                                            <div className="flex items-center gap-2">
                                                <RadioReceiver className="w-4 h-4 text-orange-600" />
                                                <Label className="font-bold">YouTube1 (Custom OpenAI API)</Label>
                                            </div>
                                            <KeyListInput
                                                label=""
                                                keys={(formData as any).youtube1_api_keys || []}
                                                onChange={k => setFormData({ ...formData, youtube1_api_keys: k } as any)}
                                                placeholder="sk-..."
                                            />
                                            <p className="text-[10px] text-muted-foreground">
                                                * http://localhost:20128/v1 (9router API) 모델: youtube1
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Right Column: Web Search & Model Config */}
                                <div className="space-y-6">
                                    <Card className="border-indigo-200 bg-indigo-50/30">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Search className="w-4 h-4 text-indigo-600" /> Web Search Strategy
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-1">
                                                <Label>Search Engine Strategy</Label>
                                                <Select
                                                    value={formData.web_search_engine || "searxng_first"}
                                                    onValueChange={(val) => setFormData({ ...formData, web_search_engine: val })}
                                                >
                                                    <SelectTrigger className="bg-white">
                                                        <SelectValue placeholder="Select Strategy" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="searxng_first">SearXNG (Backup: Tavily)</SelectItem>
                                                        <SelectItem value="tavily_first">Tavily (Backup: SearXNG)</SelectItem>
                                                        <SelectItem value="searxng_only">SearXNG Only</SelectItem>
                                                        <SelectItem value="tavily_only">Tavily Only</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-[10px] text-muted-foreground">
                                                    * 검색 엔진 우선순위를 설정합니다. (기본값: SearXNG 우선)
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-sky-200 bg-sky-50/30">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Globe className="w-4 h-4 text-sky-600" /> Web Search (Tavily)
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <KeyListInput
                                                label="Tavily API Keys (리서치 도구)"
                                                keys={formData.tavily_api_keys || []}
                                                onChange={k => setFormData({ ...formData, tavily_api_keys: k })}
                                                placeholder="tvly-..."
                                            />
                                            <p className="text-[10px] text-muted-foreground mt-2">
                                                * 키가 없으면 리서치 기능이 'Mock(가상)' 모드로 동작합니다.
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-orange-200 bg-orange-50/30">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Search className="w-4 h-4 text-orange-600" /> Web Search (SearXNG)
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2">

                                            <div className="space-y-1">
                                                <Label>SearXNG Server URL</Label>
                                                <Input
                                                    value={formData.searxng_url || ''}
                                                    onChange={e => setFormData({ ...formData, searxng_url: e.target.value })}
                                                    placeholder="https://search.gogloo.gleeze.com/search"
                                                />
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">
                                                * 유튜브 키워드 검색기에서 사용하는 검색 엔진 주소입니다.
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-purple-200 bg-purple-50/30">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Globe className="w-4 h-4 text-purple-600" /> Web Fetch (Jina Reader)
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            <div className="space-y-1">
                                                <Label>Jina Reader Endpoint</Label>
                                                <Input
                                                    value={formData.jina_reader_endpoint || ''}
                                                    onChange={e => setFormData({ ...formData, jina_reader_endpoint: e.target.value })}
                                                    placeholder="http://localhost:20128/v1/web/fetch"
                                                />
                                            </div>
                                            <KeyListInput
                                                label="Jina API Keys"
                                                keys={formData.jina_reader_api_keys || []}
                                                onChange={k => setFormData({ ...formData, jina_reader_api_keys: k })}
                                                placeholder="Bearer sk-..."
                                            />
                                            <p className="text-[10px] text-muted-foreground mt-2">
                                                * 실시간 트렌드 및 블루오션 시그널 수집에 사용되는 고성능 웹 스크래퍼입니다.
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>기본 분석 모델</CardTitle>
                                            <CardDescription>
                                                대본 작성, 분석, 그리고 검색을 위한 AI 기능을 관리합니다. 여러 키를 입력하여 자동으로 순환하여 사용합니다.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <AIModelSelector
                                                provider={formData.script_analysis_provider || 'opencode'}
                                                onProviderChange={(val) => setFormData(prev => ({ ...prev, script_analysis_provider: val }))}
                                                model={formData.script_analysis_model || 'opencode/deepseek-v4-flash-free'}
                                                onModelChange={(val) => setFormData(prev => ({ ...prev, script_analysis_model: val }))}
                                                showPreset={false}
                                            />
                                        </CardContent>
                                    </Card>

                                    {/* [NEW] Quick Model Verification Chat */}
                                    <Card className="border-blue-200 bg-blue-50/10">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-800">
                                                <MessageSquare className="w-4 h-4" /> 지능 검증 퀵 채팅
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                위에서 선택한 모델과 직접 대화하여 기능을 확인합니다.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="질문을 입력하세요... (예: 안녕?)"
                                                    value={chatInput}
                                                    onChange={e => setChatInput(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleTestChat()}
                                                    disabled={isChatLoading}
                                                    className="bg-white"
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={handleTestChat}
                                                    disabled={isChatLoading || !chatInput.trim()}
                                                    className="bg-blue-600 hover:bg-blue-700"
                                                >
                                                    {isChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "전송"}
                                                </Button>
                                            </div>

                                            {chatResponse && (
                                                <div className="p-3 rounded-lg bg-white border border-blue-100 shadow-sm">
                                                    <p className="text-[10px] uppercase font-bold text-blue-500 mb-1">AI Response</p>
                                                    <div className="text-xs whitespace-pre-wrap leading-relaxed text-slate-700 font-medium">
                                                        {chatResponse}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* [NEW] Pluggable Cognitive Brain Configurations */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <BrainCircuit className="w-5 h-5 text-indigo-600 animate-pulse" />
                                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">에이전트 지능 코어 설정 (Agentic OS Brains)</h3>
                                        </div>

                                        {/* 1. OpenClaude (마스터 기획 / 스텔스 운영) */}
                                        <Card className="border-purple-200 bg-purple-50/20 overflow-hidden">
                                            <CardHeader className="pb-3">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-2 bg-purple-100 rounded-lg">
                                                            <Wrench className="w-5 h-5 text-purple-600" />
                                                        </div>
                                                        <div>
                                                            <CardTitle className="text-lg font-bold text-purple-900">OpenClaude / OpenHands</CardTitle>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] h-4">Master Planner / Stealth Operator</Badge>
                                                                <span className="text-[10px] text-purple-600/70 italic">Logical AI Core</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <CardDescription className="text-purple-800/70 text-xs mb-1 leading-relaxed">
                                                    전체 생산 파이프라인 기획(OpenClaude) 및 OS/코드 터미널 실행(OpenHands)을 담당하는 지휘 통제 모델을 설정합니다.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <AIModelSelector
                                                    provider={formData.openclaude_provider || 'google'}
                                                    onProviderChange={(val) => setFormData(prev => ({ ...prev, openclaude_provider: val }))}
                                                    model={formData.openclaude_model || ''}
                                                    onModelChange={(val) => setFormData(prev => ({ ...prev, openclaude_model: val }))}
                                                    showPreset={false}
                                                />
                                            </CardContent>
                                        </Card>

                                        {/* 2. Hermes (추론 & 자율 생산) */}
                                        <Card className="border-indigo-300 bg-indigo-50/20 overflow-hidden">
                                            <CardHeader className="pb-3">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-2 bg-indigo-100 rounded-lg">
                                                            <Cpu className="w-5 h-5 text-indigo-600" />
                                                        </div>
                                                        <div>
                                                            <CardTitle className="text-lg font-bold text-indigo-900">Hermes 지능 & 워크플로우</CardTitle>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px] h-4">Worker Bees</Badge>
                                                                <span className="text-[10px] text-indigo-600/70 italic">Strategy & Reasoning Engine</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 gap-2 bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                                                            onClick={() => window.open(`http://${window.location.hostname}:9119`, '_blank')}
                                                        >
                                                            <ExternalLink className="w-3 h-3" /> n8n 대시보드
                                                        </Button>
                                                    </div>
                                                </div>

                                                <CardDescription className="text-indigo-800/70 text-xs mb-1 leading-relaxed">
                                                    ViraLoop의 세부 작업 실행 및 자율 콘텐츠 생산을 처리하는 논리 엔진을 설정합니다. n8n 워크플로우 대시보드에서 연동 상태를 관리할 수 있습니다.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <AIModelSelector
                                                    provider={(formData as any).hermes_agent_provider || 'google'}
                                                    onProviderChange={(val) => setFormData(prev => ({ ...prev, hermes_agent_provider: val } as any))}
                                                    model={(formData as any).hermes_agent_model || ''}
                                                    onModelChange={(val) => setFormData(prev => ({ ...prev, hermes_agent_model: val } as any))}
                                                    showPreset={false}
                                                />
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 animate-spin" />}설정 저장</Button>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="hermes">
                        <LoopieTab />
                    </TabsContent>



                    {/* --- TAB 3: VOICE (TTS) --- */}
                    <TabsContent value="voice">
                        <Card>
                            <CardHeader>
                                <CardTitle>음성 합성 (TTS)</CardTitle>
                                <CardDescription>ElevenLabs, Typecast 등 TTS 서비스 키를 관리합니다.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <KeyListInput
                                        label="ElevenLabs Keys"
                                        keys={formData.elevenlabs_api_keys || []}
                                        onChange={k => setFormData({ ...formData, elevenlabs_api_keys: k })}
                                        placeholder="sk_..."
                                    />
                                    <KeyListInput
                                        label="Typecast API Keys"
                                        keys={formData.typecast_api_keys || []}
                                        onChange={k => setFormData({ ...formData, typecast_api_keys: k })}
                                    />

                                    {/* Supertonic Local Config */}
                                    <div className="space-y-4 pt-4 border-t border-dashed col-span-1 md:col-span-2">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label className="text-base font-bold flex items-center gap-2">
                                                    <Zap className="w-4 h-4 text-amber-500" />
                                                    Supertonic Local (On-Device)
                                                </Label>
                                                <p className="text-xs text-muted-foreground">
                                                    로컬 ONNX 모델을 사용하여 음성을 생성합니다. (빠르고 무료, GPU 권장)
                                                </p>
                                            </div>
                                            <Switch
                                                checked={formData.supertone_local_enabled !== false}
                                                onCheckedChange={c => setFormData({ ...formData, supertone_local_enabled: c })}
                                            />
                                        </div>

                                        <div className="flex gap-4 items-end bg-slate-50 p-4 rounded-lg border">
                                            <div className="space-y-2 flex-1">
                                                <Label>모델 경로 (Models Path)</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={formData.supertone_model_path || 'backend/models/supertonic'}
                                                        onChange={e => setFormData({ ...formData, supertone_model_path: e.target.value })}
                                                        placeholder="backend/models/supertonic"
                                                    />
                                                    <Button variant="outline" onClick={() => handlePickPath('supertone_model_path', 'folder')}>
                                                        <FolderOpen className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <Button
                                                variant="secondary"
                                                onClick={async () => {
                                                    try {
                                                        const res = await api.post('/tools/tts/supertonic/download');
                                                        toast.success(res.data.message || "모델 다운로드 시작됨");
                                                    } catch (e) {
                                                        toast.error("모델 다운로드 요청 실패 (콘솔 확인)");
                                                    }
                                                }}
                                            >
                                                <Download className="w-4 h-4 mr-2" />
                                                모델 다운로드/갱신
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Kokoro TTS 서버 URL</Label>
                                        <Input value={formData.kokoro_tts_url || ''} onChange={e => setFormData({ ...formData, kokoro_tts_url: e.target.value })} />
                                    </div>
                                </div>
                                <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 animate-spin" />}저장</Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* --- TAB 4: SUBTITLES --- */}
                    <TabsContent value="subtitles">
                        <Card>
                            <CardHeader>
                                <CardTitle>자막 및 트랜스크립션</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <Alert>
                                    <Info className="h-4 w-4" />
                                    <AlertTitle>FFmpeg Status</AlertTitle>
                                    <AlertDescription>
                                        {formData.ffmpeg_status && formData.ffmpeg_status !== 'Missing' ? (
                                            <div className="flex flex-col gap-1 mt-1">
                                                <p className="font-mono text-xs bg-black/10 p-1.5 rounded break-all">{formData.ffmpeg_status}</p>
                                                <p className="text-xs text-green-700 font-bold">시스템 내부 FFmpeg가 활성화되어 있습니다.</p>
                                            </div>
                                        ) : (
                                            "시스템 내부 FFmpeg가 활성화되어 있습니다. 별도 설정이 필요하지 않습니다."
                                        )}
                                    </AlertDescription>
                                </Alert>
                                <div className="space-y-2">
                                    <Label>Whisper 모델 경로</Label>
                                    <div className="flex gap-2">
                                        <Input value={formData.whisper_model_path || ''} readOnly />
                                        <Button variant="outline" onClick={() => handlePickPath('whisper_model_path', 'folder')}>선택</Button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>기본 모델 크기</Label>
                                        <Select value={formData.default_model_size || 'base'} onValueChange={v => setFormData({ ...formData, default_model_size: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="base">Base</SelectItem><SelectItem value="small">Small</SelectItem><SelectItem value="medium">Medium</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>기본 언어</Label>
                                        <Select value={formData.default_language || 'ko'} onValueChange={v => setFormData({ ...formData, default_language: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="auto">자동</SelectItem><SelectItem value="ko">한국어</SelectItem><SelectItem value="en">영어</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <Button onClick={handleSave} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 animate-spin" />}저장</Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* --- TAB 5: MAINTENANCE --- */}
                    <TabsContent value="maintenance">
                        <div className="space-y-6">
                            <Card className="border-red-100">
                                <CardHeader>
                                    <CardTitle className="text-red-700">로그 및 초기화</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex gap-2">
                                        <Button variant="secondary" onClick={() => setIsLogOpen(true)} className="w-full">
                                            로그 뷰어 열기
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>시스템 업데이트</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label>yt-dlp 자동 업데이트</Label>
                                            <p className="text-xs text-muted-foreground">매주 최신 버전으로 업데이트합니다.</p>
                                        </div>
                                        <Switch checked={formData.ytdlp_auto_update} onCheckedChange={c => setFormData({ ...formData, ytdlp_auto_update: c })} />
                                    </div>
                                    <div className="pt-2 flex justify-between items-center bg-muted/30 p-3 rounded">
                                        <div className="text-sm">
                                            <span className="text-muted-foreground mr-2">현재 버전:</span>
                                            <span className="font-mono">{ytdlpVersion?.version || maintenanceStatus?.version || 'Unknown'}</span>
                                        </div>
                                        <Button variant="outline" size="sm" disabled={isUpdatingYtdlp} onClick={async () => {
                                            setIsUpdatingYtdlp(true);
                                            try {
                                                const res = await apiLong.post('/system/update-ytdlp');
                                                if (res.data.success) {
                                                    toast.success(res.data.message);
                                                } else {
                                                    toast.error(res.data.message || 'Update Failed');
                                                }
                                                refetchVersion();
                                            } catch (e: any) {
                                                toast.error(e?.response?.data?.message || e?.message || 'Update Failed');
                                            } finally {
                                                setIsUpdatingYtdlp(false);
                                            }
                                        }}>
                                            {isUpdatingYtdlp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {isUpdatingYtdlp ? '업데이트 중...' : '지금 업데이트'}
                                        </Button>
                                    </div>
                                    <Button onClick={handleSave} disabled={isSaving}>설정 저장</Button>
                                </CardContent>
                            </Card>

                            <Card className="border-destructive/50 bg-destructive/5">
                                <CardHeader>
                                    <CardTitle className="text-destructive flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5" />
                                        위험 구역
                                    </CardTitle>
                                    <CardDescription>
                                        데이터베이스를 초기화하면 모든 채널 및 영상 기록이 영구적으로 삭제됩니다.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        className="w-full"
                                        onClick={async () => {
                                            if (confirm("경고: 데이터베이스를 초기화하면 모든 채널 등록 정보와 영상 기록이 삭제됩니다.\n정말로 계속하시겠습니까?")) {
                                                try {
                                                    await api.post('/system/reset-database');
                                                    toast.success("데이터베이스가 초기화되었습니다.");
                                                    queryClient.invalidateQueries();
                                                } catch (e: any) {
                                                    toast.error("초기화 실패: " + e.message);
                                                }
                                            }
                                        }}
                                    >
                                        데이터베이스 초기화
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* --- TAB 6: SYSTEM --- */}
                    <TabsContent value="system">
                        <SystemSettingsTab />
                    </TabsContent>

                    {/* --- TAB 8: BROWSER (Anti-detect) --- */}
                    <TabsContent value="browser">
                        <div className="grid gap-6">
                            <Card className="border-emerald-200">
                                <CardHeader className="bg-emerald-50/50">
                                    <CardTitle className="flex items-center gap-2">
                                        <Globe className="w-5 h-5 text-emerald-600" />
                                        자체 개발 브라우저 (CloakBrowser) 버전 패치
                                    </CardTitle>
                                    <CardDescription>
                                        최신 우회 패치가 적용된 CloakBrowser 버전을 확인하고 자동 업데이트할 수 있습니다.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-6">
                                    <CloakBrowserUpdater />
                                </CardContent>
                            </Card>

                            <Card className="border-emerald-200">
                                <CardHeader className="bg-emerald-50/50">
                                    <CardTitle className="flex items-center gap-2">
                                        <Globe className="w-5 h-5 text-emerald-600" />
                                        서드파티 브라우저 (iXBrowser) 연동 설정
                                    </CardTitle>
                                    <CardDescription>
                                        iXBrowser를 사용할 경우의 로컬 API 주소를 설정합니다.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-6">
                                    <div className="space-y-4 max-w-md">
                                        <div className="space-y-2">
                                            <Label>iXBrowser API Base URL</Label>
                                            <Input
                                                value={formData.ixbrowser_api_url || 'http://127.0.0.1:4320'}
                                                onChange={e => setFormData({ ...formData, ixbrowser_api_url: e.target.value })}
                                                placeholder="http://127.0.0.1:4320"
                                            />
                                            <p className="text-[10px] text-muted-foreground">
                                                * iXBrowser 클라이언트가 실행 중인 로컬 API 주소입니다.
                                            </p>
                                        </div>
                                        <Button onClick={handleSave} disabled={isSaving}>
                                            {isSaving && <Loader2 className="mr-2 animate-spin w-4 h-4" />}설정 저장
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-emerald-200">
                                <CardHeader className="bg-emerald-50/50">
                                    <CardTitle className="flex items-center gap-2">
                                        <Globe className="w-5 h-5 text-emerald-600" />
                                        네트워크 및 다중 프록시 라우팅 전략
                                    </CardTitle>
                                    <CardDescription>
                                        통신사 테더링 차단 우회 및 IP 관리를 위한 프록시 연동 방식을 선택합니다.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-6">
                                    <div className="space-y-4 max-w-xl">
                                        <div className="space-y-2">
                                            <Label>프록시 모드 선택</Label>
                                            <Select value={formData.proxy_mode || 'DIRECT_LTE'} onValueChange={v => setFormData({...formData, proxy_mode: v})}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="프록시 모드를 선택하세요" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="DIRECT_LTE">📱 스마트폰 USB 직접 연결 (LTE 바인딩 - 기본)</SelectItem>
                                                    <SelectItem value="NETSHARE">🔗 안드로이드 프록시 우회 모드 (EveryProxy, NetShare 등)</SelectItem>
                                                    <SelectItem value="ISP_PROXY">🌐 외부 ISP 프록시 (유료 IP)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        
                                        {formData.proxy_mode === 'NETSHARE' && (
                                            <div className="grid grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20">
                                                <div className="space-y-2">
                                                    <Label>NetShare IP 주소</Label>
                                                    <Input 
                                                        value={formData.netshare_ip || '192.168.49.1'} 
                                                        onChange={e => setFormData({...formData, netshare_ip: e.target.value})}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>NetShare 포트</Label>
                                                    <Input 
                                                        type="number"
                                                        value={formData.netshare_port || 8282} 
                                                        onChange={e => setFormData({...formData, netshare_port: parseInt(e.target.value) || 8282})}
                                                    />
                                                </div>
                                                <p className="col-span-2 text-xs text-muted-foreground mt-2">
                                                    * 핸드폰의 NetShare 앱을 켜고 하단에 표시되는 Address와 Port를 입력하세요. (보통 192.168.49.1 : 8282)
                                                </p>
                                            </div>
                                        )}

                                        {formData.proxy_mode === 'ISP_PROXY' && (
                                            <div className="space-y-2 border p-4 rounded-md bg-muted/20">
                                                <Label>ISP 프록시 주소 (SOCKS5 / HTTP)</Label>
                                                <Input 
                                                    value={formData.isp_proxy_url || ''} 
                                                    onChange={e => setFormData({...formData, isp_proxy_url: e.target.value})}
                                                    placeholder="socks5://username:password@12.34.56.78:1080"
                                                />
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    * 구매하신 유료 프록시 주소를 입력하세요. ID/PW 인증이 포함된 주소 형식을 지원합니다.
                                                </p>
                                            </div>
                                        )}
                                        
                                        <Button onClick={handleSave} disabled={isSaving}>
                                            {isSaving && <Loader2 className="mr-2 animate-spin w-4 h-4" />}라우팅 설정 저장
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* --- TAB 7: AI GRID (Nodes) --- */}
                    <TabsContent value="aigrid">
                        <Card className="border-amber-200">
                            <CardHeader className="bg-amber-50/50">
                                <CardTitle className="flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-amber-600" />
                                    AI Grid 분산 노드 설정
                                </CardTitle>
                                <CardDescription>
                                    Audio Node와 Visual Node의 주소 및 API 키를 관리합니다.
                                    (Colab 또는 전용 서버 연동용)
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Audio Node Section */}
                                    <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50">
                                        <div className="flex items-center gap-2 font-bold text-lg text-blue-700">
                                            <Mic2 className="w-5 h-5" /> Audio Node (TTS)
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Node URL</Label>
                                            <Input
                                                value={formData.audio_node_url || ''}
                                                onChange={e => setFormData({ ...formData, audio_node_url: e.target.value })}
                                                placeholder="https://...ngrok-free.dev"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>API Key (Optional)</Label>
                                            <Input
                                                type="password"
                                                value={formData.audio_node_api_key || ''}
                                                onChange={e => setFormData({ ...formData, audio_node_api_key: e.target.value })}
                                                placeholder="Node API Key"
                                            />
                                        </div>
                                        <div className="text-[11px] text-muted-foreground bg-white/50 p-2 rounded border border-dashed">
                                            * Qwen3-TTS 모델이 실행되고 있는 서버 주소를 입력하세요.
                                        </div>
                                    </div>

                                    {/* Visual Node Section */}
                                    <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50">
                                        <div className="flex items-center gap-2 font-bold text-lg text-purple-700">
                                            <Play className="w-5 h-5" /> Visual Node (Image/Video)
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Node URL</Label>
                                            <Input
                                                value={formData.visual_node_url || ''}
                                                onChange={e => setFormData({ ...formData, visual_node_url: e.target.value })}
                                                placeholder="https://...ngrok-free.dev"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>API Key (Optional)</Label>
                                            <Input
                                                type="password"
                                                value={formData.visual_node_api_key || ''}
                                                onChange={e => setFormData({ ...formData, visual_node_api_key: e.target.value })}
                                                placeholder="Node API Key"
                                            />
                                        </div>
                                        <div className="text-[11px] text-muted-foreground bg-white/50 p-2 rounded border border-dashed">
                                            * SDXL 및 Zeroscopev2 모델이 실행되고 있는 서버 주소를 입력하세요.
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 pt-4 border-t">
                                    <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-100">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-bold">주의사항</p>
                                            <p>노드 주소가 올바르지 않으면 AI 자산 생성 기능이 동작하지 않습니다. Ngrok 주소의 경우 일정 시간이 지나면 주소가 변경될 수 있으니 확인 후 업데이트해주세요.</p>
                                        </div>
                                    </div>
                                    <Button onClick={handleSave} disabled={isSaving}>
                                        {isSaving && <Loader2 className="mr-2 animate-spin" />}설정 저장
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Logs Dialog (Kept Global) */}
            <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
                <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>시스템 로그</DialogTitle>
                        <DialogDescription>스케줄러 및 시스템 동작 로그입니다.</DialogDescription>
                        {/* Error Warning Banner */}
                        {logs.some(l => l.includes('ERROR') || l.includes('CRITICAL')) && (
                            <Alert variant="destructive" className="mt-2 py-2">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle className="text-sm font-semibold">오류 발견됨</AlertTitle>
                                <AlertDescription className="text-xs">
                                    로그에 에러 메시지가 포함되어 있습니다. 아래 내용을 확인하세요.
                                </AlertDescription>
                            </Alert>
                        )}
                        {/* Search Input inside Dialog */}
                        <div className="flex gap-2 mt-2">
                            <Input
                                placeholder="로그 검색 (예: ERROR, job_id...)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 text-xs font-mono"
                            />
                            <Button variant="ghost" size="sm" className="h-8 text-red-500" onClick={clearLogs}><Trash2 className="w-4 h-4 mr-1" /> 비우기</Button>
                        </div>
                    </DialogHeader>
                    <ScrollArea className="flex-1 border rounded bg-black p-4">
                        <div className="space-y-1 font-mono text-xs">
                            {logs.filter(l => l.toLowerCase().includes(searchQuery.toLowerCase())).map((log, i) => (
                                <div key={i} className={cn(
                                    "break-all border-b border-slate-200 pb-0.5 mb-0.5",
                                    log.includes("ERROR") ? "text-red-400 font-bold" :
                                        log.includes("WARNING") ? "text-yellow-400" :
                                            log.includes("INFO") ? "text-blue-300" : "text-slate-700"
                                )}>
                                    {log}
                                </div>
                            ))}
                            {logs.length === 0 && <div className="text-slate-500 text-center py-10">로그가 없습니다.</div>}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Settings;
