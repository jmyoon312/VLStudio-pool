import React, { useState, useEffect, useRef } from 'react';
import { Bot, Plus, Trash2, LayoutGrid, MonitorPlay, X, LayoutPanelLeft, LayoutPanelTop, Minus, MoveHorizontal } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

const SPLIT_MODES = [
    { value: 'split-left', label: 'Flow 좌측', icon: <LayoutPanelLeft className="w-4 h-4" /> },
    { value: 'split-right', label: 'Flow 우측', icon: <LayoutPanelLeft className="w-4 h-4 rotate-180" /> },
    { value: 'split-top', label: 'Flow 상단', icon: <LayoutPanelTop className="w-4 h-4" /> },
    { value: 'split-bottom', label: 'Flow 하단', icon: <LayoutPanelTop className="w-4 h-4 rotate-180" /> },
];

interface Profile {
    id: string;
    name: string;
    email?: string;
}

export default function MultiWindowController({
    activeViews,
    activeProfileId,
    syncViewsAndProfiles
}: {
    activeViews: string[];
    activeProfileId: string;
    syncViewsAndProfiles: () => void;
}) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    
    // Layout State
    const [mode, setMode] = useState(() => {
        try { return JSON.parse(localStorage.getItem('layoutSettings') || '{}').mode || 'split-left'; } catch { return 'split-left'; }
    });
    const [ratio, setRatio] = useState(() => {
        try { return Math.round((JSON.parse(localStorage.getItem('layoutSettings') || '{}').ratio || 0.5) * 100); } catch { return 50; }
    });

    // Create Modal State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newEmail, setNewEmail] = useState("");

    const [slotMapping, setSlotMapping] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('multiWindowSlotMapping');
            if (saved) return JSON.parse(saved);
        } catch { }
        return ['default', 'profile2', 'profile3', 'profile4'];
    });

    const handleSlotChange = (idx: number, newProfileId: string) => {
        setSlotMapping(prev => {
            const next = [...prev];
            next[idx] = newProfileId;
            localStorage.setItem('multiWindowSlotMapping', JSON.stringify(next));
            return next;
        });
    };

    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const loadProfiles = async () => {
        try {
            const config = await (window as any).electronAPI?.loadProfiles?.();
            if (config && config.profiles) {
                setProfiles(config.profiles);
            }
        } catch (err) {
            console.error('Failed to load flow profiles:', err);
        }
    };

    // Load profiles when dropdown opens
    useEffect(() => {
        if (open) loadProfiles();
    }, [open]);

    // Apply layout changes
    const applyLayout = (m: string, r: number) => {
        setMode(m);
        setRatio(r);
        localStorage.setItem('layoutSettings', JSON.stringify({ mode: m, ratio: r / 100 }));
        (window as any).electronAPI?.setLayout?.({ mode: m, ratio: r / 100 });
    };

    // --- Profile Management ---
    const handleCreate = async () => {
        if (!newName.trim()) {
            toast({ variant: "destructive", title: "입력 오류", description: "프로필 이름을 입력해주세요." });
            return;
        }
        try {
            const result = await (window as any).electronAPI?.createProfile?.({ name: newName, email: newEmail });
            if (result && result.success) {
                toast({ title: "생성 완료", description: "새로운 Flow 계정이 추가되었습니다." });
                setNewName(""); setNewEmail("");
                setIsCreateOpen(false);
                loadProfiles();
            } else {
                toast({ variant: "destructive", title: "생성 실패", description: result?.error });
            }
        } catch (err: any) {
            toast({ variant: "destructive", title: "생성 에러", description: err.message });
        }
    };

    const handleDelete = async (deleteId: string) => {
        if (!confirm("이 계정을 정말 삭제하시겠습니까? (세션이 영구 파괴됩니다)")) return;
        try {
            const result = await (window as any).electronAPI?.deleteProfile?.({ profileId: deleteId });
            if (result && result.success) {
                toast({ title: "삭제 완료", description: "계정이 삭제되었습니다." });
                loadProfiles();
            } else {
                toast({ variant: "destructive", title: "삭제 실패", description: result?.error });
            }
        } catch (err: any) {
            toast({ variant: "destructive", title: "삭제 에러", description: err.message });
        }
    };

    const handleWindowAction = async (profId: string, isActive: boolean) => {
        if (isActive) {
            // Close window
            await (window as any).electronAPI?.destroyFlowView?.({ profileId: profId });
        } else {
            // Open window
            await (window as any).electronAPI?.createFlowView?.({ profileId: profId });
        }
        syncViewsAndProfiles();
    };

    const handleFocus = async (profId: string) => {
        await (window as any).electronAPI?.focusFlowView?.({ profileId: profId });
        syncViewsAndProfiles();
        setOpen(false);
    };

    const closeAllOthers = async () => {
        if (!confirm("현재 선택된 활성 창 1개를 제외한 나머지 모든 창들을 종료하시겠습니까?")) return;
        for (const viewId of activeViews) {
            if (viewId !== activeProfileId) {
                await (window as any).electronAPI?.destroyFlowView?.({ profileId: viewId });
            }
        }
        syncViewsAndProfiles();
        setOpen(false);
    };

    return (
        <div ref={ref} className="relative inline-flex items-center">
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg bg-card hover:bg-accent text-sm font-semibold transition-all shadow-sm"
            >
                <LayoutGrid className="w-4 h-4 text-primary" />
                <span>다중창 통합 관리</span>
                {activeViews.length > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                        {activeViews.length}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute top-[calc(100%+8px)] right-0 w-[320px] bg-card border border-border rounded-xl shadow-xl z-[9999] p-3 flex flex-col gap-4">
                    
                    {/* 1. Account / Window Grid & List */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                            <span className="text-xs font-bold text-muted-foreground tracking-tight">다중창 제어 (1~4번 격자)</span>
                            <button 
                                onClick={() => setIsCreateOpen(true)}
                                className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" /> 새 계정
                            </button>
                        </div>
                        
                        {/* 4-Grid UI for Legacy 1~4 slots */}
                        <div className="grid grid-cols-2 gap-2">
                            {slotMapping.map((pid, idx) => {
                                const profileObj = profiles.find(p => p.id === pid) || { name: `${idx + 1}번 계정 (미설정)` };
                                const isActive = activeViews.includes(pid);
                                const isFocused = pid === activeProfileId;
                                
                                return (
                                    <button
                                        key={`slot-${idx}`}
                                        onClick={() => handleWindowAction(pid, isActive)}
                                        className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                                            isActive 
                                            ? 'bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                                            : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/80 hover:border-border'
                                        }`}
                                    >
                                        <MonitorPlay className={`w-5 h-5 mb-1 ${isActive ? 'opacity-100' : 'opacity-40'}`} />
                                        <span className="text-[11px] font-bold">{idx + 1}번 창</span>
                                        
                                        <select
                                            value={pid}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => handleSlotChange(idx, e.target.value)}
                                            className="text-[9px] w-full mt-1 bg-transparent border border-transparent hover:border-border rounded px-1 outline-none text-center opacity-80 cursor-pointer"
                                        >
                                            {profiles.map(p => (
                                                <option key={p.id} value={p.id} className="text-foreground bg-background text-left">
                                                    {p.name}
                                                </option>
                                            ))}
                                            {!profiles.find(p => p.id === pid) && (
                                                <option value={pid} className="hidden">{profileObj.name}</option>
                                            )}
                                        </select>
                                        
                                        {isFocused && (
                                            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Extra Profiles List (if any) */}
                        {profiles.filter(p => !slotMapping.includes(p.id)).length > 0 && (
                            <div className="pt-2">
                                <span className="text-[10px] font-semibold text-muted-foreground px-1 mb-1 block">추가 계정 목록</span>
                                <div className="flex flex-col gap-1 max-h-[100px] overflow-y-auto custom-scrollbar">
                                    {profiles.filter(p => !slotMapping.includes(p.id)).map(p => {
                                        const isActive = activeViews.includes(p.id);
                                        const isFocused = p.id === activeProfileId;
                                        return (
                                            <div key={p.id} className="flex items-center justify-between p-1.5 rounded-lg bg-muted/20 border border-transparent hover:border-border group">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <button 
                                                        onClick={() => handleWindowAction(p.id, isActive)}
                                                        className={`p-1 rounded-md transition-colors ${isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                                                    >
                                                        <MonitorPlay className="w-3 h-3" />
                                                    </button>
                                                    <div 
                                                        className={`text-[10px] font-medium truncate cursor-pointer ${isFocused ? 'text-primary font-bold' : 'text-foreground'}`}
                                                        onClick={() => isActive && handleFocus(p.id)}
                                                    >
                                                        {p.name}
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleDelete(p.id)}
                                                    className="p-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. Layout Controls */}
                    <div className="space-y-3 pt-3 border-t border-border">
                        <span className="text-xs font-bold text-muted-foreground tracking-tight">화면 배치</span>
                        <div className="grid grid-cols-2 gap-2">
                            {SPLIT_MODES.map(m => (
                                <button
                                    key={m.value}
                                    onClick={() => applyLayout(m.value, ratio)}
                                    className={`flex items-center gap-2 p-2 rounded-md border text-xs font-medium transition-all ${
                                        mode === m.value 
                                        ? 'bg-primary/10 border-primary text-primary' 
                                        : 'bg-muted border-transparent text-muted-foreground hover:bg-accent'
                                    }`}
                                >
                                    {m.icon} {m.label}
                                </button>
                            ))}
                        </div>
                        
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>Flow 브라우저 비율</span>
                                <span>{ratio}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="20" max="80" 
                                value={ratio} 
                                onChange={(e) => applyLayout(mode, parseInt(e.target.value))}
                                className="w-full accent-primary"
                            />
                        </div>
                    </div>

                    {/* 3. Utility */}
                    {activeViews.length > 1 && (
                        <div className="pt-2 border-t border-border">
                            <button
                                onClick={closeAllOthers}
                                className="w-full p-2 text-[11px] font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center gap-1"
                            >
                                <X className="w-3 h-3" /> 선택 창 제외 모두 닫기
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Create Account Modal */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>새 Flow 계정 추가</DialogTitle>
                        <DialogDescription>
                            독립된 환경(파티션)을 갖는 새 브라우저 계정을 생성합니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <span className="text-sm font-medium">프로필 이름 (식별용)</span>
                            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="예: 서브채널 1" />
                        </div>
                        <div className="space-y-2">
                            <span className="text-sm font-medium">계정 이메일 (선택)</span>
                            <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="예: sub@gmail.com" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>취소</Button>
                        <Button onClick={handleCreate}>추가하기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
