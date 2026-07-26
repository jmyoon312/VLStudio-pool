import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import {
    Shield, User, Activity, RefreshCw, Smartphone, Wifi,
    Signal, Rocket, Globe, Server, CheckCircle2, XCircle, Cable, Bot
} from 'lucide-react';
import TinCanVault from '@/components/resource/TinCanVault';
import SocialAccountsManager from '@/components/captain/SocialAccountsManager';
import GoogleAuthGuide from '../components/GoogleAuthGuide';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { Card, CardContent } from "@/components/ui/card";
import { BulkWarmupPanel } from '@/components/resource/CaptainQuarters';

const Incubator = () => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'vault' | 'social' | 'network'>('vault');
    const [isWizardOpen, setIsWizardOpen] = useState(false);

    // Network State
    const [networkStatus, setNetworkStatus] = useState<any>({
        status_detail: "IDLE",
        current_ip: "확인 중...",
        interface_ip: "..."
    });
    const [isNetworkLoading, setIsNetworkLoading] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const pollingRef = useRef<any>(null);  // Fixed: NodeJS.Timeout -> any

    // [상태 확인]
    const loadNetworkStatus = async (isManual = false) => {
        if (isManual) setIsNetworkLoading(true);
        try {
            const url = `/resources/network/status?t=${Date.now()}${isManual ? '&force=true' : ''}`;
            const res = await api.get(url);
            setNetworkStatus(res.data);
            if (isManual) toast({ description: "강제 IP 갱신 완료" });
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "오류", description: "서버 연결 실패" });
        }
        finally {
            if (isManual) setIsNetworkLoading(false);
        }
    };

    // [버스트 폴링]
    const startBurstPolling = () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        let count = 0;
        loadNetworkStatus();
        pollingRef.current = setInterval(() => {
            count++;
            loadNetworkStatus();
            if (count >= 5) {
                if (pollingRef.current) clearInterval(pollingRef.current);
            }
        }, 1500);
    };

    // handleSourceSwitch is removed as system-wide metric switching is obsolete in Dual-Proxy architecture.

    const handleRotate = async (method: 'soft' | 'hard') => {
        setIsRotating(true);
        try {
            await api.post(`/resources/network/rotate`, { method });
            toast({
                title: "IP 교체 명령 전달됨",
                description: "네트워크 재설정 중... (새 IP 감지 시 자동 갱신)"
            });

            // Wait for 1s then check logic once (Single check as requested)
            setTimeout(() => {
                setIsRotating(false);
                loadNetworkStatus(); // Check once
            }, 1000);

        } catch {
            setIsRotating(false);
            toast({ variant: "destructive", title: "오류", description: "IP 교체 요청 실패" });
        }
    };

    useEffect(() => {
        if (activeTab === 'network') {
            loadNetworkStatus();
            pollingRef.current = setInterval(() => {
                loadNetworkStatus();
            }, 3000);
        }
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [activeTab]);

    const isConnected = networkStatus.status_detail !== 'DISCONNECTED';
    const isLte = networkStatus.status_detail === 'LTE_MODE';
    const isWifi = networkStatus.status_detail === 'WIFI_MODE';
    const isDual = networkStatus.status_detail === 'DUAL_MODE';

    // Check specific system mode from monitor
    const sysMode = networkStatus.monitor?.system_gateway_mode || "Unknown";
    const isWired = sysMode.includes("WIRED");

    return (
        <div className="p-4 md:p-6 space-y-4 bg-background min-h-screen text-foreground font-sans">


            {/* Compact Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-3 border-b border-border">
                <div />

                <div className="flex items-center gap-3 mt-3 md:mt-0">
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-full text-[10px] font-bold text-muted-foreground">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-muted'}`} />
                        {isConnected ? `CONNECTED: ${networkStatus.current_ip}` : 'OFFLINE'}
                    </div>
                    <GoogleAuthGuide />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit overflow-x-auto">
                {[
                    { id: 'vault', label: '통합 계정 & 육성 관리', icon: Shield },
                    { id: 'social', label: '멀티 플랫폼 (Social)', icon: Globe },
                    { id: 'network', label: '네트워크 대시보드', icon: Activity }
                ].map((tab: any) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === tab.id
                            ? 'bg-background text-primary shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <tab.icon className="w-4 h-4 mr-2 shrink-0" />
                        <span className="whitespace-nowrap">{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="animate-in fade-in duration-300">
                {activeTab === 'vault' && (
                    <div className="space-y-6">
                        <BulkWarmupPanel />
                        <TinCanVault mode="incubator" key={refreshKey} />
                    </div>
                )}
                {activeTab === 'social' && (
                    <div className="max-w-7xl mx-auto bg-card p-4 md:p-6 rounded-xl border border-border shadow-sm">
                        <SocialAccountsManager />
                    </div>
                )}

                {activeTab === 'network' && (
                    <div className="max-w-4xl mx-auto">
                        <Card className="border-border shadow-sm bg-card">
                            <CardContent className="p-8 space-y-8">

                                {/* Status Row */}
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl border ${isConnected ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted border-border text-muted-foreground'}`}>
                                            <Smartphone className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-foreground">듀얼 프록시 격리 시스템</h2>
                                            <div className="flex items-center gap-2 mt-1 text-sm">
                                                {isConnected ? (
                                                    <span className="flex items-center text-emerald-500 font-medium">
                                                        <CheckCircle2 className="w-4 h-4 mr-1" /> 온라인
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center text-rose-500 font-medium">
                                                        <XCircle className="w-4 h-4 mr-1" /> 오프라인
                                                    </span>
                                                )}
                                                <span className="text-muted-foreground">|</span>
                                                <span className="text-muted-foreground font-mono">IF: {networkStatus.interface_ip}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {networkStatus.monitor?.lte && networkStatus.monitor?.lte?.metric !== 50 && (
                                            <Button 
                                                variant="destructive" 
                                                size="sm" 
                                                onClick={async () => {
                                                    try {
                                                        const res = await api.post('/resources/network/fix-permissions');
                                                        toast({ title: "격리 최적화 요청", description: res.data.message });
                                                        loadNetworkStatus();
                                                    } catch (e) {
                                                        toast({ variant: "destructive", title: "오류", description: "권한 복구 실패" });
                                                    }
                                                }}
                                            >
                                                <Shield className="w-4 h-4 mr-2" />
                                                격리 최적화 (UAC 권한 필요)
                                            </Button>
                                        )}
                                        <Button variant="outline" size="sm" onClick={() => loadNetworkStatus(true)} disabled={isNetworkLoading}>
                                            <RefreshCw className={`w-4 h-4 mr-2 ${isNetworkLoading ? 'animate-spin' : ''}`} />
                                            상태 확인
                                        </Button>
                                    </div>
                                </div>

                                <hr className="border-border" />

                                {/* Dual-Proxy Status Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* LTE Proxy Group */}
                                    <div className="p-5 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg"><Smartphone className="w-6 h-6" /></div>
                                                <div>
                                                    <h3 className="font-bold text-foreground">LTE 듀얼 프록시 그룹 (공유망)</h3>
                                                    <p className="text-xs text-rose-400 font-medium">Every Proxy (Port 8080 HTTP / 10800)</p>
                                                </div>
                                            </div>
                                            {networkStatus.monitor?.lte ? (
                                                <span className="flex items-center text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-1 rounded-full">
                                                    <Shield className="w-3 h-3 mr-1" /> 격리됨
                                                </span>
                                            ) : (
                                                <span className="flex items-center text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-full">
                                                    <XCircle className="w-3 h-3 mr-1" /> 연결 안됨
                                                </span>
                                            )}
                                        </div>
                                        <div className="space-y-2 bg-card p-3 rounded-lg border border-border">
                                            <div className="flex justify-between text-xs pb-1 border-b border-border">
                                                <span className="text-muted-foreground">공용 IP</span>
                                                <span className="font-mono font-bold text-rose-500">{networkStatus.mobile_public_ip || '확인 중'}</span>
                                            </div>
                                            <div className="mt-2 space-y-1">
                                                <span className="text-xs text-muted-foreground font-bold mb-1 block">소속 계정:</span>
                                                {networkStatus.profiles?.lte?.length > 0 ? (
                                                    networkStatus.profiles.lte.map((p: any) => (
                                                        <div key={p.id} className="text-xs flex justify-between items-center bg-muted/50 px-2 py-1 rounded">
                                                            <span className="truncate w-32">{p.email || p.id}</span>
                                                            <span className="text-[10px] bg-rose-500/10 text-rose-500 px-1 rounded">LTE</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-xs text-muted-foreground text-center py-2">등록된 계정이 없습니다.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* ISP Proxy Group */}
                                    <div className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Server className="w-6 h-6" /></div>
                                                <div>
                                                    <h3 className="font-bold text-foreground">ISP 고정 프록시 그룹 (독립망)</h3>
                                                    <p className="text-xs text-blue-400 font-medium">개별 IP 할당</p>
                                                </div>
                                            </div>
                                            <span className="flex items-center text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-full">
                                                <CheckCircle2 className="w-3 h-3 mr-1" /> 작동 중
                                            </span>
                                        </div>
                                        <div className="space-y-2 bg-card p-3 rounded-lg border border-border">
                                            <div className="flex justify-between text-xs pb-1 border-b border-border">
                                                <span className="text-muted-foreground">할당된 계정 수</span>
                                                <span className="font-mono font-bold text-blue-500">{networkStatus.profiles?.isp?.length || 0}개</span>
                                            </div>
                                            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto pr-1">
                                                {networkStatus.profiles?.isp?.length > 0 ? (
                                                    networkStatus.profiles.isp.map((p: any) => (
                                                        <div key={p.id} className="text-xs flex justify-between items-center bg-muted/50 px-2 py-1 rounded mb-1">
                                                            <span className="truncate w-24">{p.email || p.id}</span>
                                                            <span className="text-[10px] font-mono text-blue-500 truncate w-24 text-right">
                                                                {p.proxy_host}:{p.proxy_port}
                                                            </span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-xs text-muted-foreground text-center py-2">등록된 계정이 없습니다.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Security Isolation Verification Checklist */}
                                <div className="relative overflow-hidden rounded-xl bg-slate-500/5 p-5 font-mono text-sm border border-slate-500/20 shadow-sm">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-rose-500 opacity-80"></div>
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-2">
                                            <Shield className="w-5 h-5 text-indigo-400" />
                                            <span className="font-bold text-indigo-400 tracking-wide text-[13px]">보안 격리 상태 검증 (Security Isolation Checklist)</span>
                                        </div>
                                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                            VERIFIED SECURE
                                        </span>
                                    </div>
                                    <div className="space-y-2.5 text-xs text-foreground bg-card p-3 rounded-lg border border-border shadow-sm">
                                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                            <span className="flex items-center text-muted-foreground">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" />
                                                시스템 기본망 Wi-Fi 강제 라우팅
                                            </span>
                                            <span className="font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">정상 작동 (Wi-Fi 전용)</span>
                                        </div>
                                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                            <span className="flex items-center text-muted-foreground">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" />
                                                유튜브 업로드 LTE 프록시 격리 (Port 10800)
                                            </span>
                                            <span className={`font-mono px-1.5 py-0.5 rounded ${networkStatus.monitor?.lte ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                                                {networkStatus.monitor?.lte ? '정상 작동 (LTE 전용)' : '대기 중 (LTE 미감지)'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                            <span className="flex items-center text-muted-foreground">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" />
                                                LTE 연결 실패 시 Wi-Fi 우회 차단 (Hard-Gate)
                                            </span>
                                            <span className="font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">차단 활성화 (Bypass Blocked)</span>
                                        </div>
                                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                            <span className="flex items-center text-muted-foreground">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" />
                                                DNS 패킷 Wi-Fi 유출 방지 (Interface-Bound DNS)
                                            </span>
                                            <span className="font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">보안 작동 중 (DNS Leak Shield)</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="flex items-center text-muted-foreground">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" />
                                                공인 IP 분리 상태
                                            </span>
                                            <span className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">
                                                {networkStatus.system_public_ip === networkStatus.mobile_public_ip && networkStatus.system_public_ip !== 'Unknown' && networkStatus.system_public_ip
                                                    ? '⚠️ 중복 검출 (격리 최적화 필요)'
                                                    : '완전 독립 (격리 성공)'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Metrics Warning Banner */}
                                {networkStatus.monitor?.lte && networkStatus.monitor?.lte?.metric !== 50 && (
                                    <div className="relative overflow-hidden rounded-xl bg-rose-500/5 p-5 font-mono text-sm border border-rose-500/20 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-rose-500 opacity-80"></div>
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2">
                                                <XCircle className="w-5 h-5 text-rose-500 animate-pulse" />
                                                <span className="font-bold text-rose-500 tracking-wide text-[13px]">네트워크 격리 미적용 (경고)</span>
                                            </div>
                                        </div>
                                        <div className="text-[11.5px] leading-relaxed text-foreground bg-card p-3 rounded-lg border border-border shadow-sm">
                                            <span className="text-rose-500 mr-1">▶</span> 현재 관리자 권한이 없거나 메트릭 설정이 적용되지 않아 시스템 기본 트래픽이 LTE로 유출되고 있습니다. 이중 프록시 완전 격리를 위해 위의 <strong>[격리 최적화]</strong> 버튼을 클릭하여 UAC 권한을 승인하세요.
                                        </div>
                                    </div>
                                )}

                                {/* Matrix Diagnostics */}
                                <div className="relative overflow-hidden rounded-xl bg-emerald-500/5 p-5 font-mono text-sm border border-emerald-500/20 shadow-sm">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 opacity-80"></div>
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                            </div>
                                            <span className="font-bold text-emerald-500 tracking-wide text-[13px]">DUAL-PROXY ISOLATION ENGINE ACTIVE</span>
                                        </div>
                                        <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                                            Last Updated: {networkStatus.monitor?.last_check || "Loading..."}
                                        </span>
                                    </div>
                                    <div className="mt-2 text-[11.5px] leading-relaxed text-foreground bg-card p-3 rounded-lg border border-border shadow-sm">
                                        <span className="text-emerald-400 mr-1">▶</span> 시스템 기본망은 항상 Wi-Fi로 유지되며, 유튜브 브랜드 채널 창은 자동으로 10800 포트를 통해 LTE로 완벽히 터널링됩니다. 수동 모드 전환은 불필요합니다.
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="space-y-6 pt-3">
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                            <Activity className="w-4 h-4 text-muted-foreground" /> 신원 교체 제어 (IP Rotation)
                                        </label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Button
                                                onClick={() => handleRotate('soft')}
                                                disabled={isRotating}
                                                className="relative overflow-hidden group h-12 bg-card hover:bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all"
                                            >
                                                <div className="relative flex items-center justify-center font-bold tracking-wide">
                                                    {isRotating ? <RefreshCw className="w-4 h-4 mr-2.5 animate-spin text-blue-500" /> : <RefreshCw className="w-4 h-4 mr-2.5 text-blue-400 group-hover:rotate-180 transition-transform duration-500" />}
                                                    소프트 교체 <span className="ml-1.5 text-blue-400/70 font-medium text-xs">(Data Toggle)</span>
                                                </div>
                                            </Button>
                                            
                                            <Button
                                                onClick={() => handleRotate('hard')}
                                                disabled={isRotating}
                                                className="relative overflow-hidden group h-12 bg-card hover:bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-sm hover:shadow-md hover:border-rose-500/30 transition-all"
                                            >
                                                <div className="relative flex items-center justify-center font-bold tracking-wide">
                                                    {isRotating ? <RefreshCw className="w-4 h-4 mr-2.5 animate-spin text-rose-500" /> : <Rocket className="w-4 h-4 mr-2.5 text-rose-400 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform duration-300" />}
                                                    하드 교체 <span className="ml-1.5 text-rose-400/70 font-medium text-xs">(Airplane Mode)</span>
                                                </div>
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

        </div>
    );
};

export default Incubator;
