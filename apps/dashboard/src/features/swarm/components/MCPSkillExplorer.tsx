import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Zap, 
  Wand2, 
  ChevronRight, 
  Activity, 
  History, 
  Hammer, 
  Sparkles, 
  RefreshCw, 
  Network, 
  Layers, 
  Info, 
  Cpu, 
  ShieldCheck,
  Terminal
} from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import api from '../../../lib/api';

export interface MCPSkillParameter {
  name: string;
  type: string;
  description?: string;
  required: boolean;
}

export interface MCPSkill {
  name: string;
  description: string;
  category: string;
  parameters: MCPSkillParameter[];
}

interface SkillAPIResponse {
  status: string;
  total_count: number;
  skills: MCPSkill[];
}

const CATEGORY_COLORS: Record<string, string> = {
  WRITER: 'from-blue-500 to-cyan-400',
  RESEARCHER: 'from-purple-500 to-indigo-400',
  MEDIA: 'from-pink-500 to-rose-400',
  EDITOR: 'from-emerald-500 to-teal-400',
  PUBLISHER: 'from-amber-500 to-orange-400',
  GENERAL: 'from-slate-500 to-gray-400'
};

export const MCPSkillExplorer = () => {
  const [skills, setSkills] = useState<MCPSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'forge' | 'creator'>('inventory');
  const [isCreating, setIsCreating] = useState(false);
  const [newSkillDraft, setNewSkillDraft] = useState({ name: '', description: '', category: 'GENERAL' });

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const response = await api.get<SkillAPIResponse>('/mcp/skills');
      if (response.data.status === 'error') {
          throw new Error(response.data.message || 'Failed to fetch skills');
      }
      setSkills(response.data.skills || []);
      setError(null);
    } catch (err: any) {
      console.error("Skill Fetch Error:", err);
      setError(err.response?.data?.message || err.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSkill = async () => {
    setIsCreating(true);
    // [SIMULATION] In real world, this would call an AI agent to generate the tool code
    setTimeout(() => {
        setIsCreating(false);
        alert(`신규 스킬 [${newSkillDraft.name}] 이(가) 성공적으로 설계 및 등록되었습니다.`);
        setNewSkillDraft({ name: '', description: '', category: 'GENERAL' });
        setActiveTab('inventory');
    }, 2000);
  };

  const categories = ['ALL', ...Array.from(new Set(skills.map(s => s.category)))];
  const filteredSkills = activeCategory === 'ALL' ? skills : skills.filter(s => s.category === activeCategory);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-700">
      <div className="max-w-full space-y-12">
        
        <div className="relative p-8 rounded-[2.5rem] bg-card border border-border shadow-xl relative overflow-hidden text-foreground">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <Badge className="bg-primary/10 text-primary border-primary/20 font-black tracking-[0.2em] px-3 py-0.5 uppercase text-[9px]">INTELLIGENCE GARRISON</Badge>
              <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase italic">
                지능형 스킬 센터 <span className="opacity-50 italic">v3.1</span>
              </h1>
              <p className="text-muted-foreground text-[11px] max-w-xl font-bold leading-relaxed opacity-80 italic">
                Model Context Protocol (MCP) 표준으로 등록된 스웜 함대의 모든 가용 무기와 스킬들을 통제합니다. 
              </p>
            </div>
            
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-2xl font-black text-foreground tabular-nums">{skills.length}</span>
                <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest">Garrisoned</span>
              </div>
              <div className="h-10 w-[1px] bg-border" />
              <div className="flex flex-col">
                <span className="text-2xl font-black text-emerald-600 tabular-nums">11.4k</span>
                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Success Ops</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-4 mt-12 bg-muted p-1.5 rounded-2xl w-fit border border-border">
            {[
                { id: 'inventory', label: 'SKILL 인벤토리', icon: Database },
                { id: 'forge', label: 'SKILL 포지 (진화)', icon: Zap },
                { id: 'creator', label: 'SKILL 파운드리 (생산)', icon: Wand2 }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                        "flex items-center gap-3 px-6 py-2.5 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest",
                        activeTab === tab.id ? "bg-card text-primary shadow-md border border-border" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                </button>
            ))}
          </div>
        </div>

        {activeTab === 'inventory' && (
            <>
                {/* Filters */}
                <div className="flex flex-wrap gap-2 animate-in fade-in duration-500">
                {categories.map(cat => (
                    <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${
                        activeCategory === cat 
                        ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10' 
                        : 'bg-card text-muted-foreground border-border hover:border-border hover:bg-muted'
                    }`}
                    >
                    {cat}
                    </button>
                ))}
                </div>

                {/* Skill Grid */}
                {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
                ) : error ? (
                <div className="p-8 bg-destructive/10 border border-destructive/20 rounded-3xl text-destructive text-sm font-bold">
                    System Error: {error}
                </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-700">
                    {filteredSkills.map((skill) => (
                    <div
                        key={skill.name}
                        onClick={() => setExpandedSkill(expandedSkill === skill.name ? null : skill.name)}
                        className="group cursor-pointer relative p-8 rounded-[2.5rem] bg-card border border-border hover:border-primary/30 backdrop-blur-md transition-all duration-500 hover:shadow-md"
                    >
                        <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.GENERAL} opacity-[0.03] rounded-full blur-[60px] group-hover:opacity-[0.08] transition-opacity`} />
                        
                        <div className="flex justify-between items-start mb-6">
                        <div className="space-y-1">
                            <span className={`text-[8px] uppercase font-black tracking-[0.2em] opacity-50 text-muted-foreground`}>
                                {skill.category}
                            </span>
                            <h3 className="text-lg font-black text-foreground italic tracking-tighter group-hover:text-primary transition-colors truncate max-w-[200px]">
                                {skill.name}
                            </h3>
                        </div>
                        <div className="h-10 w-10 bg-muted/40 rounded-2xl flex items-center justify-center border border-border">
                            <ChevronRight className={cn("w-5 h-5 text-muted-foreground/60 transition-transform duration-500", expandedSkill === skill.name ? "rotate-90 text-primary" : "")} />
                        </div>
                        </div>
                        
                        <p className="text-xs font-bold text-muted-foreground line-clamp-2 leading-relaxed h-10 italic">
                        {skill.description}
                        </p>

                        <div className="mt-6 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <Activity className="w-3 h-3 text-emerald-500" />
                                <span className="text-[9px] font-black text-emerald-500 uppercase">99.2% Stable</span>
                            </div>
                            <div className="flex -space-x-2">
                                {[1,2,3].map(i => (
                                    <div key={i} className="w-5 h-5 rounded-full border border-background bg-muted-foreground/30" title={`Agent ${i} using this skill`} />
                                ))}
                            </div>
                        </div>

                        {/* Expanded Parameters View */}
                        <div 
                        className={`mt-8 pt-8 border-t border-border transition-all duration-700 overflow-hidden ${
                            expandedSkill === skill.name ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 border-transparent pt-0 mt-0 pointer-events-none'
                        }`}
                        >
                        <h4 className="text-[10px] font-black text-primary uppercase tracking-widest mb-4 italic">Execution Parameters Payload</h4>
                        {skill.parameters.length === 0 ? (
                            <div className="text-xs text-muted-foreground italic p-6 bg-muted/40 rounded-2xl">No parameters required for this unit.</div>
                        ) : (
                            <div className="space-y-4">
                            {skill.parameters.map((param, idx) => (
                                <div key={idx} className="bg-muted/30 p-5 rounded-2xl border border-border hover:border-primary/20 transition-all">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-black text-primary">{param.name}</span>
                                        {param.required && <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[8px] font-black uppercase h-4">Required</Badge>}
                                    </div>
                                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest px-2 py-0.5 border border-border rounded-lg">{param.type}</span>
                                </div>
                                <p className="text-[10px] font-medium text-muted-foreground leading-relaxed italic">{param.description || 'No specialized metadata provided.'}</p>
                                </div>
                            ))}
                            </div>
                        )}
                        <div className="mt-8 p-6 bg-primary/5 rounded-2xl border border-primary/10 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Operational Status</span>
                                <span className="text-xs font-bold text-foreground">Ready for Swarm Integration</span>
                            </div>
                            <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse" />
                        </div>
                        </div>
                    </div>
                    ))}
                </div>
                )}
            </>
        )}

        {activeTab === 'forge' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-700">
                <Card className="bg-muted/20 border-border p-10 rounded-[3rem] space-y-8">
                    <h3 className="text-xl font-black text-foreground italic tracking-tighter uppercase flex items-center gap-3">
                        <Zap className="w-6 h-6 text-primary" /> Skill Mutation Engine
                    </h3>
                    <p className="text-sm font-bold text-muted-foreground leading-relaxed italic">
                        에이전트들이 실제 작전을 수행하며 제안한 스킬 최적화 및 변이 목록입니다. 성공률이 낮은 구간을 자동으로 분석하여 매개변수를 재조정합니다.
                    </p>
                    <div className="space-y-4">
                        {[
                            { name: 'Video Generator', proposal: 'FPS 파라미터 24 -> 30 상향 및 히그스필드 모델 교체', confidence: 94 },
                            { name: 'Trending Researcher', proposal: 'Music 뿐만 아니라 Reels 데이터셋 통합 가중치 부여', confidence: 88 }
                        ].map((p, i) => (
                            <div key={i} className="p-6 bg-card rounded-3xl border border-border space-y-4 hover:border-primary/30 transition-all shadow-sm">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-black text-foreground text-sm">{p.name}</h4>
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">{p.confidence}% Confidence</Badge>
                                </div>
                                <p className="text-xs font-medium text-muted-foreground italic">" {p.proposal} "</p>
                                <Button className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-black text-[10px] uppercase h-10 rounded-xl transition-all">
                                    진화 승인 (Apply Mutation)
                                </Button>
                            </div>
                        ))}
                    </div>
                </Card>
                <Card className="bg-muted/20 border-border p-10 rounded-[3rem] flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-24 h-24 bg-indigo-600/5 rounded-full flex items-center justify-center border border-indigo-600/10">
                        <History className="w-10 h-10 text-indigo-600 animate-spin-slow" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-black text-foreground px-20">최신 자율 진화 분석 데이터가 없습니다.</h3>
                        <p className="text-xs font-bold text-muted-foreground italic uppercase tracking-widest">Garrison agents are currently operating in stable mode_</p>
                    </div>
                </Card>
            </div>
        )}

        {activeTab === 'creator' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <Card className="lg:col-span-8 bg-card border-border p-12 rounded-[3.5rem] shadow-3xl space-y-10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-muted rounded-[1.5rem] flex items-center justify-center shadow-md rotate-3">
                                    <Hammer className="w-8 h-8 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black text-foreground italic tracking-tighter uppercase">Skill Foundry IDE</h3>
                                    <p className="text-xs font-black text-primary uppercase tracking-widest mt-1">Sovereign Intelligent Skill Development Forge</p>
                                </div>
                            </div>
                            <Badge className="bg-muted text-muted-foreground border-border font-bold uppercase tracking-widest px-4 py-2">Node Environment: v22.1</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-2">스킬 식별자 (ID)</Label>
                                <Input 
                                    value={newSkillDraft.name}
                                    onChange={(e) => setNewSkillDraft({...newSkillDraft, name: e.target.value})}
                                    placeholder="ex. viral_pattern_detector"
                                    className="h-16 rounded-[1.5rem] bg-muted/50 border-border text-foreground font-black px-8 text-sm focus:ring-4 focus:ring-primary/10"
                                />
                            </div>
                            <div className="space-y-4">
                                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-2">카테고리 할당</Label>
                                <select 
                                    value={newSkillDraft.category}
                                    onChange={(e) => setNewSkillDraft({...newSkillDraft, category: e.target.value})}
                                    className="w-full h-16 rounded-[1.5rem] bg-muted/50 border-border text-foreground font-black px-8 text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                >
                                    <option value="GENERAL">General Intelligence</option>
                                    {Object.keys(CATEGORY_COLORS).map(k => <option key={k} value={k}>{k} Engine</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between ml-2">
                                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">스킬 아키텍처 및 도구 설명 (AI Prompting Interface)</Label>
                                <Badge className="bg-primary/10 text-primary border-0 font-black text-[9px] uppercase tracking-tighter">Markdown Support Enabled</Badge>
                            </div>
                            <textarea 
                                value={newSkillDraft.description}
                                onChange={(e) => setNewSkillDraft({...newSkillDraft, description: e.target.value})}
                                placeholder="개발하고자 하는 스킬의 상세 논리 구조와 에이전트가 이 스킬을 통해 달성해야 할 구체적인 목표를 서술하세요..."
                                className="w-full h-64 rounded-[2.5rem] bg-muted/50 text-foreground font-mono p-10 text-sm leading-relaxed outline-none focus:ring-4 focus:ring-primary/20 transition-all border border-border shadow-inner"
                            />
                        </div>

                        <div className="flex gap-4">
                            <Button variant="ghost" className="flex-1 h-16 rounded-2xl font-black text-muted-foreground uppercase tracking-widest" onClick={() => setActiveTab('inventory')}>취소</Button>
                            <Button 
                                disabled={isCreating || !newSkillDraft.name}
                                onClick={handleCreateSkill}
                                className="flex-[3] h-16 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm uppercase tracking-widest rounded-2xl transition-all shadow-lg flex items-center gap-4"
                            >
                                {isCreating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                {isCreating ? 'AI 아키텍트가 스킬 코드를 생성 중...' : '신규 지능형 스킬 생산 시작 (Forge Skill)'}
                            </Button>
                        </div>
                    </Card>

                    <div className="lg:col-span-4 space-y-8">
                        <Card className="bg-card border border-border p-10 rounded-[3rem] text-foreground space-y-8 shadow-3xl overflow-hidden relative">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[60px] rounded-full" />
                             <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-3">
                                <Network className="w-5 h-5 text-primary" /> 생산 파이프라인
                             </h4>
                             <div className="space-y-6 relative z-10">
                                 {[
                                     { label: "Architecture Drafting", icon: Layers, status: isCreating ? "active" : "pending" },
                                     { label: "Code Unit Generation", icon: Terminal, status: "pending" },
                                     { label: "Security Validation", icon: ShieldCheck, status: "pending" },
                                     { label: "MCP Protocol Injection", icon: Cpu, status: "pending" }
                                 ].map((step, i) => (
                                     <div key={i} className="flex items-center gap-6 opacity-60">
                                         <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border border-border", step.status === 'active' && "bg-primary border-0 opacity-100 scale-110")}>
                                            <step.icon className="w-5 h-5" />
                                         </div>
                                         <span className={cn("text-xs font-black uppercase tracking-widest", step.status === 'active' && "text-primary opacity-100")}>{step.label}</span>
                                     </div>
                                 ))}
                             </div>
                        </Card>
                        
                        <Card className="bg-primary/10 p-10 rounded-[3rem] border-0 space-y-6">
                            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-xl">
                                <Info className="w-6 h-6 text-white" />
                            </div>
                            <h5 className="text-sm font-black text-primary uppercase italic">Evolutionary Protocol</h5>
                            <p className="text-[11px] font-bold text-muted-foreground leading-relaxed italic">
                                생성된 모든 스킬은 즉시 가상 샌드박스에서 검증됩니다. **Validator Agent**의 승인이 완료된 스킬만이 전체 함대 노드에 실시간으로 배포됩니다.
                            </p>
                        </Card>
                    </div>
                </div>
        )}
      </div>
    </div>
  );
};

export default MCPSkillExplorer;
