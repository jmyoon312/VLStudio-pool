import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Clock, ShieldCheck, Mail, Pencil, Trash2, AlertCircle, Settings, RefreshCw, FileJson, Lock } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TinCanWizard from './TinCanWizard';
// @ts-ignore
import { useModalVisibility } from '@/features/flow2capcut/hooks/useModalVisibility';

import { WarmupButton } from './CaptainQuarters';
import { CultivationWizard } from './CultivationWizard';

// API Base
const API_BASE = typeof window !== 'undefined' && window.location.protocol === 'file:' ? 'http://127.0.0.1:8000/api' : '/api';

interface TinCanVaultProps {
    mode?: 'vault' | 'incubator';
}

const ProfileApiStatus = ({ profileId }: { profileId: string }) => {
    const { data, isLoading } = useQuery({
        queryKey: ['oauth-status', profileId],
        queryFn: async () => (await axios.get(`${API_BASE}/oauth2/status/${profileId}`)).data,
        staleTime: 60000,
    });

    if (isLoading) return <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-1 font-semibold animate-pulse border border-slate-200" title="API 상태 확인 중">API ⏳</span>;
    if (data?.authenticated) return <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded ml-1 font-semibold" title="API 인증 완료">API 🟢</span>;
    return <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded ml-1 font-semibold" title="API 미인증">API 🟡</span>;
};

