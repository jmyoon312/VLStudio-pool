import io

with io.open('old_incubator_clean.tsx', mode='r', encoding='utf-8') as f:
    lines = f.readlines()

# The content starts at `<div className="max-w-4xl mx-auto">` which is line 158
start_idx = 158

# The content ends around line 402, let's find the closing `)}`
end_idx = 402

network_content = "".join(lines[start_idx:end_idx])

new_file = f"""import React, {{ useState, useEffect, useRef }} from 'react';
import {{ Button }} from "@/components/ui/button";
import {{
    Shield, User, Activity, RefreshCw, Smartphone, Wifi,
    Signal, Rocket, Globe, Server, CheckCircle2, XCircle, Cable, Bot
}} from 'lucide-react';
import {{ useToast }} from '@/components/ui/use-toast';
import api from '@/lib/api';
import {{ Card, CardContent }} from "@/components/ui/card";

export default function NetworkDashboard() {{
    const {{ toast }} = useToast();
    const [networkStatus, setNetworkStatus] = useState<any>({{
        status_detail: "IDLE",
        current_ip: "확인 중...",
        interface_ip: "..."
    }});
    const [isNetworkLoading, setIsNetworkLoading] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const pollingRef = useRef<any>(null);

    const loadNetworkStatus = async (isManual = false) => {{
        if (isManual) setIsNetworkLoading(true);
        try {{
            const url = `/resources/network/status?t=${{Date.now()}}${{isManual ? '&force=true' : ''}}`;
            const res = await api.get(url);
            setNetworkStatus(res.data);
            if (isManual) toast({{ description: "강제 IP 갱신 완료" }});
        }} catch (e) {{
            console.error(e);
            toast({{ variant: "destructive", title: "오류", description: "서버 연결 실패" }});
        }}
        finally {{
            if (isManual) setIsNetworkLoading(false);
        }}
    }};

    const handleRotate = async (method: 'soft' | 'hard') => {{
        setIsRotating(true);
        try {{
            await api.post(`/resources/network/rotate`, {{ method }});
            toast({{
                title: "IP 교체 명령 전달됨",
                description: "네트워크 재설정 중... (새 IP 감지 시 자동 갱신)"
            }});
            setTimeout(() => {{
                setIsRotating(false);
                loadNetworkStatus();
            }}, 1000);
        }} catch {{
            setIsRotating(false);
            toast({{ variant: "destructive", title: "오류", description: "IP 교체 요청 실패" }});
        }}
    }};

    useEffect(() => {{
        loadNetworkStatus();
        pollingRef.current = setInterval(() => {{
            loadNetworkStatus();
        }}, 3000);
        return () => {{
            if (pollingRef.current) clearInterval(pollingRef.current);
        }};
    }}, []);

    const isConnected = networkStatus.status_detail !== 'DISCONNECTED';

    return (
        <div className="p-4 md:p-6 space-y-4 bg-background min-h-screen text-foreground font-sans animate-in fade-in duration-300">
            <div className="flex flex-col gap-1 mb-6">
                <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-3 tracking-tight">
                    <Activity className="w-8 h-8 text-indigo-600" />
                    네트워크 대시보드
                </h1>
                <p className="text-muted-foreground text-sm font-medium">
                    듀얼 프록시 격리 시스템 및 네트워크 상태를 모니터링하고 제어합니다.
                </p>
            </div>
{network_content}
        </div>
    );
}}
"""

with io.open('apps/dashboard/src/pages/NetworkDashboard.tsx', mode='w', encoding='utf-8') as fw:
    fw.write(new_file)
