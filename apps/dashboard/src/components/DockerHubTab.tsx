import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { 
    Server, RefreshCcw, Terminal, Activity, 
    ShieldCheck, AlertCircle, Clock, Cpu, 
    HardDrive, List, Play, Square, Loader2,
    Eye
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface ContainerStatus {
    name: string;
    status: string;
    image: string;
    uptime: string;
    cpu_usage: string;
    mem_usage: string;
}

const DockerHubTab = () => {
    const queryClient = useQueryClient();
    const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
    const [containerLogs, setContainerLogs] = useState<string[]>([]);
    const [isLogLoading, setIsLogLoading] = useState(false);

    const { data: infra, isLoading, isError, refetch } = useQuery({
        queryKey: ['infraStatus'],
        queryFn: async () => (await api.get('/infra/status')).data,
        refetchInterval: 5000 // Poll every 5s
    });

    const restartMutation = useMutation({
        mutationFn: (name: string) => api.post(`/infra/restart/${name}`),
        onSuccess: (_, name) => {
            toast.success(`${name} 컨테이너가 재시작되었습니다.`);
            queryClient.invalidateQueries({ queryKey: ['infraStatus'] });
        },
        onError: (e: any) => toast.error(`재시작 실패: ${e.message}`)
    });

    const fetchLogs = async (name: string) => {
        setIsLogLoading(true);
        setSelectedContainer(name);
        try {
            const res = await api.get(`/infra/logs/${name}?lines=100`);
            setContainerLogs(res.data.logs || []);
        } catch (e) {
            toast.error("로그를 불러오는데 실패했습니다.");
        } finally {
            setIsLogLoading(false);
        }
    };

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

    if (isError || (infra && !infra.docker_available)) {
        return (
            <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Docker Socket 연결 오류</AlertTitle>
                <AlertDescription>
                    시스템이 Docker 호스트에 접근할 수 없습니다. <code>docker-compose.yml</code>의 <code>/var/run/docker.sock</code> 마운트 설정을 확인하십시오.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" /> Infrastructure Hub
                    </h2>
                    <p className="text-xs text-muted-foreground">실시간 컨테이너 상태 및 자원 사용률을 모니터링합니다.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                    <RefreshCcw className="w-4 h-4" /> 새로고침
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {infra.services.map((service: ContainerStatus) => (
                    <Card key={service.name} className={cn(
                        "transition-all duration-300 border-l-4",
                        service.status === 'running' ? "border-l-green-500 shadow-sm" : "border-l-red-500 opacity-80"
                    )}>
                        <CardHeader className="pb-2 space-y-1">
                            <div className="flex justify-between items-start">
                                <Badge variant={service.status === 'running' ? "secondary" : "destructive"} className="text-[10px] uppercase tracking-wider">
                                    {service.status}
                                </Badge>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fetchLogs(service.name)}>
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-7 w-7 text-blue-600" 
                                        onClick={() => restartMutation.mutate(service.name)}
                                        disabled={restartMutation.isPending}
                                    >
                                        <RefreshCcw className={cn("w-4 h-4", restartMutation.isPending && "animate-spin")} />
                                    </Button>
                                </div>
                            </div>
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Server className="w-4 h-4" /> {service.name}
                            </CardTitle>
                            <CardDescription className="text-[10px] truncate">
                                {service.image}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-0">
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                        <span className="flex items-center gap-1 text-muted-foreground"><Cpu className="w-3 h-3" /> CPU</span>
                                        <span className="font-medium">{service.cpu_usage}</span>
                                    </div>
                                    <Progress value={parseFloat(service.cpu_usage)} className="h-1 bg-muted" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                        <span className="flex items-center gap-1 text-muted-foreground"><HardDrive className="w-3 h-3" /> MEM</span>
                                        <span className="font-medium">{service.mem_usage}</span>
                                    </div>
                                    <Progress value={Math.min(100, (parseFloat(service.mem_usage) / 512) * 100)} className="h-1 bg-muted" />
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1">
                                <Clock className="w-3 h-3" /> Uptime: {service.uptime.split('T')[1].split('.')[0]}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Log Viewer Dialog */}
            <Dialog open={!!selectedContainer} onOpenChange={() => setSelectedContainer(null)}>
                <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Terminal className="w-5 h-5" /> {selectedContainer} Logs
                        </DialogTitle>
                        <DialogDescription>최근 100줄의 실행 로그를 확인합니다.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[500px] w-full bg-black/90 rounded-md p-4 mt-2">
                        {isLogLoading ? (
                            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-white" /></div>
                        ) : (
                            <div className="font-mono text-xs text-green-400 space-y-1">
                                {containerLogs.length > 0 ? containerLogs.map((log, i) => (
                                    <div key={i} className="whitespace-pre-wrap py-0.5 border-b border-white/5">{log}</div>
                                )) : <p className="text-muted-foreground italic">No logs available.</p>}
                            </div>
                        )}
                    </ScrollArea>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" size="sm" onClick={() => fetchLogs(selectedContainer!)}>
                            <RefreshCcw className="w-4 h-4 mr-2" /> 새로고침
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setSelectedContainer(null)}>
                            닫기
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DockerHubTab;
