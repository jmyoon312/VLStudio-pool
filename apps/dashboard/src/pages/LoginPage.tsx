import React, { useState } from 'react';
// @ts-ignore
import { useAuth } from '@/contexts/AuthContext';
// @ts-ignore
import { useI18n } from '../features/flow2capcut/hooks/useI18n';
import { Zap } from 'lucide-react';

export default function LoginPage() {
    const { t } = useI18n();
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleGoogleLogin = async () => {
        if (loading) return;
        setLoading(true);
        setErrorMsg('');
        try {
            await login();
        } catch (error: any) {
            console.error('[LoginPage] OAuth Login failed:', error);
            setErrorMsg(error.message || 'Google 로그인 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen w-screen bg-gradient-to-tr from-background via-muted/40 to-primary/5 font-sans select-none relative overflow-hidden text-foreground">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-primary/5 blur-[130px] pointer-events-none" />

            <div className="w-full max-w-[420px] px-6 z-10 animate-in fade-in duration-500">
                <div className="bg-card/85 backdrop-blur-xl border border-border/80 rounded-3xl shadow-2xl p-10 flex flex-col items-center relative transition-all duration-300 hover:shadow-primary/5">

                    {/* Brand Logo */}
                    <div className="flex items-center gap-2.5 select-none transition-opacity hover:opacity-80 cursor-pointer mb-8 font-bold tracking-tighter">
                        <div className="w-9 h-9 bg-primary rounded-[10px] flex items-center justify-center shadow-[0_2px_6px_rgba(59,130,246,0.2)]">
                            <Zap className="w-5 h-5 text-primary-foreground fill-current" />
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-[22px] font-extrabold text-foreground leading-none">ViraLoop</span>
                            <span className="text-[10px] font-bold text-muted-foreground tracking-tighter uppercase">v3.5</span>
                        </div>
                    </div>

                    {/* Greetings */}
                    <div className="text-center mb-8">
                        <h2 className="text-xl font-extrabold text-foreground tracking-tight mb-2">
                            인공지능 오케스트레이션의 시작
                        </h2>
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                            Google Flow AI 미디어 자동 생성을 활성화하고 CapCut 프로젝트 통합 허브에 로그인하세요.
                        </p>
                    </div>

                    {/* Display Error if any */}
                    {errorMsg && (
                        <div className="w-full mb-6 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-center text-xs font-semibold text-destructive animate-fade-in">
                            ⚠️ {errorMsg}
                        </div>
                    )}

                    {/* Google Login Button */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full py-3.5 px-5 bg-card hover:bg-muted border border-border hover:border-muted-foreground/30 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-sm hover:shadow-md group relative overflow-hidden text-foreground"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
                        ) : (
                            <svg className="w-5 h-5 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                                <path
                                    fill="#EA4335"
                                    d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.197 2.698 1.24 6.65l4.026 3.115z"
                                />
                                <path
                                    fill="#4285F4"
                                    d="M16.04 15.345c-1.077.733-2.483 1.155-4.04 1.155a7.09 7.09 0 0 1-6.734-4.855L1.24 14.76A11.962 11.962 0 0 0 12 24c3.238 0 6.22-1.077 8.351-2.913l-4.31-1.742z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M1.24 14.76A11.962 11.962 0 0 0 12 24l4.31-1.742a7.077 7.077 0 0 1-6.734-4.855L1.24 14.76z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.197 2.698 1.24 6.65l4.026 3.115A7.09 7.09 0 0 1 12 4.909z"
                                />
                            </svg>
                        )}
                        <span className="text-xs font-bold text-foreground tracking-tight">
                            {loading ? '인증 처리 중...' : 'Google 계정으로 계속하기'}
                        </span>
                    </button>

                </div>
            </div>
        </div>
    );
}
