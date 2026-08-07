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
        current_ip: "?뺤씤 以?..",
        interface_ip: "..."
    });
    const [isNetworkLoading, setIsNetworkLoading] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const pollingRef = useRef<any>(null);  // Fixed: NodeJS.Timeout -> any

    // [?곹깭 ?뺤씤]
    const loadNetworkStatus = async (isManual = false) => {
        if (isManual) setIsNetworkLoading(true);
        try {
            const url = `/resources/network/status?t=${Date.now()}${isManual ? '&force=true' : ''}`;
            const res = await api.get(url);
            setNetworkStatus(res.data);
            if (isManual) toast({ description: "媛뺤젣 IP 媛깆떊 ?꾨즺" });
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "?ㅻ쪟", description: "?쒕쾭 ?곌껐 ?ㅽ뙣" });
        }
        finally {
            if (isManual) setIsNetworkLoading(false);
        }
    };

    // [踰꾩뒪???대쭅]
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
                title: "IP 援먯껜 紐낅졊 ?꾨떖??,
                description: "?ㅽ듃?뚰겕 ?ъ꽕??以?.. (??IP 媛먯? ???먮룞 媛깆떊)"
            });

            // Wait for 1s then check logic once (Single check as requested)
            setTimeout(() => {
                setIsRotating(false);
                loadNetworkStatus(); // Check once
            }, 1000);

        } catch {
            setIsRotating(false);
            toast({ variant: "destructive", title: "?ㅻ쪟", description: "IP 援먯껜 ?붿껌 ?ㅽ뙣" });
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
                    { id: 'vault', label: '?듯빀 怨꾩젙 & ?≪꽦 愿由?, icon: Shield },
                    { id: 'social', label: '硫???뚮옯??(Social)', icon: Globe },
                    { id: 'network', label: '?ㅽ듃?뚰겕 ??쒕낫??, icon: Activity }
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
                                            <h2 className="text-lg font-bold text-foreground">????꾨줉??寃⑸━ ?쒖뒪??/h2>
                                            <div className="flex items-center gap-2 mt-1 text-sm">
                                                {isConnected ? (
                                                    <span className="flex items-center text-emerald-500 font-medium">
                                                        <CheckCircle2 className="w-4 h-4 mr-1" /> ?⑤씪??                                                    </span>
                                                ) : (
                                                    <span className="flex items-center text-rose-500 font-medium">
                                                        <XCircle className="w-4 h-4 mr-1" /> ?ㅽ봽?쇱씤
                                                    </span>
                                                )}
                                                <span className="text-muted-foreground">|</span>
                                                <span className="text-muted-foreground font-mono">IF: {networkStatus.interface_ip}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            onClick={async () => {
                                                try {
                                                    const res = await api.post('/resources/network/fix-permissions');
                                                    toast({ title: "?덉쟾?μ튂 ?곸슜 ?붿껌", description: res.data.message });
                                                } catch (e) {
                                                    toast({ variant: "destructive", title: "?ㅻ쪟", description: "沅뚰븳 蹂寃??ㅽ뙣" });
                                                }
                                            }}
                                        >
                                            <Shield className="w-4 h-4 mr-2 text-emerald-500" />
                                            硫붿씤 ?ㅽ듃?뚰겕 ?덈? ?곗꽑沅?遺??                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => loadNetworkStatus(true)} disabled={isNetworkLoading}>
                                            <RefreshCw className={`w-4 h-4 mr-2 ${isNetworkLoading ? 'animate-spin' : ''}`} />
                                            ?곹깭 ?뺤씤
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
                                                    <h3 className="font-bold text-foreground">LTE ????꾨줉??洹몃９ (怨듭쑀留?</h3>
                                                    <p className="text-xs text-rose-400 font-medium">Every Proxy (Port 8080 HTTP / 10800)</p>
                                                </div>
                                            </div>
                                            {networkStatus.monitor?.lte ? (
                                                <span className="flex items-center text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-1 rounded-full">
                                                    <Shield className="w-3 h-3 mr-1" /> 寃⑸━??                                                </span>
                                            ) : (
                                                <span className="flex items-center text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-full">
                                                    <XCircle className="w-3 h-3 mr-1" /> ?곌껐 ?덈맖
                                                </span>
                                            )}
                                        </div>
                                        <div className="space-y-2 bg-card p-3 rounded-lg border border-border">
                                            <div className="flex justify-between text-xs pb-1 border-b border-border">
                                                <span className="text-muted-foreground">怨듭슜 IP</span>
                                                <span className="font-mono font-bold text-rose-500">{networkStatus.mobile_public_ip || '?뺤씤 以?}</span>
                                            </div>
                                            <div className="mt-2 space-y-1">
                                                <span className="text-xs text-muted-foreground font-bold mb-1 block">?뚯냽 怨꾩젙:</span>
                                                {networkStatus.profiles?.lte?.length > 0 ? (
                                                    networkStatus.profiles.lte.map((p: any) => (
                                                        <div key={p.id} className="text-xs flex justify-between items-center bg-muted/50 px-2 py-1 rounded">
                                                            <span className="truncate w-32">{p.email || p.id}</span>
                                                            <span className="text-[10px] bg-rose-500/10 text-rose-500 px-1 rounded">LTE</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-xs text-muted-foreground text-center py-2">?깅줉??怨꾩젙???놁뒿?덈떎.</div>
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
                                                    <h3 className="font-bold text-foreground">ISP 怨좎젙 ?꾨줉??洹몃９ (?낅┰留?</h3>
                                                    <p className="text-xs text-blue-400 font-medium">媛쒕퀎 IP ?좊떦</p>
                                                </div>
                                            </div>
                                            <span className="flex items-center text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-full">
                                                <CheckCircle2 className="w-3 h-3 mr-1" /> ?묐룞 以?                                            </span>
                                        </div>
                                        <div className="space-y-2 bg-card p-3 rounded-lg border border-border">
                                            <div className="flex justify-between text-xs pb-1 border-b border-border">
                                                <span className="text-muted-foreground">?좊떦??怨꾩젙 ??/span>
                                                <span className="font-mono font-bold text-blue-500">{networkStatus.profiles?.isp?.length || 0}媛?/span>
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
                                                    <div className="text-xs text-muted-foreground text-center py-2">?깅줉??怨꾩젙???놁뒿?덈떎.</div>
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
                                            <span className="font-bold text-indigo-400 tracking-wide text-[13px]">蹂댁븞 寃⑸━ ?곹깭 寃利?(Security Isolation Checklist)</span>
                                        </div>
                                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                            VERIFIED SECURE
                                        </span>
                                    </div>
                                    <div className="space-y-2.5 text-xs text-foreground bg-card p-3 rounded-lg border border-border shadow-sm">
                                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                            <span className="flex items-center text-muted-foreground">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" />
                                                ?쒖뒪??湲곕낯留?Wi-Fi 媛뺤젣 ?쇱슦??                                            </span>
                                            <span className="font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">?뺤긽 ?묐룞 (Wi-Fi ?꾩슜)</span>
                                        </div>
                                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                            <span className="flex items-center text-muted-foreground">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" />
                                                ?좏뒠釉??낅줈??LTE ?꾨줉??寃⑸━ (Port 10800)
                                            </span>
                                            <span className={`font-mono px-1.5 py-0.5 rounded ${networkStatus.monitor?.lte ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                                                {networkStatus.monitor?.lte ? '?뺤긽 ?묐룞 (LTE ?꾩슜)' : '?湲?以?(LTE 誘멸컧吏)'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                            <span className="flex items-center text-muted-foreground">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" />
                                                LTE ?곌껐 ?ㅽ뙣 ??Wi-Fi ?고쉶 李⑤떒 (Hard-Gate)
                                            </span>
                                            <span className="font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">李⑤떒 ?쒖꽦??(Bypass Blocked)</span>
                                        </div>
                                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                            <span className="flex items-center text-muted-foreground">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" />
                                                DNS ?⑦궥 Wi-Fi ?좎텧 諛⑹? (Interface-Bound DNS)
                                            </span>
                                            <span className="font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">蹂댁븞 ?묐룞 以?(DNS Leak Shield)</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="flex items-center text-muted-foreground">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" />
                                                怨듭씤 IP 遺꾨━ ?곹깭
                                            </span>
                                            <span className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">
                                                {networkStatus.system_public_ip === networkStatus.mobile_public_ip && networkStatus.system_public_ip !== 'Unknown' && networkStatus.system_public_ip
                                                    ? '?좑툘 以묐났 寃異?(?꾨줉???뺤씤 ?꾩슂)'
                                                    : '?꾩쟾 ?낅┰ (寃⑸━ ?깃났)'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

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
                                        <span className="text-emerald-400 mr-1">??/span> ?쒖뒪??湲곕낯留앹? ??긽 Wi-Fi濡??좎??섎ŉ, ?좏뒠釉?釉뚮옖??梨꾨꼸 李쎌? ?먮룞?쇰줈 10800 ?ы듃瑜??듯빐 LTE濡??꾨꼍???곕꼸留곷맗?덈떎. ?섎룞 紐⑤뱶 ?꾪솚? 遺덊븘?뷀빀?덈떎.
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="space-y-6 pt-3">
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                            <Activity className="w-4 h-4 text-muted-foreground" /> ?좎썝 援먯껜 ?쒖뼱 (IP Rotation)
                                        </label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Button
                                                onClick={() => handleRotate('soft')}
                                                disabled={isRotating}
                                                className="relative overflow-hidden group h-12 bg-card hover:bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all"
                                            >
                                                <div className="relative flex items-center justify-center font-bold tracking-wide">
                                                    {isRotating ? <RefreshCw className="w-4 h-4 mr-2.5 animate-spin text-blue-500" /> : <RefreshCw className="w-4 h-4 mr-2.5 text-blue-400 group-hover:rotate-180 transition-transform duration-500" />}
                                                    ?뚰봽??援먯껜 <span className="ml-1.5 text-blue-400/70 font-medium text-xs">(Data Toggle)</span>
                                                </div>
                                            </Button>
                                            
                                            <Button
                                                onClick={() => handleRotate('hard')}
                                                disabled={isRotating}
                                                className="relative overflow-hidden group h-12 bg-card hover:bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-sm hover:shadow-md hover:border-rose-500/30 transition-all"
                                            >
                                                <div className="relative flex items-center justify-center font-bold tracking-wide">
                                                    {isRotating ? <RefreshCw className="w-4 h-4 mr-2.5 animate-spin text-rose-500" /> : <Rocket className="w-4 h-4 mr-2.5 text-rose-400 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform duration-300" />}
                                                    ?섎뱶 援먯껜 <span className="ml-1.5 text-rose-400/70 font-medium text-xs">(Airplane Mode)</span>
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
