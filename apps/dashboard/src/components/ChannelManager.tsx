import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { Channel, Category, Settings } from '../lib/api';
import { Plus, Trash2, RefreshCw, Pause, Play, FolderPlus, X, AlertTriangle } from 'lucide-react';
import { cn, getMediaUrl } from '../lib/utils';

const ChannelManager = () => {
    const queryClient = useQueryClient();
    const [newUrl, setNewUrl] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [showCategoryInput, setShowCategoryInput] = useState(false);
    const [selectedChannels, setSelectedChannels] = useState<Set<number>>(new Set());
    const [isScriptOnly, setIsScriptOnly] = useState(false); // [NEW]
    const [editingChannelId, setEditingChannelId] = useState<number | null>(null);

    // [NEW] Restore missing queries
    const { data: channels, isLoading } = useQuery({
        queryKey: ['channels'],
        queryFn: async () => { const d = (await api.get<Channel[]>('/channels/')).data; return Array.isArray(d) ? d : []; }
    });

    const { data: categories } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => { const d = (await api.get<Category[]>('/categories/')).data; return Array.isArray(d) ? d : []; }
    });

    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => (await api.get<Settings>('/settings/')).data
    });

    // Removed getFileUrl in favor of getMediaUrl utility

    const addCategoryMutation = useMutation({
        mutationFn: (name: string) => api.post('/categories/', { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setNewCategoryName('');
            setShowCategoryInput(false);
        },
        onError: (error: any) => {
            alert(error.response?.data?.detail || '카테고리 추가에 실패했습니다.');
        }
    });

    const deleteCategoryMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/categories/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            queryClient.invalidateQueries({ queryKey: ['channels'] });
        }
    });

    const addMutation = useMutation({
        mutationFn: (data: { url: string, category_id: number | null }) =>
            api.post('/channels/', {
                url: data.url,
                platform: 'unknown',
                name: 'New Channel',
                folder_name: 'new_channel',
                category_id: data.category_id,
                default_script_only: isScriptOnly // [NEW]
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['channels'] });
            setNewUrl('');
            setIsScriptOnly(false); // Reset
            setIsAdding(false);
        },
        onError: (error: any) => {
            console.error("Channel Add Error:", error);
            let message = "알 수 없는 오류가 발생했습니다.";

            if (error.response) {
                message = `서버 오류 (${error.response.status}): ${JSON.stringify(error.response.data)}`;
            } else if (error.request) {
                message = "서버 응답이 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.";
            } else {
                message = `요청 설정 오류: ${error.message}`;
            }

            alert(message);
            setIsAdding(false);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/channels/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['channels'] }),
        onError: (error: any) => {
            alert('채널 삭제 실패: ' + (error.response?.data?.detail || error.message || '서버 응답 없음'));
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number, data: any }) => api.patch(`/channels/${id}`, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['channels'] })
    });

    const scanMutation = useMutation({
        mutationFn: (id: number) => api.post(`/channels/${id}/scan`),
        onSuccess: (res) => {
            const data = res.data;
            if (data.status === 'success') {
                alert(`스캔 완료: ${data.found}개의 신규 영상을 찾았습니다.\n(${data.downloaded}개 다운로드 시작)`);
                queryClient.invalidateQueries({ queryKey: ['channels'] });
            } else {
                alert(`스캔 실패: ${data.error || '알 수 없는 오류'}`);
            }
        },
        onError: (error: any) => {
            alert('요청 중 오류가 발생했습니다: ' + (error.response?.data?.detail || error.message));
        }
    });


    const handleBatchDelete = async () => {
        if (selectedChannels.size === 0) return;
        if (!window.confirm(`선택한 ${selectedChannels.size}개의 채널과 관련된 모든 영상을 삭제하시겠습니까?`)) return;
        
        try {
            await api.post('/channels/batch-delete', { channel_ids: Array.from(selectedChannels) });
            queryClient.invalidateQueries({ queryKey: ['channels'] });
            setSelectedChannels(new Set());
            // Need toast if possible, otherwise alert is fine. alert is used in this file mostly.
            alert('선택한 채널이 일괄 삭제되었습니다.');
        } catch (error) {
            alert('채널 일괄 삭제 중 오류가 발생했습니다.');
        }
    };

    const toggleChannel = (id: number) => {
        const newSet = new Set(selectedChannels);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedChannels(newSet);
    };

    const toggleAllChannels = () => {
        if (channels && selectedChannels.size === channels.length) {
            setSelectedChannels(new Set());
        } else if (channels) {
            setSelectedChannels(new Set(channels.map(c => c.id)));
        }
    };

    const handleAddCategory = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;
        addCategoryMutation.mutate(newCategoryName);
    };

    const handleDeleteCategory = (id: number, name: string) => {
        if (confirm(`"${name}" 카테고리를 삭제하시겠습니까?\n\n⚠️ 이 카테고리에 속한 모든 채널과 영상이 함께 삭제됩니다.`)) {
            deleteCategoryMutation.mutate(id);
        }
    };

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUrl) return;
        setIsAdding(true);
        addMutation.mutate({ url: newUrl, category_id: selectedCategoryId });
    };

    const getPlatformDisplay = (platform: string) => {
        const lower = platform.toLowerCase().replace('tab', '').trim();
        if (lower === 'youtube') return '유튜브';
        if (lower === 'douyin') return '도우인';
        if (lower === 'tiktok') return '틱톡';
        if (lower === 'instagram') return '인스타그램';
        return platform;
    };

    return (
        <div className="space-y-8">


            {/* Category Management */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Plus className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Category Management</span>
                    </div>
                    <button
                        onClick={() => setShowCategoryInput(!showCategoryInput)}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                    >
                        <FolderPlus className="w-4 h-4 mr-2" />
                        새 카테고리
                    </button>
                </div>

                {showCategoryInput && (
                    <form onSubmit={handleAddCategory} className="flex gap-2">
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="카테고리 이름 (예: 영화, 음악)"
                            className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                        <button type="submit" className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4">
                            추가
                        </button>
                        <button type="button" onClick={() => setShowCategoryInput(false)} className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-10 px-3">
                            <X className="w-4 h-4" />
                        </button>
                    </form>
                )}

                {categories && categories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {categories.map((category) => (
                            <div key={category.id} className="inline-flex items-center gap-1 rounded-full border bg-accent px-3 py-1">
                                <span className="text-sm font-medium">{category.name}</span>
                                <button
                                    onClick={() => handleDeleteCategory(category.id, category.name)}
                                    className="ml-1 rounded-full hover:bg-destructive/10 p-1"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Channel */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <form onSubmit={handleAdd} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">카테고리 (선택사항)</label>
                        <select
                            value={selectedCategoryId || ''}
                            onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <option value="">카테고리 없음</option>
                            {categories?.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium">새 채널 URL</label>
                            <input
                                type="text"
                                value={newUrl}
                                onChange={(e) => setNewUrl(e.target.value)}
                                placeholder="https://www.youtube.com/@channel"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                        <div className="flex items-center space-x-2 pb-2">
                            <input
                                id="scriptOnly"
                                type="checkbox"
                                checked={isScriptOnly}
                                onChange={(e) => setIsScriptOnly(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label htmlFor="scriptOnly" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                스크립트 모드 (영상 미다운로드)
                            </label>
                        </div>
                        <button
                            type="submit"
                            disabled={isAdding}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                        >
                            {isAdding ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            채널 추가
                        </button>
                    </div>
                </form>
            </div>

            {/* Channel List */}
            <div className="flex justify-end mb-2">
                {selectedChannels.size > 0 && (
                    <button
                        onClick={handleBatchDelete}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 px-4 py-2"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        선택 삭제 ({selectedChannels.size})
                    </button>
                )}
            </div>
            <div className="rounded-md border border-border bg-card">
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-12">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={channels?.length > 0 && selectedChannels.size === channels?.length}
                                        onChange={toggleAllChannels}
                                    />
                                </th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground min-w-[120px] whitespace-nowrap">카테고리</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">플랫폼</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">이름</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">URL</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">상태</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">자동 다운로드</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">스크립트 모드</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground whitespace-nowrap">작업</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {isLoading ? (
                                <tr><td colSpan={8} className="p-4 text-center">로딩 중...</td></tr>
                            ) : channels?.map((channel) => (
                                <tr key={channel.id} className="border-b transition-colors hover:bg-muted/50">
                                    <td className="p-4 align-middle">
                                        <input 
                                            type="checkbox"
                                            className="rounded border-gray-300 text-primary focus:ring-primary"
                                            checked={selectedChannels.has(channel.id)}
                                            onChange={() => toggleChannel(channel.id)}
                                        />
                                    </td>
                                    <td className="p-4 align-middle whitespace-nowrap">
                                        <span className={cn(
                                            "inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
                                            (categories?.find(c => c.id === channel.category_id)?.name.length || 0) > 8 ? "text-[10px]" : "text-xs"
                                        )}>
                                            {categories?.find(c => c.id === channel.category_id)?.name || '없음'}
                                        </span>
                                    </td>
                                    <td className="p-4 align-middle font-medium">{getPlatformDisplay(channel.platform)}</td>
                                    <td className="p-4 align-middle">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0 overflow-hidden relative">
                                                <span className="absolute inset-0 flex items-center justify-center">
                                                    {channel.name[0]}
                                                </span>
                                                {channel.thumbnail_path && (
                                                    <img
                                                        src={getMediaUrl(channel.thumbnail_path, settings?.root_download_path)}
                                                        alt={channel.name}
                                                        className="w-full h-full object-cover relative z-10"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                )}
                                            </div>
                                            <span>{channel.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 align-middle text-muted-foreground truncate max-w-[150px]">
                                        {editingChannelId === channel.id ? (
                                            <input
                                                type="text"
                                                defaultValue={channel.url}
                                                onBlur={(e) => {
                                                    const updatedUrl = e.target.value.trim();
                                                    if (updatedUrl && updatedUrl !== channel.url) {
                                                        updateMutation.mutate({ id: channel.id, data: { url: updatedUrl } });
                                                    }
                                                    setEditingChannelId(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const updatedUrl = (e.target as HTMLInputElement).value.trim();
                                                        if (updatedUrl && updatedUrl !== channel.url) {
                                                            updateMutation.mutate({ id: channel.id, data: { url: updatedUrl } });
                                                        }
                                                        setEditingChannelId(null);
                                                    } else if (e.key === 'Escape') {
                                                        setEditingChannelId(null);
                                                    }
                                                }}
                                                autoFocus
                                                className="w-full px-2 py-1 text-sm border rounded bg-background"
                                            />
                                        ) : (
                                            <a
                                                href={channel.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:underline hover:text-primary transition-colors"
                                                title="더블클릭하여 수정 가능"
                                                onDoubleClick={() => setEditingChannelId(channel.id)}
                                            >
                                                {channel.url}
                                            </a>
                                        )}
                                    </td>
                                    <td className="p-4 align-middle">
                                        <span className={cn(
                                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                            channel.status === 'active' ? "border-transparent bg-emerald-500/10 text-emerald-500" : "border-transparent bg-muted text-muted-foreground"
                                        )}>
                                            {channel.status === 'active' ? '활성' : '일시정지'}
                                        </span>
                                    </td>
                                    <td className="p-4 align-middle">
                                        <button
                                            onClick={() => updateMutation.mutate({ id: channel.id, data: { auto_download: !channel.auto_download } })}
                                            className={cn(
                                                "w-10 h-6 rounded-full transition-colors relative",
                                                channel.auto_download ? "bg-primary" : "bg-input"
                                            )}
                                        >
                                            <span className={cn(
                                                "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
                                                channel.auto_download ? "translate-x-4" : "translate-x-0"
                                            )} />
                                        </button>
                                    </td>
                                    <td className="p-4 align-middle">
                                        <button
                                            onClick={() => updateMutation.mutate({ id: channel.id, data: { default_script_only: !channel.default_script_only } })}
                                            className={cn(
                                                "w-10 h-6 rounded-full transition-colors relative",
                                                channel.default_script_only ? "bg-primary" : "bg-input"
                                            )}
                                            title="스크립트 전용 모드 (영상 다운로드 건너뛰기)"
                                        >
                                            <span className={cn(
                                                "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform",
                                                channel.default_script_only ? "translate-x-4" : "translate-x-0"
                                            )} />
                                        </button>
                                    </td>
                                    <td className="p-4 align-middle text-right">
                                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                            <button
                                                onClick={() => setEditingChannelId(channel.id)}
                                                title="URL 수정"
                                                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9 shrink-0"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                                            </button>
                                            <button
                                                onClick={() => scanMutation.mutate(channel.id)}
                                                disabled={scanMutation.isPending}
                                                title="즉시 스캔"
                                                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9 shrink-0"
                                            >
                                                <RefreshCw className={cn("w-4 h-4", scanMutation.isPending && "animate-spin")} />
                                            </button>
                                            <button
                                                onClick={() => updateMutation.mutate({ id: channel.id, data: { status: channel.status === 'active' ? 'paused' : 'active' } })}
                                                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9 shrink-0"
                                            >
                                                {channel.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => { if (confirm('정말 삭제하시겠습니까?')) deleteMutation.mutate(channel.id); }}
                                                disabled={deleteMutation.isPending}
                                                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-destructive hover:text-destructive-foreground h-9 w-9 shrink-0"
                                            >
                                                <Trash2 className={cn("w-4 h-4", deleteMutation.isPending && "animate-pulse")} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ChannelManager;