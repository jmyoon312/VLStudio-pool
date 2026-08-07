import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Plus, Clock, ShieldCheck, Mail, Pencil, Trash2, AlertCircle, Settings, RefreshCw, FileJson, Lock, Globe, Smartphone, Activity, Info, LogOut } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TinCanWizard from '../resource/TinCanWizard';
// @ts-ignore
import { useModalVisibility } from '@/features/flow2capcut/hooks/useModalVisibility';

import { WarmupButton, BulkWarmupPanel } from '../resource/CaptainQuarters';
import { CultivationWizard } from '../resource/CultivationWizard';
import SocialAccountsManager from './SocialAccountsManager';

const API_BASE = typeof window !== 'undefined' && window.location.protocol === 'file:' ? 'http://127.0.0.1:8000/api' : '/api';

const ProfileApiStatus = ({ profileId }: { profileId: string }) => {
    const { data, isLoading } = useQuery({
        queryKey: ['oauth-status', profileId],
        queryFn: async () => (await axios.get(`${API_BASE}/oauth2/status/${profileId}`)).data,
        staleTime: 60000,
    });
    if (isLoading) return <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-1 font-semibold animate-pulse border border-slate-200">API ⏳</span>;
    if (data?.authenticated) return <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded ml-1 font-semibold">API 🟢</span>;
    return <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded ml-1 font-semibold">API 🟡</span>;
};

