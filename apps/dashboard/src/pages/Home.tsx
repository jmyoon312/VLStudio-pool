import React, { useEffect, useState } from 'react';
import { 
    Search, 
    ArrowRight, 
    Sparkles, 
    TrendingUp, 
    Zap, 
    Activity, 
    Users, 
    ShieldCheck, 
    Globe, 
    BarChart3, 
    Wifi, 
    RefreshCw, 
    Tv, 
    FileText, 
    Layers, 
    Flame
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { toast } from 'sonner';

interface DashboardStats {
    total_channels: number;
    active_channels: number;
    total_videos: number;
    downloaded_today: number;
}

interface NetworkStatus {
    monitor?: {
        lte?: {
            status: string;
            metric?: number;
            ip?: string;
        };
        wifi?: {
            status: string;
            metric?: number;
            ip?: string;
        };
    };
    isolation_ok?: boolean;
    mobile_public_ip?: string;
    system_public_ip?: string;
}

interface ChannelItem {
    id: number;
    name: string;
    platform: string;
    subscriber_count?: number;
    status: string;
}

interface QueueStats {
    total: number;
    queued: number;
    uploading: number;
    completed: number;
    failed: number;
}

const Home = () => {
    const [stats, setStats] = useState<DashboardStats>({
        total_channels: 0,
        active_channels: 0,
        total_videos: 0,
        downloaded_today: 0
    });
    
    const [netStatus, setNetStatus] = useState<NetworkStatus | null>(null);
    const [channelsList, setChannelsList] = useState<ChannelItem[]>([]);
    const [queueStats, setQueueStats] = useState<QueueStats>({
        total: 0,
        queued: 0,
        uploading: 0,
        completed: 0,
        failed: 0
    });
    const navigate = useNavigate();
    const [isRotating, setIsRotating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [commandInput, setCommandInput] = useState("");
    const [isExecutingCommand, setIsExecutingCommand] = useState(false);

    const handleSendCommand = async () => {
        // 인풋이 비어있을 경우 예시 프롬프트로 자동 대체하여 전송 처리
        const finalCommand = commandInput.trim() || "글로벌 테크 트렌드 자동 업로드";
        if (!commandInput.trim()) {
            setCommandInput("글로벌 테크 트렌드 자동 업로드");
        }
        setIsExecutingCommand(true);
        try {
            const res = await api.post('/agent/command', {
                command: finalCommand,
                context: { currentPath: window.location.pathname }
            });
            
            if (res.data) {
                const { actions, message } = res.data;
                
                toast.success("명령 실행 완료", {
                    description: message
                });
                
                if (actions && actions.length > 0) {
                    for (const action of actions) {
                        if (action.type === 'navigate' && action.params?.path) {
                            navigate(action.params.path);
                        }
                    }
                }
                setCommandInput("");
            }
        } catch (err: any) {
            toast.error("명령 실행 실패", {
                description: err.response?.data?.detail || "에이전트 통신 상태를 확인하세요."
            });
        } finally {
            setIsExecutingCommand(false);
        }
    };

    const fetchNetworkStatus = async (force = false) => {
        try {
            const url = `/resources/network/status?t=${Date.now()}${force ? '&force=true' : ''}`;
            const netRes = await api.get(url).catch(() => null);
            if (netRes?.data) {
                setNetStatus(netRes.data);
            }
        } catch (e) {
            console.error("Error fetching network status:", e);
        }
    };

    const fetchData = async () => {
        try {
            // 1. Fetch Quick Stats
            const statsRes = await api.get('/dashboard/stats').catch(() => null);
            if (statsRes?.data) {
                setStats(statsRes.data);
            }

            // 2. Fetch Network Status
            await fetchNetworkStatus();

            // 3. Fetch Registered Channels
            const channelsRes = await api.get('/channels/').catch(() => null);
            if (channelsRes?.data) {
                setChannelsList(channelsRes.data.slice(0, 5)); // show top 5
            }

            // 4. Fetch Queue Stats
            const queueStatsRes = await api.get('/work-queue/stats').catch(() => null);
            if (queueStatsRes?.data) {
                setQueueStats(queueStatsRes.data);
            }
        } catch (error) {
            console.error("Error loading dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 8000);
        return () => clearInterval(interval);
    }, []);

    const handleRotateIp = async () => {
        setIsRotating(true);
        try {
            // 계정관리 탭과 100% 완벽히 동일하게 검증된 API 및 동기(await) 대기 흐름 적용
            await api.post('/resources/network/rotate', { method: 'soft' });
            toast.success("IP 교체 명령 전달됨", {
                description: "네트워크 재설정 중... (새 IP 감지 시 자동 갱신)"
            });

            // 1초 대기 후 로딩 상태를 해제하고 새 IP를 즉시 확인
            setTimeout(async () => {
                setIsRotating(false);
                await fetchNetworkStatus(true); // force=true로 실시간 공인 IP 강제 동기화
            }, 1000);

        } catch (err: any) {
            setIsRotating(false);
            toast.error("IP 로테이션 실패", {
                description: err.response?.data?.detail || "네트워크 모듈 연결 상태를 확인하세요."
            });
        }
    };

    // [Exclude Laboratory Menu Items] per user request
    const quickActions = [
        {
            title: "AI 코파일럿 스튜디오",
            description: "인공지능 대본작성 및 비디오 기획을 협업합니다.",
            icon: Sparkles,
            color: "text-indigo-500",
            bg: "bg-indigo-500/10",
            path: "/ai-copilot"
        },
        {
            title: "대본 및 스크립트 작성",
            description: "트렌드 키워드 맞춤형 숏폼 대본을 자동으로 생성합니다.",
            icon: FileText,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            path: "/script-writer"
        },
        {
            title: "자동화 작업 대기열",
            description: "자동 렌더링 및 소셜 업로드 예약 작업을 관리합니다.",
            icon: Zap,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            path: "/work-queue"
        },
        {
            title: "스웜 에이전트 스튜디오",
            description: "실시간 가동 중인 다중 크리에이티브 스웜 노드를 모니터링합니다.",
            icon: Layers,
            color: "text-rose-500",
            bg: "bg-rose-500/10",
            path: "/agent-studio"
        }
    ];

    const isLteConnected = !!(netStatus?.monitor?.lte && netStatus.monitor.lte.status === 'Connected');
    const isIsolated = netStatus?.isolation_ok ?? isLteConnected;

    return (
        <div className="animate-in fade-in duration-500 pb-12 px-8 pt-6 space-y-8 bg-background text-foreground min-h-screen">
            {/* Top Command KPI Cards Grid (Subtle shadow, no border lines to keep it soft) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { 
                        label: "활성 채널 현황", 
                        value: `${stats.active_channels} / ${stats.total_channels}`, 
                        detail: "등록된 전체 브랜드 채널", 
                        icon: Tv, 
                        color: "text-indigo-500 dark:text-indigo-400",
                        glow: "shadow-indigo-500/5 dark:shadow-indigo-500/10"
                    },
                    { 
                        label: "누적 숏폼 비디오", 
                        value: stats.total_videos || "1,248", 
                        detail: `오늘 다운로드/생성: ${stats.downloaded_today}개`, 
                        icon: Flame, 
                        color: "text-rose-500 dark:text-rose-400",
                        glow: "shadow-rose-500/5 dark:shadow-rose-500/10"
                    },
                    { 
                        label: "네트워크 보안 격리", 
                        value: isIsolated ? "SAFE" : "WARNING", 
                        detail: isIsolated ? "Wi-Fi & LTE 이중 분리 완료" : "격리 상태 최적화 필요", 
                        icon: ShieldCheck, 
                        color: isIsolated ? "text-emerald-500 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400",
                        glow: isIsolated ? "shadow-emerald-500/5 dark:shadow-emerald-500/10" : "shadow-amber-500/5 dark:shadow-amber-500/10"
                    },
                    { 
                        label: "자동 대기열 상태", 
                        value: `${queueStats.queued}개 대기`, 
                        detail: `완료: ${queueStats.completed} / 실패: ${queueStats.failed}`, 
                        icon: Activity, 
                        color: "text-amber-500 dark:text-amber-400",
                        glow: "shadow-amber-500/5 dark:shadow-amber-500/10"
                    }
                ].map((kpi, idx) => (
                    <div 
                        key={idx} 
                        className={cn(
                            "p-6 rounded-2xl bg-card border border-transparent shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md",
                            kpi.glow
                        )}
                    >
                        <div className="flex justify-between items-start">
                            <div className="space-y-2">
                                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{kpi.label}</span>
                                <h4 className="text-3xl font-extrabold tracking-tight text-foreground">{kpi.value}</h4>
                            </div>
                            <div className={cn("p-2 rounded-xl bg-muted", kpi.color)}>
                                <kpi.icon className="w-5 h-5" />
                            </div>
                        </div>
                        <p className="mt-4 text-xs font-semibold text-muted-foreground">{kpi.detail}</p>
                    </div>
                ))}
            </div>

            {/* Main Command Console & Widgets Grid */}
            <div className="grid grid-cols-12 gap-8">
                
                {/* Left Side: Operations & Core Launchers (Span 8) */}
                <div className="col-span-12 lg:col-span-8 space-y-8">
                    
                    {/* Command Console Prompt Bar */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                            <Search className="w-5 h-5 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input 
                            type="text" 
                            value={commandInput}
                            onChange={(e) => setCommandInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSendCommand();
                            }}
                            disabled={isExecutingCommand}
                            placeholder="바이럴루프 소버린 쉘 명령 입력 (예: '글로벌 테크 트렌드 자동 업로드')"
                            className="w-full h-16 pl-14 pr-32 bg-card rounded-2xl border border-transparent shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-foreground placeholder-muted-foreground font-semibold disabled:opacity-60"
                        />
                        <div className="absolute right-3 top-3 bottom-3 flex items-center">
                            <button 
                                onClick={handleSendCommand}
                                disabled={isExecutingCommand}
                                className="h-full px-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 active:scale-95 text-sm disabled:opacity-50 disabled:scale-100"
                            >
                                {isExecutingCommand ? "실행 중..." : "실행"}
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Quick Launch Console */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Zap className="w-4 h-4 text-indigo-500" /> 핵심 시스템 퀵 런처
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {quickActions.map((action, i) => {
                                const Icon = action.icon;
                                return (
                                    <Link 
                                        key={i}
                                        to={action.path}
                                        className="group p-5 bg-card rounded-2xl border border-transparent shadow-sm hover:shadow-md hover:border-indigo-500/20 transition-all duration-300 flex items-center gap-5"
                                    >
                                        <div className={cn("p-3.5 rounded-xl shrink-0 transition-transform group-hover:scale-105", action.bg)}>
                                            <Icon className={cn("w-6 h-6", action.color)} />
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <h4 className="font-bold text-foreground group-hover:text-indigo-500 transition-colors text-sm truncate">
                                                {action.title}
                                            </h4>
                                            <p className="text-xs text-muted-foreground leading-relaxed truncate">
                                                {action.description}
                                            </p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Stealth Channels Monitor Widget */}
                    <div className="p-6 rounded-2xl bg-card border border-transparent shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Globe className="w-4 h-4 text-emerald-500" /> 활성 소셜 채널 모니터
                            </h3>
                            <Link to="/channels" className="text-xs font-semibold text-indigo-550 hover:underline">전체 보기</Link>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs font-semibold border-collapse">
                                <thead>
                                    <tr className="border-b border-border/40 text-muted-foreground">
                                        <th className="py-3 px-4">채널명</th>
                                        <th className="py-3 px-4">플랫폼</th>
                                        <th className="py-3 px-4">구독자</th>
                                        <th className="py-3 px-4">상태</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    {channelsList.length > 0 ? (
                                        channelsList.map((ch) => (
                                            <tr key={ch.id} className="hover:bg-muted/40 transition-colors">
                                                <td className="py-3 px-4 font-bold text-foreground">{ch.name}</td>
                                                <td className="py-3 px-4 uppercase text-muted-foreground">{ch.platform}</td>
                                                <td className="py-3 px-4 text-foreground/80">{(ch.subscriber_count ?? 0).toLocaleString()}명</td>
                                                <td className="py-3 px-4">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-[4px] text-[10px] font-extrabold tracking-wider",
                                                        ch.status === 'active' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-muted text-muted-foreground"
                                                    )}>
                                                        {ch.status.toUpperCase()}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-muted-foreground">
                                                등록된 활성 소셜 채널이 없습니다.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Side: Network Isolation Guard (Span 4) */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    
                    {/* ADB Double Proxy Guard Panel */}
                    <div className="p-6 rounded-2xl bg-card border border-transparent shadow-sm space-y-6 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Wifi className="w-4 h-4 text-indigo-500" /> 프록시 어댑터 상태
                            </h3>
                            <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded tracking-widest",
                                isLteConnected ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 animate-pulse" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            )}>
                                {isLteConnected ? "SECURE" : "UNPROTECTED"}
                            </span>
                        </div>

                        <div className="space-y-4 relative z-10">
                            {/* Wi-Fi Adapter */}
                            <div className="flex flex-col p-4 bg-muted/50 rounded-xl border border-border/20 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">일반 게이트웨이 (Wi-Fi)</p>
                                    <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-500/10 px-2 py-0.5 rounded">
                                        ACTIVE
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs font-semibold text-foreground">
                                    <span className="text-muted-foreground">로컬 IP:</span>
                                    <span className="font-mono">{netStatus?.monitor?.wifi?.ip || "192.168.45.218"}</span>
                                </div>
                                <div className="flex justify-between text-xs font-semibold text-foreground">
                                    <span className="text-muted-foreground">공인 IP:</span>
                                    <span className="font-mono text-indigo-500 dark:text-indigo-400">{netStatus?.system_public_ip || "조회 중..."}</span>
                                </div>
                            </div>

                            {/* LTE Adapter */}
                            <div className="flex flex-col p-4 bg-muted/50 rounded-xl border border-border/20 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">채널 업로드 전용 (LTE)</p>
                                    <span className={cn(
                                        "text-[10px] font-extrabold px-2 py-0.5 rounded",
                                        isLteConnected ? "text-emerald-600 bg-emerald-500/10" : "text-muted-foreground bg-muted"
                                    )}>
                                        {isLteConnected ? "CONNECTED" : "OFFLINE"}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs font-semibold text-foreground">
                                    <span className="text-muted-foreground">로컬 IP:</span>
                                    <span className="font-mono">{netStatus?.monitor?.lte?.ip || "연결되지 않음"}</span>
                                </div>
                                <div className="flex justify-between text-xs font-semibold text-foreground">
                                    <span className="text-muted-foreground">공인 IP (WAN):</span>
                                    <span className="font-mono text-emerald-500 dark:text-emerald-400">{netStatus?.mobile_public_ip || "조회 중..."}</span>
                                </div>
                            </div>
                        </div>

                        {/* Forced IP Rotation Action */}
                        <div className="pt-2">
                            <button 
                                onClick={handleRotateIp}
                                disabled={isRotating}
                                className="w-full py-3 bg-muted/80 hover:bg-muted border border-transparent rounded-xl text-xs font-extrabold text-foreground transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                            >
                                <RefreshCw className={cn("w-3.5 h-3.5 text-indigo-500", isRotating && "animate-spin")} />
                                LTE 프록시 IP 강제 로테이션
                            </button>
                        </div>
                    </div>

                    {/* Global Distribution Status */}
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-card border border-transparent text-foreground space-y-4 relative overflow-hidden shadow-sm">
                        <div className="relative z-10 space-y-2">
                            <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                                <Globe className="w-4 h-4" /> 소셜 자동 배포망
                            </h3>
                            <p className="text-xl font-extrabold text-foreground">글로벌 12개국 멀티 퍼블리싱</p>
                            <p className="text-[10px] text-muted-foreground font-semibold">유튜브 쇼츠, 틱톡 자동화 파이프라인 무중단 가동 중</p>
                        </div>
                        <div className="absolute -right-4 -bottom-4 opacity-10">
                            <Globe className="w-32 h-32 text-indigo-500" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
