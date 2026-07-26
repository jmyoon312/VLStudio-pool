
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
    DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
    Globe, Plus, Trash2, ExternalLink, RefreshCw,
    Camera, Music2, Brain, Link
} from 'lucide-react';
import { toast } from 'sonner';
interface BrowserProfile {
    id: string;
    name: string;
    user_data_dir: string;
    created_at: string;
    tiktok_count: number;
    insta_count: number;
    notebooklm_count: number;
}

interface SocialAccountsManagerProps {
    profileId?: string; // Optional context if needed
}

const SocialAccountsManager: React.FC<SocialAccountsManagerProps> = () => {
    const [profiles, setProfiles] = useState<BrowserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newProfileName, setNewProfileName] = useState("");
    
    // YouTube Sync Modal State
    const [isSyncOpen, setIsSyncOpen] = useState(false);
    const [syncChannelId, setSyncChannelId] = useState("");
    const [youtubeChannels, setYoutubeChannels] = useState<{channel_id: string, channel_name: string}[]>([]);

    // NotebookLM Modal State
    const [isNotebookLMOpen, setIsNotebookLMOpen] = useState(false);
    const [notebookLMEmail, setNotebookLMEmail] = useState("");
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

    const fetchProfiles = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/browser-profiles');
            setProfiles(res.data);
        } catch (error) {
            console.error("Failed to fetch profiles:", error);
            toast.error("프로필 목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    useEffect(() => {
        if (isSyncOpen && youtubeChannels.length === 0) {
            axios.get('/api/youtube/all')
                .then(res => setYoutubeChannels(res.data))
                .catch(err => console.error("Failed to load YouTube channels:", err));
        }
    }, [isSyncOpen]);

    const handleCreateProfile = async () => {
        if (!newProfileName.trim()) return;
        try {
            await axios.post('/api/browser-profiles', { name: newProfileName });
            toast.success("브라우저 프로필이 생성되었습니다.");
            setNewProfileName("");
            setIsAddOpen(false);
            fetchProfiles();
        } catch (error) {
            toast.error("프로필 생성 실패");
        }
    };

    const handleDeleteProfile = async (id: string) => {
        if (!confirm("정말 삭제하시겠습니까? 연결된 소셜 계정 정보도 함께 삭제됩니다.")) return;
        try {
            await axios.delete(`/api/browser-profiles/${id}`);
            toast.success("프로필이 삭제되었습니다.");
            fetchProfiles();
        } catch (error) {
            toast.error("삭제 실패");
        }
    };
    const handleLaunchProfile = async (id: string, name: string) => {
        try {
            await axios.post(`/api/browser-profiles/${id}/launch`);
            toast.success(`${name} 브라우저를 실행했습니다.`);
        } catch (error) {
            console.error("Failed to launch profile:", error);
            toast.error("브라우저 실행 실패: 백인드 서버 연결을 확인하세요.");
        }
    };
    const handleOpenNotebookLMModal = (profileId: string) => {
        setSelectedProfileId(profileId);
        setNotebookLMEmail("");
        setIsNotebookLMOpen(true);
    };

    const handleLinkIntelligence = async () => {
        if (!selectedProfileId || !notebookLMEmail.trim()) return;
        try {
            await axios.post('/api/notebooklm-accounts', { id: notebookLMEmail, browser_profile_id: selectedProfileId });
            toast.success("NotebookLM 계정이 연동되었습니다.");
            setIsNotebookLMOpen(false);
            fetchProfiles();
        } catch (error) {
            toast.error("연동 실패: 이미 등록된 계정이거나 통신 오류입니다.");
        }
    };

    const handleSyncYouTubeChannel = async () => {
        if (!syncChannelId.trim()) return;
        if (!syncChannelId.startsWith('UC') || syncChannelId.length !== 24) {
            toast.error("유효한 유튜브 채널 ID(UC...)를 입력해주세요.");
            return;
        }
        
        try {
            await axios.post('/api/browser-profiles/sync-youtube', { youtube_channel_id: syncChannelId });
            toast.success("유튜브 채널이 프로필로 연동되었습니다.");
            setIsSyncOpen(false);
            setSyncChannelId("");
            fetchProfiles();
        } catch (error: any) {
            if (error.response?.status === 404) {
                toast.error("등록되지 않은 유튜브 채널 ID입니다. (먼저 채널을 위임/등록하세요)");
            } else {
                toast.error("연동 실패: 서버 오류가 발생했습니다.");
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Globe className="w-6 h-6 text-blue-500" />
                        소셜 미디어 계정 관리 (Browser Profiles)
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        틱톡, 인스타그램 등 다중 계정을 위한 브라우저 프로필을 관리합니다.<br />
                        <span className="text-amber-600 font-semibold text-xs border border-amber-200 bg-amber-50 px-2 py-0.5 rounded ml-1">
                            권장: 유튜브 브랜드 채널과 연동하여 동일한 브라우저 환경을 유지하세요.
                        </span>
                    </p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <Plus className="w-4 h-4 mr-2" />
                                빈 프로필 생성
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>새 빈 브라우저 프로필 생성</DialogTitle>
                                <DialogDescription>
                                    예: "게임 채널용", "일상 브랜드용" 등 용도에 맞는 이름을 입력하세요.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Input
                                    placeholder="프로필 이름 입력..."
                                    value={newProfileName}
                                    onChange={(e) => setNewProfileName(e.target.value)}
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddOpen(false)}>취소</Button>
                                <Button onClick={handleCreateProfile}>생성</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isSyncOpen} onOpenChange={setIsSyncOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-red-600 hover:bg-red-700 text-white shadow-sm">
                                <Link className="w-4 h-4 mr-2" />
                                유튜브 채널 연동
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>유튜브 채널과 프로필 연동</DialogTitle>
                                <DialogDescription>
                                    유튜브 채널과 동일한 브라우저 쿠키를 사용하도록 연동합니다.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Select value={syncChannelId} onValueChange={setSyncChannelId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="연동할 유튜브 채널을 선택하세요" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {youtubeChannels.map((ch) => (
                                            <SelectItem key={ch.channel_id} value={ch.channel_id}>
                                                {ch.channel_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsSyncOpen(false)}>취소</Button>
                                <Button onClick={handleSyncYouTubeChannel} className="bg-red-600 hover:bg-red-700 text-white">연동하기</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isNotebookLMOpen} onOpenChange={setIsNotebookLMOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>NotebookLM 연동</DialogTitle>
                                <DialogDescription>
                                    연동할 NotebookLM 계정의 이메일 주소를 입력하세요.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Input
                                    placeholder="example@gmail.com"
                                    value={notebookLMEmail}
                                    onChange={(e) => setNotebookLMEmail(e.target.value)}
                                    type="email"
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsNotebookLMOpen(false)}>취소</Button>
                                <Button onClick={handleLinkIntelligence}>연동하기</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {profiles.map(profile => (
                    <Card key={profile.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg">{profile.name}</CardTitle>
                                    <CardDescription className="text-xs truncate" title={profile.id}>
                                        ID: {profile.id.substring(0, 8)}...
                                    </CardDescription>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 -mt-2 -mr-2"
                                    onClick={() => handleDeleteProfile(profile.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Launch Button */}
                            <Button
                                variant="outline"
                                className="w-full justify-between"
                                onClick={() => handleLaunchProfile(profile.id, profile.name)}
                            >
                                <span className="flex items-center gap-2">
                                    <ExternalLink className="w-4 h-4" />
                                    브라우저 열기 (로그인)
                                </span>
                            </Button>

                            {/* Linked Accounts Preview */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div className="flex justify-between items-center">
                                    <p className="text-xs font-semibold text-slate-500">연결된 계정 상태</p>
                                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-indigo-500 hover:text-indigo-700" onClick={() => handleOpenNotebookLMModal(profile.id)}>
                                        <Plus className="w-3 h-3 mr-1" /> 연동 추가
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant={profile.tiktok_count > 0 ? "default" : "secondary"} className={`text-[10px] ${profile.tiktok_count > 0 ? 'bg-black' : 'bg-slate-100 text-slate-600'}`}>
                                        <Music2 className="w-3 h-3 mr-1" />
                                        Music {profile.tiktok_count > 0 ? `(${profile.tiktok_count})` : '미연결'}
                                    </Badge>
                                    <Badge variant={profile.insta_count > 0 ? "default" : "secondary"} className={`text-[10px] ${profile.insta_count > 0 ? 'bg-pink-500' : 'bg-slate-100 text-slate-600'}`}>
                                        <Camera className="w-3 h-3 mr-1" />
                                        Camera {profile.insta_count > 0 ? `(${profile.insta_count})` : '미연결'}
                                    </Badge>
                                    <Badge variant={profile.notebooklm_count > 0 ? "default" : "secondary"} className={`text-[10px] ${profile.notebooklm_count > 0 ? 'bg-purple-600' : 'bg-slate-100 text-slate-600'}`}>
                                        <Brain className="w-3 h-3 mr-1" />
                                        NotebookLM {profile.notebooklm_count > 0 ? `(${profile.notebooklm_count})` : '미연결'}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {profiles.length === 0 && !loading && (
                    <div className="col-span-full py-12 text-center text-slate-600 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <Globe className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>생성된 브라우저 프로필이 없습니다.</p>
                        <Button variant="link" onClick={() => setIsAddOpen(true)}>
                            첫 프로필 생성하기
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SocialAccountsManager;