export default function BrandDashboard() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [draftData, setDraftData] = useState<any>(null);
    const [editProfile, setEditProfile] = useState<any>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [quarantineTarget, setQuarantineTarget] = useState<any>(null);
    const [quarantineReason, setQuarantineReason] = useState("");
    const [quickNetworkProfile, setQuickNetworkProfile] = useState<any>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [selectedChannelForWizard, setSelectedChannelForWizard] = useState<any>(null);
    const editFileInputRef = useRef<HTMLInputElement>(null);
    const [editUploading, setEditUploading] = useState(false);

    // @ts-ignore
    useModalVisibility(!!editProfile);
    // @ts-ignore
    useModalVisibility(!!quarantineTarget);
    // @ts-ignore
    useModalVisibility(!!deleteId);

    const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
        queryKey: ['profiles'],
        queryFn: async () => (await axios.get(`${API_BASE}/resources/profiles?type=TIN_CAN`)).data
    });

    const { data: channels } = useQuery({
        queryKey: ['youtube-channels'],
        queryFn: async () => (await axios.get(`${API_BASE}/youtube/all`)).data
    });

    const activeOps = profiles?.filter((p: any) => p.status !== 'QUARANTINED' && p.usage_type !== 'DEEP_RESEARCH') || [];
    const quarantinedOps = profiles?.filter((p: any) => p.status === 'QUARANTINED' && p.usage_type !== 'DEEP_RESEARCH') || [];

    const updateMutation = useMutation({
        mutationFn: async (data: any) => await axios.put(`${API_BASE}/resources/profiles/${data.id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
            setEditProfile(null);
            setQuickNetworkProfile(null);
            toast({ title: "수정 완료", description: "계정 정보가 업데이트되었습니다." });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => await axios.delete(`${API_BASE}/resources/profiles/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
            setDeleteId(null);
            toast({ title: "삭제 완료", description: "프로필과 폴더가 영구 삭제되었습니다." });
        }
    });

    const quarantineMutation = useMutation({
        mutationFn: async () => await axios.post(`${API_BASE}/resources/profiles/${quarantineTarget.id}/quarantine`, { reason: quarantineReason }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
            setQuarantineTarget(null);
            setQuarantineReason("");
            toast({ title: "격리 조치 완료", description: "계정이 90일간 격리됩니다." });
        }
    });

    const releaseMutation = useMutation({
        mutationFn: async (id: string) => await axios.post(`${API_BASE}/resources/profiles/${id}/release`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
            toast({ title: "격리 해제 완료", description: "정상 운영 상태로 복귀했습니다." });
        }
    });

    const handleSyncChannel = async (profileId: string) => {
        setSyncingId(profileId);
        try {
            await axios.post(`${API_BASE}/resources/profiles/${profileId}/sync-channel`);
            await queryClient.invalidateQueries({ queryKey: ['captain-channels'] });
            toast({ title: "동기화 완료", description: "채널 정보가 성공적으로 수집되었습니다." });
        } catch (error) {
            toast({ variant: "destructive", title: "동기화 실패" });
        } finally {
            setSyncingId(null);
        }
    };

    const handleSecureConnect = async (profile: any) => {
        try {
            await axios.post(`${API_BASE}/resources/profiles/${profile.id}/secure-launch`, { target_url: "https://studio.youtube.com" });
            toast({ title: "보안 접속 실행", description: "스텔스 브라우저가 시작됩니다." });
        } catch (error) {
            toast({ variant: "destructive", title: "접속 실패", description: "서버 오류가 발생했습니다." });
        }
    };
    
    const handleEditFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, profileId: string) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append("file", file);
        setEditUploading(true);
        try {
            await axios.post(`${API_BASE}/oauth2/upload-client-secret/${profileId}`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            toast({ title: "업로드 성공", description: "JSON 파일이 등록되었습니다." });
        } catch (error) {
            toast({ variant: "destructive", title: "업로드 실패" });
        } finally {
            setEditUploading(false);
            if (editFileInputRef.current) editFileInputRef.current.value = "";
        }
    };

    const handleEditAuth = async (profileId: string) => {
        try {
            await axios.post(`${API_BASE}/oauth2/authorize/${profileId}`);
            toast({ title: "인증 시작", description: "브라우저에서 권한을 승인해주세요." });
        } catch (error) {
            toast({ variant: "destructive", title: "인증 요청 실패" });
        }
    };

    const renderBrandFolder = (p: any, isQuarantined: boolean) => {
        const channel = channels?.find((c: any) => c.owner_profile_id === p.id || c.channel_id === p.channel_id);
        const title = p.name || channel?.title || channel?.channel_name || p.email || "미등록 채널";

        return (
            <div key={p.id} className="border border-slate-200 rounded-xl mb-4 bg-white shadow-sm hover:shadow-md transition-shadow p-4 flex items-center justify-between gap-4 flex-wrap">
                {/* 1. Brand Info (Left) */}
                <div className="flex items-center gap-4 min-w-[250px]">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isQuarantined ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        {isQuarantined ? <AlertCircle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                            {title}
                            {p.status?.toLowerCase() === 'active' && <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px] h-5 px-1.5">ACTIVE</Badge>}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                            <Mail className="w-3 h-3" /> {p.email}
                            <span className="text-slate-300">|</span>
                            <span className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                                {p.proxy_mode === 'ISP_PROXY' ? '🌐 ISP' : '📱 LTE'}
                                {p.proxy_host && `(${p.proxy_host})`}
                                <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 text-slate-400 hover:text-indigo-600" onClick={() => setQuickNetworkProfile({ ...p })}>
                                    <Settings className="w-3 h-3" />
                                </Button>
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. Operations (Center) */}
                <div className="flex items-center gap-3 flex-1 flex-wrap">
                    {!isQuarantined && p.status?.toLowerCase() === 'active' && (
                        <>
                            <div className="w-px h-6 bg-slate-200 mx-2"></div>
                            
                            {/* YouTube Core Settings */}
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-slate-50">{p.engine_type === 'ixbrowser' ? 'iXBrowser' : 'CloakBrowser'}</Badge>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => handleSyncChannel(p.id)} disabled={syncingId === p.id}>
                                    <RefreshCw className={`w-3 h-3 mr-1 ${syncingId === p.id ? 'animate-spin' : ''}`} />
                                    채널 동기화
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={async () => {
                                    if (channel) { setSelectedChannelForWizard(channel); setWizardOpen(true); }
                                    else { await handleSyncChannel(p.id); }
                                }}>웜업 설정</Button>
                                <WarmupButton channel={channel} profileId={p.id} onNeedSync={() => handleSyncChannel(p.id)} compact={true} />
                            </div>

                            <div className="w-px h-6 bg-slate-200 mx-2"></div>

                            {/* Connected Social Accounts */}
                            <div className="flex items-center gap-2">
                                <SocialAccountsManager profileId={p.id} compact={true} />
                            </div>
                        </>
                    )}
                </div>

                {/* 3. Actions (Right) */}
                <div className="flex items-center gap-2 shrink-0">
                    {!isQuarantined && p.status?.toLowerCase() === 'active' && (
                        <>
                            <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8" onClick={() => handleSecureConnect(p)}>
                                <ShieldCheck className="w-3.5 h-3.5 mr-1" /> 스텔스 접속
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => setEditProfile(p)}><Pencil className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => setDeleteId(p.id)}><Trash2 className="w-4 h-4" /></Button>
                        </>
                    )}
                    {isQuarantined && (
                        <Button size="sm" variant="outline" onClick={() => releaseMutation.mutate(p.id)}>격리 해제</Button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex justify-between items-center bg-card p-6 rounded-xl border border-border shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <ShieldCheck className="w-7 h-7 text-indigo-600" />
                        브랜드 폴더 통합 관리
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        구글 계정을 최상위 브랜드(폴더)로 삼고, 그 아래에 틱톡, 인스타 등 소셜 계정을 묶어 통합 운영합니다.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['captain-channels'] })}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        새로고침
                    </Button>
                    <Button onClick={() => { setDraftData(null); setIsWizardOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 font-bold h-10 px-6 shadow-sm">
                        <Plus className="w-4 h-4 mr-2" /> 새 브랜드 추가
                    </Button>
                </div>
            </div>

            <BulkWarmupPanel />

            <div className="mt-8">
                {isLoadingProfiles ? (
                    <div className="flex items-center justify-center p-12 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin" /></div>
                ) : activeOps.length === 0 && quarantinedOps.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <ShieldCheck className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-xl font-bold text-slate-600">등록된 브랜드가 없습니다</h3>
                        <p className="text-slate-400 mt-2 mb-6">첫 번째 마스터 구글 계정(브랜드)을 등록해주세요.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {activeOps.length > 0 && (
                            <div>
                                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-indigo-600" /> 운영 중인 브랜드 ({activeOps.length})
                                </h3>
                                <div className="space-y-4 w-full">
                                    {activeOps.map((p: any) => renderBrandFolder(p, false))}
                                </div>
                            </div>
                        )}

                        {quarantinedOps.length > 0 && (
                            <div className="mt-8">
                                <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" /> 격리된 브랜드 (Quarantine Zone)
                                </h3>
                                <div className="space-y-4 w-full opacity-70">
                                    {quarantinedOps.map((p: any) => renderBrandFolder(p, true))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* Dialogs */}
            <TinCanWizard isOpen={isWizardOpen} onClose={() => { setIsWizardOpen(false); queryClient.invalidateQueries({ queryKey: ['profiles'] }); }} onComplete={() => queryClient.invalidateQueries({ queryKey: ['profiles'] })} initialData={draftData} />
            {wizardOpen && selectedChannelForWizard && (
                <CultivationWizard isOpen={wizardOpen} onClose={() => { setWizardOpen(false); setSelectedChannelForWizard(null); queryClient.invalidateQueries({ queryKey: ['captain-channels'] }); }} channelId={selectedChannelForWizard.channel_id} profileId={selectedChannelForWizard.owner_profile_id} currentStrategy={selectedChannelForWizard.strategy} />
            )}

            <Dialog open={!!editProfile} onOpenChange={(o) => !o && setEditProfile(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>프로필 수정</DialogTitle>
                    </DialogHeader>
                    {editProfile && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500">System ID</Label>
                                    <Input value={editProfile.id} disabled className="bg-slate-50 font-mono text-[10px] h-8" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500">Folder Path</Label>
                                    <Input value={editProfile.folder_path || '-'} disabled className="bg-slate-50 font-mono text-[10px] h-8 text-ellipsis" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>브랜드 폴더 이름</Label>
                                <Input value={editProfile.name || ''} onChange={e => setEditProfile({ ...editProfile, name: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>계정 이메일</Label>
                                <Input value={editProfile.email || ''} onChange={e => setEditProfile({ ...editProfile, email: e.target.value })} />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditProfile(null)}>취소</Button>
                        <Button onClick={() => updateMutation.mutate(editProfile)}>저장</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!quickNetworkProfile} onOpenChange={(o) => !o && setQuickNetworkProfile(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-indigo-600">
                            <Settings className="w-5 h-5" />
                            엔진 & 네트워크 IP 설정 변경
                        </DialogTitle>
                    </DialogHeader>
                    {quickNetworkProfile && (
                        <div className="space-y-4 py-2 text-xs">
                            <div className="space-y-1.5 mt-3">
                                <Label className="font-bold text-slate-700">안티디텍트 브라우저 엔진</Label>
                                <Select value={quickNetworkProfile.engine_type || 'cloakbrowser'} onValueChange={(val) => setQuickNetworkProfile({ ...quickNetworkProfile, engine_type: val })}>
                                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cloakbrowser">🛡️ CloakBrowser (권장)</SelectItem>
                                        <SelectItem value="ixbrowser">🌐 iXBrowser</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 mt-3">
                                <Label className="font-bold text-slate-700">네트워크 프록시 설정</Label>
                                <Select value={quickNetworkProfile.proxy_mode || 'DIRECT_LTE'} onValueChange={(val) => setQuickNetworkProfile({ ...quickNetworkProfile, proxy_mode: val })}>
                                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DIRECT_LTE">📱 LTE 모바일 (ADB)</SelectItem>
                                        <SelectItem value="ISP_PROXY">🌐 ISP 고정 IP 프록시</SelectItem>
                                        <SelectItem value="DIRECT">직접 연결 (비권장)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            {quickNetworkProfile.proxy_mode === 'ISP_PROXY' && (
                                <div className="grid grid-cols-2 gap-3 mt-3 animate-in fade-in">
                                    <div className="space-y-1.5">
                                        <Label>IP 주소</Label>
                                        <Input className="h-8 text-xs font-mono" value={quickNetworkProfile.proxy_host || ''} onChange={e => setQuickNetworkProfile({ ...quickNetworkProfile, proxy_host: e.target.value })} placeholder="123.45.67.89" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>포트</Label>
                                        <Input className="h-8 text-xs font-mono" value={quickNetworkProfile.proxy_port || ''} onChange={e => setQuickNetworkProfile({ ...quickNetworkProfile, proxy_port: e.target.value })} placeholder="8080" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setQuickNetworkProfile(null)}>취소</Button>
                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => { if(quickNetworkProfile) updateMutation.mutate(quickNetworkProfile); }}>저장</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!quarantineTarget} onOpenChange={(o) => !o && setQuarantineTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">🚨 계정 격리 조치</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-2 py-4">
                        <Label>위반/격리 사유</Label>
                        <Input value={quarantineReason} onChange={e => setQuarantineReason(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setQuarantineTarget(null)}>취소</Button>
                        <Button variant="destructive" onClick={() => quarantineMutation.mutate()}>격리 실행</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600">정말 삭제하시겠습니까?</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteId(null)}>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId!)} className="bg-red-600">삭제</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
