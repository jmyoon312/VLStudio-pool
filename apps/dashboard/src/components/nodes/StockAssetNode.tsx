import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Image, Clapperboard, Settings, Search, Download, Heart,
    Play, Grid3x3, List, CheckCircle, Loader2
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Asset {
    id: string;
    url: string;
    thumbnail: string;
    type: 'video' | 'photo';
    width: number;
    height: number;
    duration?: number;
}

const StockAssetNode = ({ data, selected }: NodeProps) => {
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('search');

    // 검색 설정
    const [source, setSource] = useState(data.source || 'pexels');
    const [searchQuery, setSearchQuery] = useState(data.searchQuery || '');
    const [assetType, setAssetType] = useState(data.assetType || 'videos');
    const [orientation, setOrientation] = useState(data.orientation || 'landscape');
    const [minWidth, setMinWidth] = useState(data.minWidth || 1920);
    const [minHeight, setMinHeight] = useState(data.minHeight || 1080);
    const [resultCount, setResultCount] = useState(data.resultCount || 5);

    // 검색 결과
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<Asset[]>([]);
    const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // 즐겨찾기
    const [favorites, setFavorites] = useState<Asset[]>([]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setSearching(true);
        setSearchResults([]);

        // 실제로는 백엔드 API 호출
        setTimeout(() => {
            const mockResults: Asset[] = Array.from({ length: resultCount }, (_, i) => ({
                id: `asset_${i}`,
                url: `https://example.com/video_${i}.mp4`,
                thumbnail: `https://via.placeholder.com/400x225?text=Video+${i + 1}`,
                type: assetType === 'videos' ? 'video' : 'photo',
                width: 1920,
                height: 1080,
                duration: assetType === 'videos' ? 15 : undefined
            }));
            setSearchResults(mockResults);
            setSearching(false);
        }, 1000);
    };

    const toggleAssetSelection = (assetId: string) => {
        setSelectedAssets(prev =>
            prev.includes(assetId) ? prev.filter(id => id !== assetId) : [...prev, assetId]
        );
    };

    const toggleFavorite = (asset: Asset) => {
        setFavorites(prev => {
            const exists = prev.find(f => f.id === asset.id);
            if (exists) {
                return prev.filter(f => f.id !== asset.id);
            } else {
                return [...prev, asset];
            }
        });
    };

    const isFavorite = (assetId: string) => {
        return favorites.some(f => f.id === assetId);
    };

    const handleSave = () => {
        if (data.onChange) {
            data.onChange({
                source,
                searchQuery,
                assetType,
                orientation,
                minWidth,
                minHeight,
                resultCount,
                selectedAssets
            });
        }
        setInspectorOpen(false);
    };

    const Icon = assetType === 'videos' ? Clapperboard : Image;

    return (
        <>
            <div className={cn(
                "relative min-w-[240px] transition-all duration-300",
                selected ? 'ring-2 ring-teal-500 rounded-xl' : ''
            )}>
                <Card className="p-0 overflow-hidden border-0 shadow-lg bg-white/95 backdrop-blur hover:shadow-xl transition-shadow">
                    <div className="h-2 bg-gradient-to-r from-teal-400 via-cyan-500 to-blue-500" />

                    <div className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center text-teal-600">
                                <Icon className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-slate-800 truncate">{data.label}</h3>
                                <div className="flex items-center gap-1 mt-1">
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-teal-50 text-teal-700 border border-teal-200">
                                        {source.toUpperCase()}
                                    </Badge>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => setInspectorOpen(true)}
                            >
                                <Settings className="w-4 h-4" />
                            </Button>
                        </div>

                        {searchQuery && (
                            <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                                <p className="truncate italic">"{searchQuery}"</p>
                            </div>
                        )}

                        <div className="mt-2 flex items-center justify-between text-xs">
                            <span className="text-slate-500">{assetType === 'videos' ? '비디오' : '사진'}</span>
                            <span className="font-medium text-teal-700">{resultCount}개</span>
                        </div>
                    </div>
                </Card>

                <Handle
                    type="source"
                    position={Position.Right}
                    className="w-4 h-4 bg-teal-500 border-2 border-white shadow-md"
                    isConnectable={true}
                />
            </div>

            {/* Inspector Dialog */}
            <Dialog open={inspectorOpen} onOpenChange={setInspectorOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
                    <DialogHeader className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white p-6">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Clapperboard className="w-5 h-5" />
                            스톡 자산 검색
                        </DialogTitle>
                        <p className="text-teal-50 text-sm mt-1">무료 스톡 비디오 및 이미지를 검색하세요</p>
                    </DialogHeader>

                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-3 mb-6">
                                <TabsTrigger value="search">검색</TabsTrigger>
                                <TabsTrigger value="results">결과 ({searchResults.length})</TabsTrigger>
                                <TabsTrigger value="favorites">즐겨찾기 ({favorites.length})</TabsTrigger>
                            </TabsList>

                            {/* 검색 탭 */}
                            <TabsContent value="search" className="space-y-6">
                                <div>
                                    <Label>소스</Label>
                                    <Select value={source} onValueChange={setSource}>
                                        <SelectTrigger className="mt-2">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pexels">Pexels</SelectItem>
                                            <SelectItem value="unsplash">Unsplash</SelectItem>
                                            <SelectItem value="pixabay">Pixabay</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>검색어</Label>
                                    <div className="flex gap-2 mt-2">
                                        <Input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="ocean sunset, city night..."
                                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                        <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                                            {searching ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Search className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        💡 영어로 검색하면 더 많은 결과를 얻을 수 있습니다
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>유형</Label>
                                        <Select value={assetType} onValueChange={setAssetType}>
                                            <SelectTrigger className="mt-2">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="videos">비디오</SelectItem>
                                                <SelectItem value="photos">사진</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>방향</Label>
                                        <Select value={orientation} onValueChange={setOrientation}>
                                            <SelectTrigger className="mt-2">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="landscape">가로 (Landscape)</SelectItem>
                                                <SelectItem value="portrait">세로 (Portrait)</SelectItem>
                                                <SelectItem value="square">정사각형</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label>최소 너비</Label>
                                        <Input
                                            type="number"
                                            value={minWidth}
                                            onChange={(e) => setMinWidth(parseInt(e.target.value))}
                                            className="mt-2"
                                        />
                                    </div>
                                    <div>
                                        <Label>최소 높이</Label>
                                        <Input
                                            type="number"
                                            value={minHeight}
                                            onChange={(e) => setMinHeight(parseInt(e.target.value))}
                                            className="mt-2"
                                        />
                                    </div>
                                    <div>
                                        <Label>결과 개수</Label>
                                        <Input
                                            type="number"
                                            value={resultCount}
                                            onChange={(e) => setResultCount(parseInt(e.target.value))}
                                            min={1}
                                            max={20}
                                            className="mt-2"
                                        />
                                    </div>
                                </div>
                            </TabsContent>

                            {/* 결과 탭 */}
                            <TabsContent value="results" className="space-y-4">
                                {searchResults.length > 0 && (
                                    <div className="flex items-center justify-between">
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant={viewMode === 'grid' ? 'default' : 'outline'}
                                                onClick={() => setViewMode('grid')}
                                            >
                                                <Grid3x3 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={viewMode === 'list' ? 'default' : 'outline'}
                                                onClick={() => setViewMode('list')}
                                            >
                                                <List className="w-4 h-4" />
                                            </Button>
                                        </div>
                                        <div className="text-sm text-slate-600">
                                            {selectedAssets.length}개 선택됨
                                        </div>
                                    </div>
                                )}

                                {searchResults.length === 0 && !searching && (
                                    <div className="text-center py-12 text-slate-600">
                                        <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p className="text-sm">검색 탭에서 자산을 검색하세요</p>
                                    </div>
                                )}

                                {searching && (
                                    <div className="text-center py-12">
                                        <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-teal-500" />
                                        <p className="text-sm text-slate-600">검색 중...</p>
                                    </div>
                                )}

                                <div className={viewMode === 'grid' ? 'grid grid-cols-3 gap-3' : 'space-y-2'}>
                                    {searchResults.map((asset) => (
                                        <div
                                            key={asset.id}
                                            className={cn(
                                                "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                                                selectedAssets.includes(asset.id)
                                                    ? 'border-teal-500 ring-2 ring-teal-200'
                                                    : 'border-transparent hover:border-slate-300'
                                            )}
                                            onClick={() => toggleAssetSelection(asset.id)}
                                        >
                                            <div className="aspect-video bg-slate-100 relative">
                                                <img
                                                    src={asset.thumbnail}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                                {asset.type === 'video' && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                        <Play className="w-8 h-8 text-white" />
                                                    </div>
                                                )}
                                                {selectedAssets.includes(asset.id) && (
                                                    <div className="absolute top-2 left-2">
                                                        <CheckCircle className="w-6 h-6 text-teal-500 bg-white rounded-full" />
                                                    </div>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="absolute top-2 right-2 h-8 w-8 p-0 bg-white/80 hover:bg-white"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFavorite(asset);
                                                    }}
                                                >
                                                    <Heart
                                                        className={cn(
                                                            "w-4 h-4",
                                                            isFavorite(asset.id) ? 'fill-red-500 text-red-500' : 'text-slate-600'
                                                        )}
                                                    />
                                                </Button>
                                            </div>
                                            {viewMode === 'list' && (
                                                <div className="p-2 bg-white">
                                                    <p className="text-xs text-slate-600">
                                                        {asset.width}x{asset.height}
                                                        {asset.duration && ` • ${asset.duration}초`}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {searchResults.length > 0 && (
                                    <div className="flex justify-center pt-4">
                                        <Button variant="outline">
                                            더 보기
                                        </Button>
                                    </div>
                                )}
                            </TabsContent>

                            {/* 즐겨찾기 탭 */}
                            <TabsContent value="favorites" className="space-y-4">
                                {favorites.length === 0 && (
                                    <div className="text-center py-12 text-slate-600">
                                        <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p className="text-sm">즐겨찾기한 자산이 없습니다</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-3">
                                    {favorites.map((asset) => (
                                        <div
                                            key={asset.id}
                                            className="relative group cursor-pointer rounded-lg overflow-hidden border hover:border-slate-300 transition-all"
                                        >
                                            <div className="aspect-video bg-slate-100 relative">
                                                <img
                                                    src={asset.thumbnail}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                                {asset.type === 'video' && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                        <Play className="w-8 h-8 text-white" />
                                                    </div>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="absolute top-2 right-2 h-8 w-8 p-0 bg-white/80 hover:bg-white"
                                                    onClick={() => toggleFavorite(asset)}
                                                >
                                                    <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Footer */}
                    <div className="border-t p-4 flex justify-between items-center bg-slate-50">
                        <div className="text-sm text-slate-600">
                            {selectedAssets.length}개 자산 선택됨
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setInspectorOpen(false)}>
                                취소
                            </Button>
                            <Button onClick={handleSave} className="bg-teal-600 hover:bg-teal-700">
                                <Download className="w-4 h-4 mr-2" />
                                저장
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default memo(StockAssetNode);
