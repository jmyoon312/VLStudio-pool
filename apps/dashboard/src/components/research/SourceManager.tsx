import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Link2, Loader2, Plus, Trash2, PlaySquare, Eye, ThumbsUp, ExternalLink,
    Image as ImageIcon, Search, Download, ShieldCheck, Video,
} from 'lucide-react';

interface ReferenceVideo {
    id: number;
    url: string;
    platform: string;
    channel_name: string;
    channel_url: string;
    title: string;
    view_count: number;
    like_count: number;
    duration: number;
    thumbnail_url: string;
    niche: string;
    viral_score: number;
    status: string;
}

interface StockResult {
    provider: string;
    source_url: string;
    preview_url?: string;
    download_url?: string;
    license: string;
    attribution: string;
    query: string;
    duration?: number;
    width?: number;
    height?: number;
}

const fmtNum = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
};

const SourceManager: React.FC<{ presetQuery?: string }> = ({ presetQuery }) => {
    const qc = useQueryClient();
    const [url, setUrl] = useState('');
    const [niche, setNiche] = useState('');
    const [stockQuery, setStockQuery] = useState(presetQuery || '');
    const [provider, setProvider] = useState<'pexels' | 'pixabay'>('pexels');
    const [stockResults, setStockResults] = useState<StockResult[]>([]);

    React.useEffect(() => {
        if (presetQuery) setStockQuery(presetQuery);
    }, [presetQuery]);

    const { data: videos = [], isLoading } = useQuery<ReferenceVideo[]>({
        queryKey: ['reference-videos'],
        queryFn: async () => (await api.get('/research/reference-videos')).data,
        refetchInterval: 60000,
    });

    const addVideo = useMutation({
        mutationFn: async () => (await api.post('/research/reference-videos', { url, niche: niche || undefined }, { timeout: 60000 })).data,
        onSuccess: (d: any) => {
            toast.success(`레퍼런스 추가: ${d.channel_name || d.title}`);
            setUrl('');
            qc.invalidateQueries({ queryKey: ['reference-videos'] });
        },
        onError: (e: any) => toast.error('수집 실패: ' + (e.response?.data?.detail || e.message)),
    });

    const delVideo = useMutation({
        mutationFn: async (id: number) => (await api.delete(`/research/reference-videos/${id}`)).data,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['reference-videos'] }),
    });

    const searchStock = useMutation({
        mutationFn: async () => (await api.post('/research/source-assets/search', { query: stockQuery, provider })).data,
        onSuccess: (d: any) => {
            setStockResults(d.results || []);
            if (!d.results?.length) toast.info('결과 없음 (API 키 확인 또는 다른 검색어 시도)');
        },
        onError: (e: any) => toast.error('검색 실패: ' + (e.response?.data?.detail || e.message)),
    });

    const saveAsset = useMutation({
        mutationFn: async (r: StockResult) => (await api.post('/research/source-assets', {
            provider: r.provider, source_url: r.source_url, preview_url: r.preview_url,
            media_type: 'video', license: r.license, attribution: r.attribution,
            query: r.query, width: r.width, height: r.height, duration: r.duration,
        })).data,
        onSuccess: () => toast.success('에셋 저장됨 (라이선스 기록 포함)'),
        onError: (e: any) => toast.error('저장 실패: ' + (e.response?.data?.detail || e.message)),
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Reference videos */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <PlaySquare className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-semibold text-slate-700">레퍼런스 영상</span>
                    <Badge variant="outline" className="text-[10px]">{videos.length}</Badge>
                </div>
                <Card>
                    <CardContent className="p-3 space-y-2">
                        <div className="flex gap-2">
                            <Input
                                placeholder="영상 링크 (YouTube/Reddit/Music)..."
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="text-xs"
                                onKeyDown={(e) => { if (e.key === 'Enter' && url.trim()) addVideo.mutate(); }}
                            />
                            <Input
                                placeholder="니치"
                                value={niche}
                                onChange={(e) => setNiche(e.target.value)}
                                className="text-xs w-24"
                            />
                            <Button size="sm" className="h-9" disabled={!url.trim() || addVideo.isPending} onClick={() => addVideo.mutate()}>
                                {addVideo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            </Button>
                        </div>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> 링크·메타데이터·자막만 수집 (원본 미디어 재배포 안 함)
                        </p>
                    </CardContent>
                </Card>

                {isLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                ) : (
                    <ScrollArea className="h-[calc(100vh-360px)]">
                        <div className="space-y-2 pr-2">
                            {videos.map((v) => (
                                <Card key={v.id} className="border-slate-200">
                                    <CardContent className="p-2.5 flex gap-2">
                                        {v.thumbnail_url
                                            ? <img src={v.thumbnail_url} alt="" className="w-20 h-14 object-cover rounded flex-shrink-0" />
                                            : <div className="w-20 h-14 rounded bg-slate-100 flex items-center justify-center flex-shrink-0"><Video className="w-5 h-5 text-slate-300" /></div>}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-slate-700 line-clamp-1">{v.title || v.url}</p>
                                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                                                <span className="truncate max-w-[100px]">{v.channel_name}</span>
                                                <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{fmtNum(v.view_count)}</span>
                                                <span className="flex items-center gap-0.5"><ThumbsUp className="w-3 h-3" />{fmtNum(v.like_count)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="info" className="text-[8px]">바이럴 {v.viral_score.toFixed(0)}</Badge>
                                                {v.niche && <Badge variant="secondary" className="text-[8px]">{v.niche}</Badge>}
                                                <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-blue-400"><ExternalLink className="w-3 h-3" /></a>
                                                {v.channel_url && <a href={v.channel_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-slate-400 hover:underline">채널</a>}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-300 flex-shrink-0" onClick={() => delVideo.mutate(v.id)}>
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                            {videos.length === 0 && (
                                <div className="text-center py-10 text-slate-400 text-xs">
                                    <Link2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                    터진 영상 링크를 등록하면 채널·조회수·포맷을 분석합니다
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* Legal stock search */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-slate-700">합법 소스 검색</span>
                    <Badge variant="success" className="text-[9px]">Pexels / Pixabay</Badge>
                </div>
                <Card>
                    <CardContent className="p-3 space-y-2">
                        <div className="flex gap-2">
                            <div className="flex rounded-md border overflow-hidden flex-shrink-0">
                                {(['pexels', 'pixabay'] as const).map((p) => (
                                    <button key={p}
                                        className={`px-2 text-[10px] ${provider === p ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}
                                        onClick={() => setProvider(p)}>
                                        {p}
                                    </button>
                                ))}
                            </div>
                            <Input
                                placeholder="영문 검색어 (예: blacksmith forge)..."
                                value={stockQuery}
                                onChange={(e) => setStockQuery(e.target.value)}
                                className="text-xs"
                                onKeyDown={(e) => { if (e.key === 'Enter' && stockQuery.trim()) searchStock.mutate(); }}
                            />
                            <Button size="sm" className="h-9" disabled={!stockQuery.trim() || searchStock.isPending} onClick={() => searchStock.mutate()}>
                                {searchStock.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <ScrollArea className="h-[calc(100vh-360px)]">
                    <div className="grid grid-cols-2 gap-2 pr-2">
                        {stockResults.map((r, i) => (
                            <Card key={i} className="border-emerald-100 overflow-hidden">
                                {r.preview_url
                                    ? <img src={r.preview_url} alt="" className="w-full h-24 object-cover" />
                                    : <div className="w-full h-24 bg-slate-100 flex items-center justify-center"><Video className="w-6 h-6 text-slate-300" /></div>}
                                <CardContent className="p-2 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <Badge variant="success" className="text-[8px]">{r.license}</Badge>
                                        <span className="text-[9px] text-slate-400">{r.width}×{r.height}</span>
                                    </div>
                                    <p className="text-[9px] text-slate-500 truncate">© {r.attribution || 'unknown'}</p>
                                    <div className="flex gap-1">
                                        <a href={r.source_url} target="_blank" rel="noopener noreferrer"
                                            className="flex-1 text-[9px] text-center border rounded py-0.5 text-blue-500 hover:bg-blue-50">
                                            미리보기
                                        </a>
                                        <Button size="sm" className="h-6 text-[9px] px-2 flex-1" onClick={() => saveAsset.mutate(r)}>
                                            <Download className="w-3 h-3 mr-0.5" /> 저장
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {stockResults.length === 0 && (
                            <div className="col-span-2 text-center py-10 text-slate-400 text-xs">
                                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                포맷 카드의 검색어로 합법 B-roll을 찾아 제작에 사용하세요
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
};

export default SourceManager;
