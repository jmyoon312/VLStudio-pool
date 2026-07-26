import React from 'react';
import { AgentNodeData } from './AgentTopologyNode';
import { BrainCircuit, X, Sliders, Key, Zap, ShieldCheck, Activity, Award, Network, Cpu, Fingerprint, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface AgentDNAInspectorProps {
    nodeId: string;
    nodeData: AgentNodeData;
    onClose: () => void;
    settings?: any;
}

export const AgentDNAInspector: React.FC<AgentDNAInspectorProps> = ({ nodeId, nodeData, onClose, settings }) => {
    const getActiveModelInfo = () => {
        if (!settings) return { provider: 'google', model: 'gemini-2.0-flash-exp' };
        
        switch (nodeData.role) {
            case 'COORDINATOR':
            case 'WRITER':
            case 'ANALYST':
                return {
                    provider: settings.openclaude_provider || 'google',
                    model: settings.openclaude_model || 'gemini-2.0-flash-exp'
                };
            case 'RESEARCHER':
            case 'MEDIA':
                return {
                    provider: settings.openclaude_provider === 'google' ? 'anthropic' : (settings.openclaude_provider || 'anthropic'),
                    model: settings.openclaude_provider === 'google' ? 'claude-3-5-sonnet' : (settings.openclaude_model || 'claude-3-5-sonnet-20240620')
                };
            default:
                return {
                    provider: settings.hermes_agent_provider || 'groq',
                    model: settings.hermes_agent_model || 'llama-3.3-70b-versatile'
                };
        }
    };

    const activeBrain = getActiveModelInfo();

    return (
        <div className="absolute top-0 right-0 w-[450px] h-full bg-card/95 backdrop-blur-2xl border-l border-border shadow-2xl flex flex-col z-[100] animate-in slide-in-from-right-full duration-500 ease-out">
            {/* Header */}
            <div className="p-10 border-b border-border flex items-start justify-between bg-card/50">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[2rem] bg-primary shadow-md flex items-center justify-center border border-primary/20">
                        <BrainCircuit className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1">SOVEREIGN AGENT DNA</div>
                        <h2 className="text-2xl font-black text-foreground tracking-tighter italic uppercase">{nodeData.label}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[9px] font-black uppercase text-muted-foreground border-border">{nodeData.role}</Badge>
                            <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Node ID: {nodeId}</span>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={onClose} 
                    className="p-3 bg-muted hover:bg-accent rounded-2xl text-muted-foreground hover:text-foreground transition-all border border-border"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Content Stack */}
            <ScrollArea className="flex-1 p-10">
                <div className="space-y-12">
                    
                    {/* Live Telemetry Overview */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/50 p-6 rounded-[2rem] border border-border shadow-sm">
                            <div className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-2 flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5 text-emerald-500" /> 운영 상태
                            </div>
                            <div className="text-lg font-black text-foreground uppercase italic">{nodeData.status}</div>
                        </div>
                        <div className="bg-muted/50 p-6 rounded-[2rem] border border-border shadow-sm">
                            <div className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-2 flex items-center gap-2">
                                <Award className="w-3.5 h-3.5 text-amber-500" /> 지능 숙련도
                            </div>
                            <div className="text-lg font-black text-warning italic uppercase">Lv. 14 Prime</div>
                        </div>
                    </div>

                    {/* Brain Config (LLM & Temp) */}
                    <div className="space-y-6">
                        <h3 className="text-[11px] font-black uppercase text-foreground tracking-[0.2em] flex items-center gap-3">
                            <Sliders className="w-4 h-4 text-primary" /> 신경망 인지 구성 (Cognition)
                        </h3>
                        
                        <div className="space-y-8 bg-card rounded-[2.5rem] p-8 border border-border shadow-md">
                            <div className="space-y-3">
                                <Label className="text-[10px] text-muted-foreground font-black uppercase tracking-widest ml-1">액티브 추론 뇌 (LangChain 연동)</Label>
                                <div className="flex flex-col gap-2.5 p-4 bg-muted border border-border rounded-2xl shadow-inner mt-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-muted-foreground">Provider</span>
                                        <Badge className="bg-primary/10 text-primary font-bold uppercase text-[9px] tracking-wider border border-primary/20">
                                            {activeBrain.provider}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-muted-foreground">Active Model</span>
                                        <span className="text-xs font-mono font-black text-foreground">
                                            {activeBrain.model.split('/').pop()}
                                        </span>
                                    </div>
                                    <div className="text-[9px] text-muted-foreground mt-1 italic border-t pt-2 border-border">
                                        * 이 에이전트의 뇌는 LangChain 기반 brain_router를 통해 지정된 모델로 동적 오케스트레이션됩니다.
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-black uppercase tracking-widest px-1">
                                    <Label>창의성 임계값 (Temperature)</Label>
                                    <span className="text-primary font-black">0.7 / 1.0</span>
                                </div>
                                <Progress value={70} className="h-2 bg-muted" />
                            </div>
                        </div>
                    </div>

                    {/* Skill Bindings (Tool Use) */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-[11px] font-black uppercase text-foreground tracking-[0.2em] flex items-center gap-3">
                                <Zap className="w-4 h-4 text-amber-500" /> Sovereign MCP Skills
                            </h3>
                            {nodeData.isThinking && (
                                <Badge className="bg-warning/10 text-warning-foreground border-warning/20 animate-pulse font-black text-[9px] uppercase px-3 py-1">
                                    TOOL EXECUTING...
                                </Badge>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                            {nodeData.skills.length > 0 ? nodeData.skills.map((skill, i) => (
                                <div key={i} className="bg-muted border border-border p-5 rounded-3xl flex items-center justify-between group hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm">
                                            <Key className="w-4 h-4 text-amber-500" />
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Protocol v1.2</div>
                                            <span className="text-sm font-black text-foreground italic uppercase">{skill}</span>
                                        </div>
                                    </div>
                                    {nodeData.isThinking && i === 0 && (
                                        <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                                    )}
                                </div>
                            )) : (
                                <div className="bg-muted border border-border p-10 rounded-[2.5rem] text-center border-dashed">
                                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest italic">할당된 자율 스킬 없음</span>
                                </div>
                            )}
                            
                            <Button variant="outline" className="w-full mt-2 border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/50 bg-card hover:bg-primary/5 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                                + Add MCP Skill Binding
                            </Button>
                        </div>
                    </div>
                    
                    {/* Evolution Context */}
                    <div className="space-y-6">
                        <h3 className="text-[11px] font-black uppercase text-foreground tracking-[0.2em] flex items-center gap-3">
                            <Fingerprint className="w-4 h-4 text-emerald-500" /> 진화 가이드라인 (Policy)
                        </h3>
                        <div className="bg-card p-8 rounded-[2.5rem] border border-border shadow-md relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Network className="w-32 h-32 text-emerald-400" />
                            </div>
                            <ScrollArea className="h-40 relative z-10">
                                <p className="text-[11px] font-mono leading-relaxed text-emerald-400 opacity-90">
                                    // 과거 고성능 세션 데이터 주입됨:<br/>
                                    // ID: #SYNTH_SESSION_982<br/>
                                    // 성과: Music 1.2M 뷰 달성<br/><br/>
                                    <span className="text-white font-bold">&gt; "장면 전환 주기는 1.2s~1.8s 사이를 유지할 것."</span><br/>
                                    <span className="text-white font-bold">&gt; "후크 오디오: 베이스가 강조된 시네마틱 스타일 권장"</span><br/>
                                    <span className="text-white font-bold">&gt; "색감 보정: #A855F7 테마 오버레이 주입"</span><br/><br/>
                                    [시스템 가이드 최신화 대기 중...]
                                </p>
                            </ScrollArea>
                        </div>
                    </div>

                </div>
            </ScrollArea>
            
            {/* Footer */}
            <div className="p-10 border-t border-border bg-muted/50 backdrop-blur-xl">
                <Button className="w-full h-16 rounded-2xl bg-primary hover:bg-accent text-primary-foreground font-black uppercase tracking-[0.2em] shadow-md transition-all transform hover:-translate-y-1">
                    신경망 변이 프로필 저장
                </Button>
            </div>
        </div>
    );
};
