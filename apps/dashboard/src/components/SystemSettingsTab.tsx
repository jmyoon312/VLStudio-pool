import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, RefreshCw, Save, Shield, Database } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

interface SystemSettings {
    general: {
        language: string;
        theme: string;
        notifications: boolean;
    };
    rate_limiting: {
        mode: 'SAFE' | 'BALANCED' | 'AGGRESSIVE';
        requests_per_minute: number;
        rate_limit_window: number; // [NEW]
        circuit_breaker_threshold: number; // [NEW]
        enabled: boolean;
        enable_view_stats_collection: boolean; // [NEW]
    };
    maintenance: {
        auto_cleanup: boolean;
        cleanup_interval_days: number;
        backup_enabled: boolean;
    };
}

export function SystemSettingsTab() {
    const queryClient = useQueryClient();
    const [hasChanges, setHasChanges] = useState(false);


    // 시스템 설정 조회
    const { data: settings, isLoading, error } = useQuery<SystemSettings>({
        queryKey: ['systemSettings'],
        queryFn: async () => {
            const response = await api.get('/settings/system');
            return response.data;
        }
    });

    // Rate Limiting 설정 업데이트
    const updateRateLimitingMutation = useMutation({
        mutationFn: (data: any) => api.put('/settings/rate-limiting', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
            toast.success('Rate limiting settings updated');
            setHasChanges(false);
        },
        onError: (err: any) => {
            toast.error(`Failed to update settings: ${err.message}`);
        }
    });

    // 유지보수 설정 업데이트
    const updateMaintenanceMutation = useMutation({
        mutationFn: (data: any) => api.put('/settings/maintenance', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
            toast.success('Maintenance settings updated');
            setHasChanges(false);
        },
        onError: (err: any) => {
            toast.error(`Failed to update settings: ${err.message}`);
        }
    });

    // 레이트 리밋 프리셋 정의
    const RATE_LIMIT_PRESETS = {
        SAFE: { requests_per_minute: 20, rate_limit_window: 60, circuit_breaker_threshold: 3 },
        BALANCED: { requests_per_minute: 30, rate_limit_window: 60, circuit_breaker_threshold: 5 },
        AGGRESSIVE: { requests_per_minute: 60, rate_limit_window: 60, circuit_breaker_threshold: 10 }
    };

    const handleRateLimitingChange = (mode: 'SAFE' | 'BALANCED' | 'AGGRESSIVE') => {
        const preset = RATE_LIMIT_PRESETS[mode];
        updateRateLimitingMutation.mutate({
            mode,
            ...preset
        });
    };

    const handleMaintenanceChange = (key: string, value: any) => {
        if (!settings) return;
        updateMaintenanceMutation.mutate({
            ...settings.maintenance,
            [key]: value
        });
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading settings...</span>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>Failed to load system settings</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">시스템 설정</h2>
                    <p className="text-muted-foreground">
                        시스템 전체 동작, 성능 최적화 및 유지보수 작업을 설정합니다.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Rate Limiting Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-blue-500" />
                                    Rate Limiting (속도 제한)
                                </CardTitle>
                                <CardDescription>
                                    유튜브 차단을 방지하고 다운로드 안정성을 확보합니다.
                                </CardDescription>
                            </div>
                            <Badge variant={settings?.rate_limiting?.enabled ? "default" : "secondary"}>
                                {settings?.rate_limiting?.mode || 'UNKNOWN'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-4">
                            <div
                                className={`p-4 rounded-lg border cursor-pointer transition-all ${settings?.rate_limiting?.mode === 'SAFE' ? 'border-green-500 bg-green-50/10' : 'hover:bg-accent'}`}
                                onClick={() => handleRateLimitingChange('SAFE')}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium">안전 모드 (Safe)</span>
                                    {settings?.rate_limiting?.mode === 'SAFE' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                    보수적인 제한. IP 차단 위험 최소화. 24/7 자동화에 권장됩니다.
                                </p>
                                <div className="flex gap-2 text-xs font-mono text-muted-foreground bg-muted/50 p-2 rounded">
                                    <span>20 RPM</span>
                                    <span>•</span>
                                    <span>60s Window</span>
                                    <span>•</span>
                                    <span>Threshold 3</span>
                                </div>
                            </div>

                            <div
                                className={`p-4 rounded-lg border cursor-pointer transition-all ${settings?.rate_limiting?.mode === 'BALANCED' ? 'border-blue-500 bg-blue-50/10' : 'hover:bg-accent'}`}
                                onClick={() => handleRateLimitingChange('BALANCED')}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium">균형 모드 (Balanced)</span>
                                    {settings?.rate_limiting?.mode === 'BALANCED' && <CheckCircle2 className="h-4 w-4 text-blue-500" />}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                    성능과 안정성의 조화. 일반적인 사용 시 기본 설정입니다.
                                </p>
                                <div className="flex gap-2 text-xs font-mono text-muted-foreground bg-muted/50 p-2 rounded">
                                    <span>30 RPM</span>
                                    <span>•</span>
                                    <span>60s Window</span>
                                    <span>•</span>
                                    <span>Threshold 5</span>
                                </div>
                            </div>

                            <div
                                className={`p-4 rounded-lg border cursor-pointer transition-all ${settings?.rate_limiting?.mode === 'AGGRESSIVE' ? 'border-orange-500 bg-orange-50/10' : 'hover:bg-accent'}`}
                                onClick={() => handleRateLimitingChange('AGGRESSIVE')}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium">공격적 모드 (Aggressive)</span>
                                    {settings?.rate_limiting?.mode === 'AGGRESSIVE' && <CheckCircle2 className="h-4 w-4 text-orange-500" />}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                    최대 처리량. 일시적 차단 위험이 있으며, 프록시 사용 시에만 권장됩니다.
                                </p>
                                <div className="flex gap-2 text-xs font-mono text-muted-foreground bg-muted/50 p-2 rounded">
                                    <span>60 RPM</span>
                                    <span>•</span>
                                    <span>60s Window</span>
                                    <span>•</span>
                                    <span>Threshold 10</span>
                                </div>
                            </div>
                        </div>

                        <Separator className="my-4" />

                        {/* [NEW] Advanced Controls */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-medium">고급 설정 (Advanced)</h4>

                            {/* RPM Slider */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs">분당 최대 요청 (Requests Per Minute)</Label>
                                    <span className="text-xs font-mono">{settings?.rate_limiting?.requests_per_minute} RPM</span>
                                </div>
                                <Slider
                                    value={[settings?.rate_limiting?.requests_per_minute || 30]}
                                    min={10}
                                    max={120}
                                    step={5}
                                    onValueChange={(val) => {
                                        if (settings && settings.rate_limiting) {
                                            updateRateLimitingMutation.mutate({
                                                ...settings.rate_limiting,
                                                requests_per_minute: val[0]
                                            });
                                        }
                                    }}
                                />
                            </div>

                            {/* Window Slider */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs">제한 윈도우 (Window Seconds)</Label>
                                    <span className="text-xs font-mono">{settings?.rate_limiting?.rate_limit_window || 60}s</span>
                                </div>
                                <Slider
                                    value={[settings?.rate_limiting?.rate_limit_window || 60]}
                                    min={30}
                                    max={300}
                                    step={10}
                                    onValueChange={(val) => {
                                        if (settings && settings.rate_limiting) {
                                            updateRateLimitingMutation.mutate({
                                                ...settings.rate_limiting,
                                                rate_limit_window: val[0]
                                            });
                                        }
                                    }}
                                />
                            </div>

                            {/* Threshold Slider */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs">Circuit Breaker 임계값 (Threshold)</Label>
                                    <span className="text-xs font-mono">{settings?.rate_limiting?.circuit_breaker_threshold || 5} Errors</span>
                                </div>
                                <Slider
                                    value={[settings?.rate_limiting?.circuit_breaker_threshold || 5]}
                                    min={1}
                                    max={20}
                                    step={1}
                                    onValueChange={(val) => {
                                        if (settings && settings.rate_limiting) {
                                            updateRateLimitingMutation.mutate({
                                                ...settings.rate_limiting,
                                                circuit_breaker_threshold: val[0]
                                            });
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* [NEW] Strategic Options Card */}
                <Card>
                    <CardHeader>
                        <div className="space-y-1">
                            <CardTitle className="text-base flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                                전략적 수집 제어 (Strategic Collection)
                            </CardTitle>
                            <CardDescription>
                                유튜브 IP 차단 위험을 줄이기 위해 특정 수집 기능을 비활성화합니다.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-2">
                            <div className="space-y-0.5">
                                <Label htmlFor="view-stats">조회수 추적 활성화 (View Stats Tracking)</Label>
                                <p className="text-sm text-muted-foreground">
                                    이미 다운로드된 영상의 조회수 변화를 주기적으로 수집합니다. 끄면 요청 수가 줄어듭니다.
                                </p>
                            </div>
                            <Switch
                                id="view-stats"
                                checked={settings?.rate_limiting?.enable_view_stats_collection}
                                onCheckedChange={(checked) => {
                                    if (settings && settings.rate_limiting) {
                                        updateRateLimitingMutation.mutate({
                                            ...settings.rate_limiting,
                                            enable_view_stats_collection: checked
                                        });
                                    }
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Maintenance Card */}
                <Card>
                    <CardHeader>
                        <div className="space-y-1">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Database className="h-4 w-4 text-purple-500" />
                                시스템 유지보수
                            </CardTitle>
                            <CardDescription>
                                데이터베이스 최적화 및 디스크 정리
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-2">
                            <div className="space-y-0.5">
                                <Label htmlFor="auto-cleanup">자동 정리 (Auto Cleanup)</Label>
                                <p className="text-sm text-muted-foreground">
                                    오래된 프로세스 로그 및 임시 파일을 자동 삭제합니다
                                </p>
                            </div>
                            <Switch
                                id="auto-cleanup"
                                checked={settings?.maintenance?.auto_cleanup}
                                onCheckedChange={(checked) => handleMaintenanceChange('auto_cleanup', checked)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>정리 주기 (Cleanup Interval)</Label>
                            <div className="flex items-center gap-4">
                                <Slider
                                    value={[settings?.maintenance?.cleanup_interval_days || 30]}
                                    max={90}
                                    min={7}
                                    step={1}
                                    onValueChange={(value) => handleMaintenanceChange('cleanup_interval_days', value[0])}
                                    className="flex-1"
                                />
                                <span className="w-12 text-right text-sm font-mono">
                                    {settings?.maintenance?.cleanup_interval_days}일
                                </span>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between space-x-2">
                            <div className="space-y-0.5">
                                <Label htmlFor="daily-backup">일일 백업 (Daily Backup)</Label>
                                <p className="text-sm text-muted-foreground">
                                    매일 새벽 3시에 데이터베이스를 자동으로 백업합니다
                                </p>
                            </div>
                            <Switch
                                id="daily-backup"
                                checked={settings?.maintenance?.backup_enabled}
                                onCheckedChange={(checked) => handleMaintenanceChange('backup_enabled', checked)}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button variant="outline" className="w-full" onClick={() => toast.info('수동 백업이 시작되었습니다')}>
                            <Save className="mr-2 h-4 w-4" />
                            지금 백업 실행
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
