import React, { useState, useEffect } from 'react';
import { Search, Video, Music, Sticker, Download, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEditorStore, TrackType } from '../hooks/useEditorStore';
import axios from 'axios';

interface Asset {
    id: string;
    type: 'video' | 'image' | 'audio';
    url: string;
    thumbnail: string;
    title: string;
    duration?: number;
    provider: string;
}

const AssetBrowser = () => {
    const { addClip, tracks } = useEditorStore();
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState('video');
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(false);

    const searchAssets = async (q: string, type: string) => {
        setLoading(true);
        try {
            let endpoint = '';
            if (type === 'video') endpoint = '/api/assets/stock/video';
            else if (type === 'audio') endpoint = '/api/assets/stock/audio';
            else if (type === 'sticker') endpoint = '/api/assets/stickers';

            const res = await axios.get(`${endpoint}`, {
                params: { query: q || (type === 'video' ? 'nature' : type === 'audio' ? 'cinematic' : 'funny') }
            });
            setAssets(res.data.results);
        } catch (error) {
            console.error("Failed to fetch assets", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            searchAssets(query, activeTab);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [query, activeTab]);

    const handleAddAsset = (asset: Asset) => {
        // Determine target track
        let trackId = '';
        if (asset.type === 'video') {
            trackId = tracks.find(t => t.type === 'video')?.id || tracks[0].id;
        } else if (asset.type === 'audio') {
            trackId = tracks.find(t => t.type === 'audio')?.id || '';
            if (!trackId) {
                trackId = tracks.find(t => t.type === 'audio')?.id || tracks[0].id; // Fallback
            }
        } else {
            // Sticker/Image -> Overlay track
            trackId = tracks.find(t => t.type === 'image')?.id || '';
            if (!trackId) {
                trackId = tracks.find(t => t.type === 'video')?.id || tracks[0].id;
            }
        }

        // Ensure trackId is valid
        const safeTrackId: string | null = trackId || null;
        const safeType: TrackType = asset.type as TrackType;

        addClip(safeTrackId, null, asset.url, safeType);
    };

    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-200 w-80">
            <div className="p-4 border-b border-gray-100 space-y-4">
                <h3 className="font-semibold text-sm">Assets</h3>
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-600" />
                    <Input
                        placeholder="Search..."
                        className="pl-8 h-9 text-xs"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="w-full grid grid-cols-3 h-8">
                        <TabsTrigger value="video" className="text-xs"><Video className="w-3 h-3 mr-1" /> Video</TabsTrigger>
                        <TabsTrigger value="audio" className="text-xs"><Music className="w-3 h-3 mr-1" /> Audio</TabsTrigger>
                        <TabsTrigger value="sticker" className="text-xs"><Sticker className="w-3 h-3 mr-1" /> Sticker</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-3">
                    {assets.map(asset => (
                        <div
                            key={asset.id}
                            className="group relative aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-all cursor-pointer"
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('application/json', JSON.stringify(asset));
                            }}
                        >
                            {asset.type === 'audio' ? (
                                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                    <Music className="w-8 h-8 text-slate-700" />
                                </div>
                            ) : (
                                <img src={asset.thumbnail} alt={asset.title} className="w-full h-full object-cover" />
                            )}

                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    className="h-6 w-6 rounded-full"
                                    onClick={() => handleAddAsset(asset)}
                                >
                                    <Plus className="w-3 h-3" />
                                </Button>
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[10px] text-white truncate px-2">
                                {asset.provider}
                            </div>
                        </div>
                    ))}
                    {loading && <div className="col-span-2 text-center text-xs text-slate-600 py-4">Loading...</div>}
                </div>
            </ScrollArea>
        </div>
    );
};

export default AssetBrowser;
