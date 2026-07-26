import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
    BrainCircuit, ShieldCheck, Zap, RefreshCcw,
    Settings, Info, History, Database,
    Cpu, Globe, Award, Loader2, Sparkles,
    ArrowUpCircle, ExternalLink, Home
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AIModelSelector from '@/components/shared/AIModelSelector';

const LoopieTab = () => {
    const queryClient = useQueryClient();
    const [isUpdating, setIsUpdating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // 1. Data Fetching
    const { data: loopieStatus, isLoading: isStatusLoading } = useQuery({
        queryKey: ['loopieStatus'],
        queryFn: async () => (await api.get('/hermes/status')).data,
        refetchInterval: 10000
    });

    const { data: settings, isLoading: isSettingsLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => (await api.get('/settings/')).data
    });

    // 2. Local Form State
    const [formData, setFormData] = useState<any>(null);

    // Initialize form data when settings are loaded
    React.useEffect(() => {
        if (settings && !formData) {
            setFormData({
                agent_provider: settings.hermes_agent_provider || 'google',
                agent_model: settings.hermes_agent_model || 'gemini-2.0-flash',
                hermes_wisdom_depth: settings.hermes_wisdom_depth || 3,
                reflection_verbosity: settings.hermes_reflection_verbosity || 'balanced',
                auto_reflection: settings.hermes_auto_reflection ?? true,
                auto_update_enabled: settings.hermes_auto_update_enabled ?? true,
                github_token: settings.github_token || '',
            });
        }
    }, [settings, formData]);

    // 3. Mutations
    const updateSettingsMutation = useMutation({
        mutationFn: (data: any) => api.put('/hermes/settings', data),
        onSuccess: () => {
            toast.success("Loopie 인텔리전스 설정이 영구 저장되었습니다.");
            queryClient.invalidateQueries({ queryKey: ['settings'] });
            queryClient.invalidateQueries({ queryKey: ['loopieStatus'] });
            setIsSaving(false);
        },
        onError: (e: any) => {
            toast.error(`설정 저장 실패: ${e.message}`);
            setIsSaving(false);
        }
    });

    const autoUpdateMutation = useMutation({
        mutationFn: () => api.post('/hermes/update'),
        onMutate: () => setIsUpdating(true),
        onSuccess: (res) => {
            if (res.data.status === 'success') {
                toast.success(`Loopie 업데이트 완료: ${res.data.version_info}`);
            } else {
                toast.error(`업데이트 실패: ${res.data.message}`);
            }
        },
        onError: (e: any) => toast.error(`서버 통신 오류: ${e.message}`),
        onSettled: () => setIsUpdating(false)
    });

    if (isStatusLoading || isSettingsLoading || !formData) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

    const handleFieldChange = (field: string, val: any) => {
        setFormData((prev: any) => ({
            ...prev,
            [field]: val
        }));
    };

    const handleSave = () => {
        setIsSaving(true);
        updateSettingsMutation.mutate(formData);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-indigo-500" /> Loopie Intelligence Center
                    </h2>
                    <p className="text-xs text-muted-foreground">Sovereign Intelligence의 행동 논리와 전략적 성찰을 관리합니다.</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 h-9"
                            onClick={() => autoUpdateMutation.mutate()}
                            disabled={isUpdating}
                        >
                            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                            시스템 업데이트
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 text-slate-600 hover:text-slate-900"
                            onClick={() => window.open('https://github.com/NousResearch/hermes-agent', '_blank')}
                        >
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 text-slate-600 hover:text-indigo-600"
                            onClick={() => window.open(`http://${window.location.hostname}:9119`, '_blank')}
                            title="Open Hermes Kanban Dashboard"
                        >
                            <Home className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 gap-2 h-9 shadow-md"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-4 h-4" />}
                            설정 저장
                        </Button>
                    </div>
                    {loopieStatus?.version && (
                        <div className="text-[10px] text-muted-foreground mr-1">
                            현재 버전: <span className="font-mono text-indigo-600">
                                {typeof loopieStatus.version === 'object' 
                                    ? `local: ${loopieStatus.version.local} | latest: ${loopieStatus.version.latest}` 
                                    : loopieStatus.version}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left: Identity Card */}
                <Card className="md:col-span-4 bg-muted/10 border-dashed border-2">
                    <CardHeader className="pb-2">
                        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
                            <Sparkles className="w-6 h-6 text-indigo-600" />
                        </div>
                        <CardTitle className="text-lg">Core Identity</CardTitle>
                        <CardDescription>지능 엔진 식별 정보</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground uppercase">Designation</Label>
                            <div className="text-sm font-semibold text-indigo-900">{loopieStatus?.identity || 'Strategic Coordinator'}</div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground uppercase">Current reasoning Model</Label>
                            <Badge variant="outline" className="text-xs">{loopieStatus?.model}</Badge>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground uppercase">Integrity Status</Label>
                            <div className="flex items-center gap-2 text-green-600 text-xs font-bold">
                                <ShieldCheck className="w-4 h-4" /> SECURE / OPTIMIZED
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="pt-0 border-t mt-4 text-[10px] text-muted-foreground p-4">
                        <Info className="w-3 h-3 mr-1" /> Loopie는 Collective Wisdom을 활용하여 자율 의사 결정을 수행합니다.
                    </CardFooter>
                </Card>

                {/* Right: Detailed Settings */}
                <div className="md:col-span-8 space-y-6">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="text-sm border-b pb-2">Cognitive Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Model Selection */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">전략 추론 모델 (Reasoning Model)</Label>
                                    <AIModelSelector
                                        provider={formData.agent_provider}
                                        onProviderChange={(p) => handleFieldChange('agent_provider', p)}
                                        model={formData.agent_model}
                                        onModelChange={(m) => handleFieldChange('agent_model', m)}
                                        showPreset={false}
                                        compact={true}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">성찰 깊이 (Reflection Verbosity)</Label>
                                    <Select
                                        value={formData.reflection_verbosity}
                                        onValueChange={(v) => handleFieldChange('reflection_verbosity', v)}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low (Summary Only)</SelectItem>
                                            <SelectItem value="balanced">Balanced (Strategic Analysis)</SelectItem>
                                            <SelectItem value="high">High (Granular Tech Breakdown)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* GitHub Token Section */}
                            <div className="space-y-2 pt-2 border-t border-dashed">
                                <Label className="text-xs flex items-center gap-2">
                                    <Globe className="w-3 h-3 text-slate-500" /> GitHub Access Token (for Auto-Update)
                                </Label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={formData.github_token}
                                        onChange={(e) => handleFieldChange('github_token', e.target.value)}
                                        placeholder="ghp_xxxxxxxxxxxx"
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="text-[10px] h-9 px-2"
                                        onClick={() => window.open('https://github.com/settings/tokens', '_blank')}
                                    >
                                        토큰 발급
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">
                                    * 비공개 리포지토리 업데이트를 위해 필요합니다. 토큰은 DB에 안전하게 암호화되어 저장됩니다.
                                </p>
                            </div>

                            {/* Wisdom Depth Slider */}
                            <div className="space-y-4">
                                <div className="flex justify-between">
                                    <Label className="text-xs font-bold flex items-center gap-2">
                                        <Database className="w-3 h-3 text-indigo-500" /> Wisdom Context Depth
                                    </Label>
                                    <span className="text-xs font-mono text-indigo-600">{formData.hermes_wisdom_depth} Successful Missions</span>
                                </div>
                                <Slider
                                    value={[formData.hermes_wisdom_depth]}
                                    max={10}
                                    step={1}
                                    onValueChange={(val) => {
                                        handleFieldChange('hermes_wisdom_depth', val[0]);
                                    }}
                                />
                                <p className="text-[10px] text-muted-foreground italic">
                                    추론 시 과거의 어떤 성공 경험을 얼마큼 참조할지 결정합니다. 수치가 높을수록 정확하지만 연산량이 많아집니다.
                                </p>
                            </div>

                            {/* Automation Switches */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <div className="flex items-center justify-between p-3 border rounded-lg bg-indigo-50/20">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-bold">자율 성찰 (Auto-Reflection)</Label>
                                        <p className="text-[10px] text-muted-foreground">미션 종료 시 자동 학습 수행</p>
                                    </div>
                                    <Switch
                                        checked={formData.auto_reflection}
                                        onCheckedChange={(c) => handleFieldChange('auto_reflection', c)}
                                    />
                                </div>
                                <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50/20">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-bold">지능 자동 갱신 (Auto-Update)</Label>
                                        <p className="text-[10px] text-muted-foreground">최신 tactical definitions 동기화</p>
                                    </div>
                                    <Switch
                                        checked={formData.auto_update_enabled}
                                        onCheckedChange={(c) => handleFieldChange('auto_update_enabled', c)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Alert className="bg-amber-50 border-amber-200">
                        <History className="h-4 w-4 text-amber-600" />
                        <CardTitle className="text-xs font-bold text-amber-800">Learning Cycle Insight</CardTitle>
                        <AlertDescription className="text-[10px] text-amber-700">
                            현재 시스템은 총 {loopieStatus?.wisdom_depth || formData.hermes_wisdom_depth}개의 의미론적 맥락을 유지하고 있습니다. '이미지 생성 오류' 영역에서 최근 72시간 내 가장 활발한 자가 교정이 일어났습니다.
                        </AlertDescription>
                    </Alert>
                </div>
            </div>
        </div>
    );
};
export default LoopieTab;
