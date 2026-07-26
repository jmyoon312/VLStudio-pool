import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Key, Database, Shield } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import axios from 'axios';

const API_BASE = typeof window !== 'undefined' && window.location.protocol === 'file:' ? 'http://127.0.0.1:8000/api' : '/api';

interface CaptainSettingsProps {
    profileId: string;
}

interface Profile {
    id: string;
    email: string;
    profile_type: string;
    status: string;
    google_project_id: string | null;
    token_expiry: string | null;
    created_at: string;
}

const CaptainSettings: React.FC<CaptainSettingsProps> = ({ profileId }) => {
    const { toast } = useToast();
    const [authenticating, setAuthenticating] = useState(false);

    // Fetch profile info
    const { data: profiles, isLoading, refetch } = useQuery({
        queryKey: ['captain-profile', profileId],
        queryFn: async () => {
            const response = await axios.get(`${API_BASE}/resources/profiles?type=CAPTAIN`);
            return response.data;
        },
    });

    const profile: Profile | undefined = profiles?.find((p: Profile) => p.id === profileId);

    // Check if profile has valid OAuth2 tokens (not just client_secret)
    const hasValidTokens = profile?.token_expiry !== null;
    const tokenExpiry = profile?.token_expiry ? new Date(profile.token_expiry) : null;
    const isTokenExpired = tokenExpiry ? tokenExpiry < new Date() : true;

    const handleOAuth2Authentication = async () => {
        setAuthenticating(true);
        try {
            // Call backend to start OAuth2 flow with isolated Chrome profile
            const response = await axios.post(`${API_BASE}/oauth2/authenticate/${profileId}`);

            toast({
                title: "인증 시작",
                description: "격리된 Chrome 프로필에서 OAuth2 인증이 시작되었습니다.",
            });

            // Poll for authentication completion
            const checkInterval = setInterval(async () => {
                try {
                    const statusResponse = await axios.get(`${API_BASE}/oauth2/status/${profileId}`);

                    if (statusResponse.data.authenticated) {
                        clearInterval(checkInterval);
                        setAuthenticating(false);

                        toast({
                            title: "인증 완료",
                            description: "OAuth2 인증이 성공적으로 완료되었습니다!",
                        });

                        // Refresh profile data
                        refetch();
                    }
                } catch (error) {
                    // Still authenticating
                }
            }, 3000); // Check every 3 seconds

            // Timeout after 5 minutes
            setTimeout(() => {
                clearInterval(checkInterval);
                setAuthenticating(false);
            }, 300000);

        } catch (error: any) {
            setAuthenticating(false);
            toast({
                variant: "destructive",
                title: "인증 실패",
                description: error.response?.data?.detail || "OAuth2 인증을 시작할 수 없습니다.",
            });
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!profile) {
        return (
            <Card className="p-12 text-center">
                <p className="text-slate-500">프로필을 찾을 수 없습니다.</p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Captain 설정</h2>
                <p className="text-slate-500 mt-1">
                    OAuth2 인증 및 API 설정 관리
                </p>
            </div>

            {/* Profile Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="w-5 h-5" />
                        프로필 정보
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-500">Profile ID</span>
                            <p className="font-mono text-slate-900">{profile.id}</p>
                        </div>
                        <div>
                            <span className="text-slate-500">이메일</span>
                            <p className="text-slate-900">{profile.email || '미설정'}</p>
                        </div>
                        <div>
                            <span className="text-slate-500">상태</span>
                            <Badge
                                variant={profile.status === 'ACTIVE' ? 'default' : 'secondary'}
                            >
                                {profile.status}
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* OAuth2 Status */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        OAuth2 인증 상태
                    </CardTitle>
                    <CardDescription>
                        YouTube Data API 접근을 위한 인증 정보
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {hasValidTokens && !isTokenExpired ? (
                        <>
                            <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="font-semibold">인증됨</span>
                            </div>

                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="text-slate-500">Google Project ID</span>
                                    <p className="font-mono text-slate-900">
                                        {profile.google_project_id || 'viraloop-manager'}
                                    </p>
                                </div>

                                {tokenExpiry && (
                                    <div>
                                        <span className="text-slate-500">Token 만료일</span>
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-slate-600" />
                                            <p className="text-slate-900">
                                                {tokenExpiry.toLocaleString('ko-KR')}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 text-slate-600">
                                <XCircle className="w-5 h-5" />
                                <span className="font-semibold">
                                    {isTokenExpired ? '인증 만료됨' : '인증 안됨'}
                                </span>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-800">
                                    💡 채널 통계 데이터를 가져오려면 OAuth2 인증이 필요합니다.
                                </p>
                            </div>

                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={handleOAuth2Authentication}
                                disabled={authenticating}
                            >
                                <Shield className="w-4 h-4 mr-2" />
                                {authenticating ? '인증 진행 중...' : 'OAuth2 인증하기'}
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>



            {/* API Quota Info */}
            <Card>
                <CardHeader>
                    <CardTitle>API Quota 정보</CardTitle>
                    <CardDescription>
                        YouTube API 일일 사용량 제한
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">일일 한도</span>
                            <span className="font-semibold">10,000 units</span>
                        </div>
                        <div className="text-xs text-slate-600">
                            실시간 사용량 추적 기능은 추후 추가 예정입니다.
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default CaptainSettings;
