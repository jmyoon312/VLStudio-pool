import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import {
    Shield, User, Activity, RefreshCw, Smartphone, Wifi,
    Signal, Rocket, Globe, Server, CheckCircle2, XCircle
} from 'lucide-react';
import TinCanVault from '@/components/resource/TinCanVault';
import CaptainQuarters from '@/components/resource/CaptainQuarters';
import TinCanWizard from '@/components/resource/TinCanWizard';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from "@/components/ui/card";

const DistributionManager = () => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'vault' | 'captains' | 'network'>('vault');
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

    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // [상태 확인]
    const loadNetworkStatus = async (isManual = false) => {
        if (isManual) setIsNetworkLoading(true);
        try {
            const res = await fetch(`/status_bypass?t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                setNetworkStatus(data);
                if (isManual) toast({ description: "상태 확인 완료 (정책 적용됨)" });
            }
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

    const handleSourceSwitch = async (source: 'lte' | 'wifi') => {
        setIsNetworkLoading(true);
        try {
            await fetch(`/network/source/${source}`, { method: 'POST' });
            toast({ title: source === 'lte' ? "LTE 모드 전환" : "Wi-Fi 모드 전환", description: "핸드폰 설정을 변경합니다..." });
            startBurstPolling();
        } finally {
            setIsNetworkLoading(false);
        }
    };

    const handleRotate = async (method: 'soft' | 'hard') => {
        setIsRotating(true);
        try {
            await fetch(`/api/resources/network/rotate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ method })
            });
            toast({ title: "IP 신원 교체", description: "새로운 IP를 할당받습니다." });
            setTimeout(() => {
                setIsRotating(false);
                startBurstPolling();
            }, 5000);
        } catch {
            setIsRotating(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'network') {
            loadNetworkStatus();
        }
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [activeTab]);

    const isConnected = networkStatus.status_detail !== 'DISCONNECTED';
    const isLte = networkStatus.status_detail === 'LTE_MODE';
    const isWifi = networkStatus.status_detail === 'WIFI_MODE';

    return (
        <div className="p-8 space-y-6 bg-background min-h-screen text-foreground font-sans">

            {/* Header */}
            {/* Pure Resource Control */}

            {/* Tabs */}
            <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit border border-border">
                {[
                    { id: 'vault', label: '소유자 보관소', icon: Shield },
                    { id: 'captains', label: '관리자 관리', icon: User },
                    { id: 'network', label: '네트워크 관제 (Matrix)', icon: Activity }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === tab.id
                            ? 'bg-card text-primary shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <tab.icon className="w-4 h-4 mr-2" />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="animate-in fade-in duration-300">
                {activeTab === 'vault' && <TinCanVault key={refreshKey} />}
                {activeTab === 'captains' && <CaptainQuarters />}

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
                                            <h2 className="text-lg font-bold text-foreground">테더링 게이트웨이</h2>
                                            <div className="flex items-center gap-2 mt-1 text-sm">
                                                {isConnected ? (
                                                    <span className="flex items-center text-emerald-500 font-medium">
                                                        <CheckCircle2 className="w-4 h-4 mr-1" /> 온라인
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center text-destructive font-medium">
                                                        <XCircle className="w-4 h-4 mr-1" /> 오프라인
                                                    </span>
                                                )}
                                                <span className="text-muted-foreground">|</span>
                                                <span className="text-muted-foreground font-mono">IF: {networkStatus.interface_ip}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" className="border-border" onClick={() => loadNetworkStatus(true)} disabled={isNetworkLoading}>
                                        <RefreshCw className={`w-4 h-4 mr-2 ${isNetworkLoading ? 'animate-spin' : ''}`} />
                                        상태 확인
                                    </Button>
                                </div>

                                <hr className="border-border" />

                                {/* Info Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">현재 모드</label>
                                        <div className={`flex items-center gap-3 p-4 rounded-lg border ${isLte
                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                            : isWifi
                                                ? 'bg-primary/10 border-primary/20 text-primary'
                                                : 'bg-muted border-border text-muted-foreground'
                                            }`}>
                                            {isLte ? <Signal className="w-6 h-6" /> : <Wifi className="w-6 h-6" />}
                                            <span className="text-lg font-bold">
                                                {isLte ? "LTE 테더링" : isWifi ? "Wi-Fi 브리지" : "대기 중..."}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">공인 IP 주소</label>
                                        <div className="flex items-center p-4 bg-muted/40 rounded-lg border border-border">
                                            <Globe className="w-5 h-5 text-muted-foreground mr-3" />
                                            <span className="text-2xl font-mono font-bold text-foreground tracking-tight">
                                                {networkStatus.current_ip}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="space-y-6 pt-2">
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium text-foreground">모드 전환 (수동)</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={() => handleSourceSwitch('lte')}
                                                disabled={isLte || isNetworkLoading}
                                                className={`flex justify-center items-center py-3 rounded-md border text-sm font-medium transition-all ${isLte
                                                    ? 'bg-muted text-muted-foreground border-transparent cursor-default'
                                                    : 'bg-card border-border text-foreground hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/5'
                                                    }`}
                                            >
                                                <Signal className="w-4 h-4 mr-2" /> LTE로 전환
                                            </button>
                                            <button
                                                onClick={() => handleSourceSwitch('wifi')}
                                                disabled={isWifi || isNetworkLoading}
                                                className={`flex justify-center items-center py-3 rounded-md border text-sm font-medium transition-all ${isWifi
                                                    ? 'bg-muted text-muted-foreground border-transparent cursor-default'
                                                    : 'bg-card border-border text-foreground hover:border-primary hover:text-primary hover:bg-primary/5'
                                                    }`}
                                            >
                                                <Wifi className="w-4 h-4 mr-2" /> Wi-Fi로 전환
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-sm font-medium text-foreground">IP 신원 교체</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Button
                                                onClick={() => handleRotate('soft')}
                                                disabled={isRotating || isNetworkLoading}
                                                className="bg-card hover:bg-muted text-foreground border border-border h-11"
                                            >
                                                {isRotating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                                소프트 교체 (Data Toggle)
                                            </Button>
                                            <Button
                                                onClick={() => handleRotate('hard')}
                                                disabled={isRotating || isNetworkLoading}
                                                variant="outline"
                                                className="border-border text-foreground hover:bg-muted h-11"
                                            >
                                                {isRotating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
                                                하드 교체 (Airplane Mode)
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

export default DistributionManager;
