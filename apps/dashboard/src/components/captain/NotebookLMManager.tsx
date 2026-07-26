
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Book, Plus, Trash2, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NotebookLMAccount {
    id: string;
    browser_profile_id: string;
    status: string;
    notebook_count: number;
    last_sync_at: string;
}

const NotebookLMManager: React.FC = () => {
    const [accounts, setAccounts] = useState<NotebookLMAccount[]>([]);
    const [loading, setLoading] = useState(true);
    
    // New Account Dialog States
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/notebooklm-accounts');
            setAccounts(res.data);
        } catch (error) {
            toast.error("NotebookLM 계정 정보를 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("연동을 해제하시겠습니까?")) return;
        try {
            await axios.delete(`/api/notebooklm-accounts/${id}`);
            toast.success("해제 완료");
            fetchAccounts();
        } catch (error) {
            toast.error("오류 발생");
        }
    };

    const handleQuickRegister = async () => {
        if (!newEmail) {
            toast.error("이메일을 입력하세요.");
            return;
        }
        try {
            toast.loading("계정 등록 중...");
            await axios.post('/api/notebooklm-accounts/quick-register', { 
                email: newEmail, 
                password: newPassword 
            });
            toast.dismiss();
            toast.success("리서치 계정이 성공적으로 등록되었습니다.");
            setIsAddDialogOpen(false);
            setNewEmail("");
            setNewPassword("");
            fetchAccounts();
        } catch (error) {
            toast.dismiss();
            toast.error("등록 중 오류가 발생했습니다.");
        }
    };

    const handleLaunch = async (id: string) => {
        try {
            toast.info("🛡️ 보안 브라우저 실행 중...");
            await axios.post(`/api/notebooklm-accounts/${id}/launch`);
            toast.success("🚀 브라우저가 실행되었습니다. 잠시 후 화면이 열립니다.");
            // Open noVNC viewer in a new window
            const host = window.location.hostname;
            window.open(`http://${host}:6080/vnc.html?autoconnect=true&resize=scale`, '_blank');
        } catch (error) {
            toast.error("브라우저 실행 실패: 백엔드 상태를 확인하세요.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Brain className="w-6 h-6 text-purple-500" />
                        NotebookLM 워크스페이스 관리
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        AI 연구 및 대본 확장을 위한 NotebookLM 계정 연동 상태를 관리합니다.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="default" size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        리서치 계정 추가
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchAccounts}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        새로고침
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accounts.map(acc => (
                    <Card key={acc.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3 px-4 pt-4">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <div className="bg-purple-100 p-2 rounded-lg">
                                        <Book className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base truncate w-40">{acc.id}</CardTitle>
                                        <CardDescription className="text-xs">
                                            Status: {acc.status}
                                        </CardDescription>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="text-red-400" onClick={() => handleDelete(acc.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-4">
                            <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center">
                                <span className="text-xs text-slate-500">생성된 노트북</span>
                                <span className="text-sm font-bold text-slate-700">{acc.notebook_count}개</span>
                            </div>
                            <Button variant="default" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-9 shadow-sm" onClick={() => handleLaunch(acc.id)}>
                                <ShieldCheck className="w-4 h-4 mr-2" />
                                보안 접속 (Secure Connect)
                            </Button>
                        </CardContent>
                    </Card>
                ))}

                {accounts.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center text-slate-600 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p>연동된 NotebookLM 계정이 없습니다.</p>
                        <p className="text-xs mt-1">브라우저 프로필에서 수동 로그인 후 등록해주세요.</p>
                    </div>
                )}
            </div>

            {/* Registration Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-width-[425px]">
                    <DialogHeader>
                        <DialogTitle>리서치 계정 추가</DialogTitle>
                        <DialogDescription>
                            NotebookLM 자동화를 위한 구글 계정 정보를 입력하세요. 
                            입력된 정보는 격리된 브라우저 프로필에 안전하게 저장됩니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">구글 이메일</Label>
                            <Input 
                                id="email" 
                                placeholder="example@gmail.com" 
                                value={newEmail} 
                                onChange={(e) => setNewEmail(e.target.value)} 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">비밀번호 (자동 로그인용)</Label>
                            <Input 
                                id="password" 
                                type="password" 
                                placeholder="••••••••" 
                                value={newPassword} 
                                onChange={(e) => setNewPassword(e.target.value)} 
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>취소</Button>
                        <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleQuickRegister}>계정 등록</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default NotebookLMManager;
