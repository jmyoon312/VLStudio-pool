import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Mail, Bot, Fingerprint, ShieldCheck, Pencil } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

const FlowAccountsManager = () => {
    const { toast } = useToast();
    const [profiles, setProfiles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newEmail, setNewEmail] = useState("");

    const [deleteId, setDeleteId] = useState<string | null>(null);

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");

    const handleOpenEdit = (profile: any) => {
        setEditId(profile.id);
        setEditName(profile.name);
        setEditEmail(profile.email || "");
        setIsEditOpen(true);
    };

    const handleUpdate = async () => {
        if (!editId) return;
        if (!editName.trim()) {
            toast({ variant: "destructive", title: "입력 오류", description: "프로필 이름을 입력해주세요." });
            return;
        }

        try {
            const result = await (window as any).electronAPI?.updateProfile?.({
                profileId: editId,
                name: editName,
                email: editEmail
            });

            if (result && result.success) {
                toast({ title: "수정 완료", description: "Flow 계정 프로필이 수정되었습니다." });
                setIsEditOpen(false);
                loadProfiles();
            } else {
                toast({ variant: "destructive", title: "수정 실패", description: result?.error || "알 수 없는 오류가 발생했습니다." });
            }
        } catch (err: any) {
            toast({ variant: "destructive", title: "수정 에러", description: err.message });
        }
    };

    const loadProfiles = async () => {
        setIsLoading(true);
        try {
            const config = await (window as any).electronAPI?.loadProfiles?.();
            if (config && config.profiles) {
                setProfiles(config.profiles);
            }
        } catch (err) {
            console.error('Failed to load flow profiles:', err);
            toast({ variant: "destructive", title: "로딩 실패", description: "Flow 프로필을 불러오지 못했습니다." });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadProfiles();
    }, []);

    const handleCreate = async () => {
        if (!newName.trim()) {
            toast({ variant: "destructive", title: "입력 오류", description: "프로필 이름을 입력해주세요." });
            return;
        }

        try {
            const result = await (window as any).electronAPI?.createProfile?.({
                name: newName,
                email: newEmail
            });

            if (result && result.success) {
                toast({ title: "생성 완료", description: "새로운 Flow 계정 프로필이 생성되었습니다." });
                setNewName("");
                setNewEmail("");
                setIsCreateOpen(false);
                loadProfiles();
            } else {
                toast({ variant: "destructive", title: "생성 실패", description: result?.error || "알 수 없는 오류가 발생했습니다." });
            }
        } catch (err: any) {
            toast({ variant: "destructive", title: "생성 에러", description: err.message });
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            const result = await (window as any).electronAPI?.deleteProfile?.({ profileId: deleteId });
            if (result && result.success) {
                toast({ title: "삭제 완료", description: "프로필이 영구적으로 삭제되었습니다." });
                setDeleteId(null);
                loadProfiles();
            } else {
                toast({ variant: "destructive", title: "삭제 실패", description: result?.error || "알 수 없는 오류가 발생했습니다." });
            }
        } catch (err: any) {
            toast({ variant: "destructive", title: "삭제 에러", description: err.message });
        }
    };

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Bot className="w-6 h-6 text-blue-600" />
                            Google Flow 계정 관리 (Flow AI)
                        </CardTitle>
                        <CardDescription>
                            편집기 연동 자동화 메뉴에서 사용할 유료/독립 Flow 계정 프로필을 관리합니다.
                        </CardDescription>
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" /> 새 계정 추가
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[150px]">프로필 명</TableHead>
                                <TableHead>연동 이메일</TableHead>
                                <TableHead>하드웨어 지문 (Anti-Bot)</TableHead>
                                <TableHead className="text-right">상태</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-8">로딩 중...</TableCell></TableRow>
                            ) : profiles.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">등록된 Flow 계정이 없습니다.</TableCell></TableRow>
                            ) : (
                                profiles.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium text-foreground">
                                            {p.name}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Mail className="w-4 h-4 text-slate-400" />
                                                {p.email || <span className="text-slate-400 italic">미입력</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                                    <Fingerprint className="w-3 h-3" />
                                                    {p.hardware?.renderer || '기본 하드웨어'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-blue-50 text-blue-600">
                                                <ShieldCheck className="w-3 h-3" />
                                                파티션 격리됨
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-blue-600"
                                                    onClick={() => handleOpenEdit(p)}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                {p.id !== 'default' && (
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-red-600"
                                                        onClick={() => setDeleteId(p.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>새 Flow 계정 프로필 추가</DialogTitle>
                        <DialogDescription>
                            Flow 전용 파티션 프로필을 생성합니다. 안티봇 우회를 위한 하드웨어 지문이 자동 할당됩니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>프로필 이름 (식별용)</Label>
                            <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="예: Flow 유료계정 1"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>계정 이메일 (선택)</Label>
                            <Input
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="예: flow_paid@gmail.com"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>취소</Button>
                        <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">추가하기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Flow 계정 프로필 수정</DialogTitle>
                        <DialogDescription>
                            Flow 프로필의 이름 및 연동 이메일을 수정합니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>프로필 이름 (식별용)</Label>
                            <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="예: Flow 유료계정 1"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>계정 이메일</Label>
                            <Input
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                placeholder="예: flow_paid@gmail.com"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>취소</Button>
                        <Button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700">저장하기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Alert */}
            <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600">프로필을 삭제하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                            이 프로필에 저장된 Flow 로그인 세션 및 쿠키 정보가 영구적으로 파괴됩니다. 복구할 수 없습니다.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">삭제 확인</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default FlowAccountsManager;