const TinCanVault = ({ mode = 'vault' }: TinCanVaultProps) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // UI States
    const [isWizardOpen, setIsWizardOpen] = useState(false);

    const [draftData, setDraftData] = useState<any>(null); // For Resuming Draft
    const [editProfile, setEditProfile] = useState<any>(null); // For Edit Dialog
    const [deleteId, setDeleteId] = useState<string | null>(null); // For Delete Alert
    const [quarantineTarget, setQuarantineTarget] = useState<any>(null); // For Quarantine Dialog
    const [quarantineReason, setQuarantineReason] = useState("");
    const [quickNetworkProfile, setQuickNetworkProfile] = useState<any>(null); // For Quick Network Dialog
    const [syncingId, setSyncingId] = useState<string | null>(null);

    const editFileInputRef = useRef<HTMLInputElement>(null);
    const [editUploading, setEditUploading] = useState(false);
    
    // For Cultivation Wizard
    const [wizardOpen, setWizardOpen] = useState(false);
    const [selectedChannelForWizard, setSelectedChannelForWizard] = useState<any>(null);

    // @ts-ignore
    useModalVisibility(!!editProfile);
    // @ts-ignore
    useModalVisibility(!!quarantineTarget);
    // @ts-ignore
    useModalVisibility(!!deleteId);

    // Fetch Profiles
    const { data: profiles, isLoading } = useQuery({
        queryKey: ['profiles'],
        queryFn: async () => (await axios.get(`${API_BASE}/resources/profiles?type=TIN_CAN`)).data
    });

    // Fetch Channels (always enabled for real-time brand channel rendering)
    const { data: channels } = useQuery({
        queryKey: ['youtube-channels'],
        queryFn: async () => (await axios.get(`${API_BASE}/youtube/all`)).data
    });

    const activeOps = profiles?.filter((p: any) => p.status !== 'QUARANTINED' && p.usage_type !== 'DEEP_RESEARCH') || [];
    const quarantinedOps = profiles?.filter((p: any) => p.status === 'QUARANTINED' && p.usage_type !== 'DEEP_RESEARCH') || [];

    // Mutations
    const updateMutation = useMutation({
        mutationFn: async (data: any) => await axios.put(`${API_BASE}/resources/profiles/${data.id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
            setEditProfile(null);
            toast({ title: "수정 완료", description: "계정 정보가 업데이트되었습니다." });
        },
        onError: (e: any) => {
            const msg = e.response?.status === 409 ? "이미 존재하는 이메일입니다." : "업데이트 실패";
            toast({ variant: "destructive", title: "수정 실패", description: msg });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => await axios.delete(`${API_BASE}/resources/profiles/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
            setDeleteId(null);
            toast({ title: "삭제 완료", description: "프로필과 폴더가 영구 삭제되었습니다." });
        },
        onError: () => toast({ variant: "destructive", title: "삭제 실패", description: "서버 오류 발생" })
    });

    const quarantineMutation = useMutation({
        mutationFn: async () => await axios.post(`${API_BASE}/resources/profiles/${quarantineTarget.id}/quarantine`, { reason: quarantineReason }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
            setQuarantineTarget(null);
            setQuarantineReason("");
            toast({ title: "격리 조치 완료", description: "계정이 90일간 격리됩니다." });
        },
        onError: () => toast({ variant: "destructive", title: "격리 실패", description: "서버 통신 오류" })
    });

    const releaseMutation = useMutation({
        mutationFn: async (id: string) => await axios.post(`${API_BASE}/resources/profiles/${id}/release`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
            toast({ title: "격리 해제 완료", description: "정상 운영 상태로 복귀했습니다." });
        }
    });

    // Handlers
    const handleEditSave = () => {
        if (!editProfile) return;
        updateMutation.mutate(editProfile);
    };

    const handleDeleteConfirm = () => {
        if (deleteId) deleteMutation.mutate(deleteId);
    };

    const handleQuarantineConfirm = () => {
        if (quarantineTarget && quarantineReason) quarantineMutation.mutate();
    };

    const handleResumeDraft = (p: any) => {
        setDraftData(p);
        setIsWizardOpen(true);
    };

    const getDDay = (startDate: string) => {
        if (!startDate) return "D-??";
        const start = new Date(startDate).getTime();
        const end = start + (90 * 24 * 60 * 60 * 1000); // +90 days
        const now = new Date().getTime();
        const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        return diff > 0 ? `D-${diff}` : "Expire";
    };

    const handleSecureConnect = async (p: any) => {
        toast({ title: "🛡️ 보안 터널링 초기화", description: "IP 세탁 후 스튜디오에 접속합니다. (약 10-20초 소요)" });
        try {
            const res = await axios.post(`${API_BASE}/resources/profiles/${p.id}/launch-setup`, {
                rotate_ip: false
            });

            if (res.data.status === 'launched') {
                toast({ title: "🚀 보안 접속 성공", description: "유튜브 스튜디오가 실행되었습니다." });
            } else {
                throw new Error(res.data.msg || "Launch failed");
            }
        } catch (e: any) {
            console.error(e);
            toast({ variant: "destructive", title: "접속 실패", description: e.response?.data?.detail || "백엔드 연결을 확인해주세요." });
        }
    };

    const handleSyncChannel = async (profileId: string) => {
        setSyncingId(profileId);
        try {
            const res = await axios.post(`${API_BASE}/resources/profiles/${profileId}/sync-channel`);
            toast({
                title: "🔄 브랜드 채널 수집 완료",
                description: `채널 정보가 성공적으로 동기화되었습니다. (${res.data.brand_name || res.data.channel_id})`
            });
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
            queryClient.invalidateQueries({ queryKey: ['youtube-channels'] });
        } catch (e: any) {
            console.error("Sync error:", e);
            toast({ variant: "destructive", title: "동기화 실패", description: "채널 정보를 가져오지 못했습니다." });
        } finally {
            setSyncingId(null);
        }
    };

    const handleEditFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, profileId: string) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        setEditUploading(true);
        try {
            await axios.post(`${API_BASE}/resources/profiles/${profileId}/upload-key`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast({ title: "업로드 성공", description: "API 키 파일이 성공적으로 저장되었습니다." });
        } catch (e: any) {
            console.error("Upload Error:", e);
            toast({ variant: "destructive", title: "업로드 실패", description: e.response?.data?.detail || "파일 저장에 실패했습니다." });
        } finally {
            setEditUploading(false);
            if (editFileInputRef.current) editFileInputRef.current.value = "";
        }
    };

    const handleEditAuth = async (profileId: string) => {
        try {
            await axios.post(`${API_BASE}/oauth2/authenticate/${profileId}`);
            toast({ title: "인증 브라우저 실행", description: "로그인된 창이 열립니다. 권한을 승인해주세요." });
        } catch (e) {
            toast({ variant: "destructive", title: "실행 실패", description: "격리 브라우저를 띄울 수 없습니다." });
        }
    };

    const renderRow = (p: any, isQuarantined: boolean) => {
        const channel = channels?.find((c: any) => c.owner_profile_id === p.id || c.channel_id === p.channel_id);
        
        return (
        <TableRow key={p.id} className="hover:bg-slate-50/80 transition-colors">
            <TableCell className="align-middle">
                <Badge variant="outline" className={
                    p.status?.toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold px-2 py-0.5' :
                        p.status?.toLowerCase() === 'draft' ? 'bg-amber-100 text-amber-800 border-amber-300 px-2 py-0.5' :
                            p.status?.toUpperCase() === 'QUARANTINED' ? 'bg-red-100 text-red-800 border-red-300 px-2 py-0.5' :
                                'bg-slate-100 text-slate-700 px-2 py-0.5'
                }>
                    {p.status ? p.status.toUpperCase() : 'UNKNOWN'}
                </Badge>
            </TableCell>

            <TableCell className="align-middle">
                <div className="flex flex-col gap-1.5 py-1">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-xs whitespace-nowrap">
                        <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                        {p.email ? <span className="font-mono text-slate-800">{p.email}</span> : (
                            <span className="text-slate-500 italic flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> 미설정 ({p.id.slice(0, 6)})
                            </span>
                        )}
                        {channel?.warmup_status === 'RUNNING' && (
                            <Badge variant="outline" className="border-orange-500/30 text-orange-600 bg-orange-50 text-[10px] h-5 animate-pulse shrink-0">
                                🔥 WARMUP
                            </Badge>
                        )}
                        <ProfileApiStatus profileId={p.id} />
                    </div>
                    
                    {/* 브랜드 채널 정보 및 수집/갱신 버튼 */}
                    <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded flex items-center gap-1.5 border border-slate-200">
                            <span className="text-sm">📺</span>
                            <span className="font-medium text-slate-800">{channel?.title || channel?.channel_name || "브랜드 채널 미수집"}</span>
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 border-indigo-200 shrink-0 shadow-2xs"
                            title="유튜브 스튜디오 접속 후 브랜드 채널명 자동 수집"
                            onClick={() => handleSyncChannel(p.id)}
                            disabled={syncingId === p.id}
                        >
                            <RefreshCw className={`w-3 h-3 mr-1 ${syncingId === p.id ? 'animate-spin text-indigo-600' : ''}`} />
                            {syncingId === p.id ? '수집 중...' : '채널 수집'}
                        </Button>
                    </div>
                    {isQuarantined && <span className="text-xs text-red-500 mt-0.5">사유: {p.quarantine_reason}</span>}
                </div>
            </TableCell>
            
            {/* 엔진 & 네트워크 IP 종류 시각화 및 설정 변경 */}
            <TableCell className="align-middle">
                <div className="flex flex-col gap-1.5 py-1 text-xs">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-[11px] text-slate-500 font-medium">엔진:</span>
                        <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-semibold text-[11px] border border-indigo-100">
                            {p.engine_type === 'ixbrowser' ? '🌐 iXBrowser' : '🛡️ CloakBrowser'}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${p.proxy_mode === 'ISP_PROXY' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                            {p.proxy_mode === 'ISP_PROXY' ? '🌐 ISP 고정 IP' : '📱 LTE 모바일'}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-1.5 text-[10px] text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200 shrink-0 font-semibold"
                            title="엔진 및 프록시 IP 설정 변경"
                            onClick={() => setQuickNetworkProfile({ ...p })}
                        >
                            <Settings className="w-3 h-3 mr-0.5 text-slate-500" /> 설정
                        </Button>
                    </div>
                    {p.proxy_mode === 'ISP_PROXY' && p.proxy_host && (
                        <span className="text-[10px] text-slate-500 font-mono" title={`${p.proxy_username ? p.proxy_username + '@' : ''}${p.proxy_host}:${p.proxy_port}`}>
                            {p.proxy_username ? `${p.proxy_username}@` : ''}{p.proxy_host}:{p.proxy_port}
                        </span>
                    )}
                </div>
            </TableCell>
            
            {/* 운영 제어 (Operation Controls) */}
            <TableCell className="align-middle">
                <div className="flex items-center gap-2 py-1 whitespace-nowrap">
                    {p.status?.toLowerCase() === 'active' && (
                        <Button
                            variant="default"
                            size="sm"
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm border-emerald-600 shrink-0"
                            onClick={() => handleSecureConnect(p)}
                            title="유튜브 스튜디오 관리자 대시보드(studio.youtube.com) 직접 보안 접속"
                        >
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> 🛡️ 스텔스 보안 접속
                        </Button>
                    )}
                    
                    {!isQuarantined && p.status?.toLowerCase() === 'active' && (
                        <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2 shrink-0">
                            <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-semibold"
                                onClick={async () => {
                                    if (channel) {
                                        setSelectedChannelForWizard(channel); 
                                        setWizardOpen(true);
                                    } else {
                                        toast({ title: "🔄 브랜드 채널 수집 진행", description: "채널 수집 후 전략 설정 팝업이 활성화됩니다." });
                                        await handleSyncChannel(p.id);
                                        const updatedCh = channels?.find((c: any) => c.owner_profile_id === p.id || c.channel_id === p.channel_id);
                                        if (updatedCh) {
                                            setSelectedChannelForWizard(updatedCh);
                                            setWizardOpen(true);
                                        }
                                    }
                                }}
                            >
                                전략 설정
                            </Button>
                            <WarmupButton channel={channel} profileId={p.id} onNeedSync={() => handleSyncChannel(p.id)} />
                        </div>
                    )}
                </div>
            </TableCell>
            
            {/* 최근 활동 (Recent Activity) */}
            <TableCell className="text-right text-xs text-slate-500 align-middle whitespace-nowrap">
                <div className="flex flex-col items-end gap-1">
                    {isQuarantined ? (
                        <Badge variant="destructive" className="font-mono text-[10px]">{getDDay(p.quarantine_start_date)}</Badge>
                    ) : (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${p.folder_path && p.status?.toLowerCase() === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                            {p.status?.toLowerCase() === 'active' ? "READY" : "PENDING"}
                        </span>
                    )}
                    <div className="flex items-center text-[10px]">
                        <Clock className="w-3 h-3 mr-1" />
                        {isQuarantined
                            ? (p.quarantine_start_date ? new Date(p.quarantine_start_date).toLocaleDateString() : '-')
                            : (p.last_used_at ? new Date(p.last_used_at).toLocaleDateString() : '활동 없음')}
                    </div>
                </div>
            </TableCell>
            
            {/* 관리 (Management) */}
            <TableCell className="align-middle">
                <div className="flex gap-1 justify-end">
                    {!isQuarantined ? (
                        <>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600"
                                onClick={() => (p.status?.toLowerCase() === 'draft' || p.status?.toLowerCase() === 'pending') ? handleResumeDraft(p) : setEditProfile(p)}
                            >
                                <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-500"
                                onClick={() => setQuarantineTarget(p)} title="격리 조치"
                            >
                                <AlertCircle className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600"
                                onClick={() => setDeleteId(p.id)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </>
                    ) : (
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => releaseMutation.mutate(p.id)}>
                            격리 해제
                        </Button>
                    )}
                </div>
            </TableCell>
        </TableRow>
        );
    };

    return (
        <div className="space-y-8">
            {/* Active Ops Section */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <ShieldCheck className="w-6 h-6 text-indigo-600" />
                            구글 계정 관리 (Google Accounts)
                        </CardTitle>
                        <CardDescription>
                            안전하게 격리된 브라우저 프로필을 생성하고 관리합니다. (Import & Setup)
                        </CardDescription>
                    </div>
                    <div className="flex gap-2 items-center">
                        <Button onClick={() => { setDraftData(null); setIsWizardOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 font-bold">
                            <Plus className="w-4 h-4 mr-2" /> 새 계정 가져오기
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <Table className="w-full min-w-[1000px]">
                        <TableHeader>
                            <TableRow className="bg-slate-100/80 border-y border-slate-200">
                                <TableHead className="w-[100px] font-bold text-slate-700">상태</TableHead>
                                <TableHead className="min-w-[280px] font-bold text-slate-700">계정 & 브랜드 채널</TableHead>
                                <TableHead className="min-w-[220px] font-bold text-slate-700">엔진 & 프록시 IP</TableHead>
                                <TableHead className="min-w-[360px] font-bold text-slate-700">운영 제어 (보안접속 & 웜업)</TableHead>
                                <TableHead className="w-[110px] text-right font-bold text-slate-700">최근 활동</TableHead>
                                <TableHead className="w-[110px] text-right font-bold text-slate-700">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8">로딩 중...</TableCell></TableRow>
                            ) : activeOps.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">운영 중인 계정이 없습니다.</TableCell></TableRow>
                            ) : (
                                activeOps.map((p: any) => renderRow(p, false))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Quarantine Zone */}
            {quarantinedOps.length > 0 && (
                <Card className="border-red-200 bg-red-50/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-700">
                            <AlertCircle className="w-6 h-6" />
                            격리 구역 (Quarantine Zone)
                        </CardTitle>
                        <CardDescription className="text-red-600/70">
                            운영 정책 위반으로 인해 90일간 격리된 계정입니다. 해당 계정은 모든 활동이 차단됩니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">상태</TableHead>
                                    <TableHead>계정 / 위반 사유</TableHead>
                                    <TableHead>네트워크</TableHead>
                                    <TableHead>해제 D-Day</TableHead>
                                    <TableHead className="text-right">격리일</TableHead>
                                    <TableHead className="w-[100px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quarantinedOps.map((p: any) => renderRow(p, true))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Dialogs */}
            <TinCanWizard
                isOpen={isWizardOpen}
                onClose={() => {
                    setIsWizardOpen(false);
                    queryClient.invalidateQueries({ queryKey: ['profiles'] });
                }}
                onComplete={() => queryClient.invalidateQueries({ queryKey: ['profiles'] })}
                initialData={draftData}
            />

            <Dialog open={!!editProfile} onOpenChange={(o) => !o && setEditProfile(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>프로필 수정</DialogTitle>
                        <DialogDescription>
                            계정의 기본 정보와 상태를 수정합니다.
                        </DialogDescription>
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
                                <Label>계정 이메일</Label>
                                <Input
                                    value={editProfile.email || ''}
                                    onChange={e => setEditProfile({ ...editProfile, email: e.target.value })}
                                    placeholder="example@gmail.com"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>비밀번호</Label>
                                    <Input
                                        type="password"
                                        value={editProfile.password || ''}
                                        onChange={e => setEditProfile({ ...editProfile, password: e.target.value })}
                                        placeholder="설정된 비밀번호 없음"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>복구 이메일</Label>
                                    <Input
                                        value={editProfile.recovery_email || ''}
                                        onChange={e => setEditProfile({ ...editProfile, recovery_email: e.target.value })}
                                        placeholder="recovery@email.com"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>상태 (Status)</Label>
                                    <Select
                                        value={editProfile.status || 'DRAFT'}
                                        onValueChange={(val) => setEditProfile({ ...editProfile, status: val })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DRAFT">DRAFT (작성 중)</SelectItem>
                                            <SelectItem value="ACTIVE">ACTIVE (정상)</SelectItem>
                                            <SelectItem value="COOLING">COOLING (휴식)</SelectItem>
                                            <SelectItem value="SUSPENDED">SUSPENDED (정지)</SelectItem>
                                            <SelectItem value="QUARANTINED">QUARANTINED (격리)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-100 mt-2">
                                <Label className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                                    YouTube API 인증 설정
                                </Label>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="file"
                                                accept=".json"
                                                ref={editFileInputRef}
                                                className="hidden"
                                                onChange={(e) => handleEditFileUpload(e, editProfile.id)}
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => editFileInputRef.current?.click()}
                                                disabled={editUploading}
                                                className="bg-white"
                                            >
                                                {editUploading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <FileJson className="w-4 h-4 mr-2 text-indigo-600" />}
                                                키 업로드
                                            </Button>
                                            
                                            <Button
                                                size="sm"
                                                onClick={() => handleEditAuth(editProfile.id)}
                                                className="bg-blue-600 hover:bg-blue-700"
                                            >
                                                <Lock className="w-4 h-4 mr-2" />
                                                API 권한 승인 (격리 접속)
                                            </Button>
                                        </div>
                                        <p className="text-[11px] text-slate-500">
                                            ※ JSON 키를 업로드한 후, 권한 승인 버튼을 눌러 스텔스 브라우저에서 인증을 완료하세요.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditProfile(null)}>취소</Button>
                        <Button onClick={handleEditSave}>저장</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Quick Network & Engine Switch Dialog */}
            <Dialog open={!!quickNetworkProfile} onOpenChange={(o) => !o && setQuickNetworkProfile(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-indigo-600">
                            <Settings className="w-5 h-5" />
                            엔진 & 네트워크 IP 설정 변경
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            스텔스 브라우저 엔진 및 Proxy IP 종류(LTE 모바일 ↔ ISP 고정 IP)를 빠르게 변경합니다.
                        </DialogDescription>
                    </DialogHeader>
                    {quickNetworkProfile && (
                        <div className="space-y-4 py-2 text-xs">
                            <div className="space-y-1.5">
                                <Label className="font-bold text-slate-700">안티디텍트 브라우저 엔진</Label>
                                <Select
                                    value={quickNetworkProfile.engine_type || 'cloakbrowser'}
                                    onValueChange={(val) => setQuickNetworkProfile({ ...quickNetworkProfile, engine_type: val })}
                                >
                                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cloakbrowser">🛡️ CloakBrowser (내장 파이프라인 - 권장)</SelectItem>
                                        <SelectItem value="ixbrowser">🌐 iXBrowser (외부 프로그램 API)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="font-bold text-slate-700">네트워크 IP 종류 (Proxy Mode)</Label>
                                <Select
                                    value={quickNetworkProfile.proxy_mode || 'DIRECT_LTE'}
                                    onValueChange={(val) => setQuickNetworkProfile({ ...quickNetworkProfile, proxy_mode: val })}
                                >
                                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DIRECT_LTE">📱 LTE 모바일 (EveryProxy 127.0.0.1:8080)</SelectItem>
                                        <SelectItem value="ISP_PROXY">🌐 ISP 고정 IP (안정적인 전용 IP)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {quickNetworkProfile.proxy_mode === 'ISP_PROXY' && (
                                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
                                    <p className="font-bold text-purple-900 text-xs flex items-center gap-1">
                                        <span>🌐</span> ISP 고정 IP 및 SOCKS5 인증 정보 설정
                                    </p>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="col-span-2 space-y-1">
                                            <Label className="text-[11px] text-slate-600 font-semibold">IP 주소 (Host)</Label>
                                            <Input
                                                value={quickNetworkProfile.proxy_host || ''}
                                                onChange={e => setQuickNetworkProfile({ ...quickNetworkProfile, proxy_host: e.target.value })}
                                                placeholder="192.168.1.100"
                                                className="h-8 text-xs font-mono bg-white"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-slate-600 font-semibold">포트 (Port)</Label>
                                            <Input
                                                value={quickNetworkProfile.proxy_port || ''}
                                                onChange={e => setQuickNetworkProfile({ ...quickNetworkProfile, proxy_port: e.target.value })}
                                                placeholder="1080"
                                                className="h-8 text-xs font-mono bg-white"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-slate-600 font-semibold">프록시 아이디 (User)</Label>
                                            <Input
                                                value={quickNetworkProfile.proxy_username || ''}
                                                onChange={e => setQuickNetworkProfile({ ...quickNetworkProfile, proxy_username: e.target.value })}
                                                placeholder="proxy_user"
                                                className="h-8 text-xs font-mono bg-white"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-slate-600 font-semibold">비밀번호 (Password)</Label>
                                            <Input
                                                type="password"
                                                value={quickNetworkProfile.proxy_password || ''}
                                                onChange={e => setQuickNetworkProfile({ ...quickNetworkProfile, proxy_password: e.target.value })}
                                                placeholder="••••••••"
                                                className="h-8 text-xs font-mono bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setQuickNetworkProfile(null)}>취소</Button>
                        <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 font-bold"
                            onClick={() => {
                                if (quickNetworkProfile) {
                                    updateMutation.mutate(quickNetworkProfile);
                                    setQuickNetworkProfile(null);
                                }
                            }}
                        >
                            저장 및 즉시 적용
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!quarantineTarget} onOpenChange={(o) => !o && setQuarantineTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">🚨 계정 격리 조치</DialogTitle>
                        <DialogDescription>
                            해당 계정을 90일간 격리합니다. 이 기간 동안 업로드 및 운영 작업이 차단됩니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-4">
                        <Label>위반/격리 사유</Label>
                        <Input placeholder="예: 저작권 경고 1회 (2025-01-01)" value={quarantineReason} onChange={e => setQuarantineReason(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setQuarantineTarget(null)}>취소</Button>
                        <Button variant="destructive" onClick={handleQuarantineConfirm}>격리 실행</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600">정말 삭제하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>DB 레코드와 물리 폴더가 영구 삭제됩니다.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteId(null)}>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">삭제</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <CultivationWizard
                channel={selectedChannelForWizard}
                isOpen={wizardOpen}
                onClose={() => setWizardOpen(false)}
            />
        </div>
    );
};

export default TinCanVault;
