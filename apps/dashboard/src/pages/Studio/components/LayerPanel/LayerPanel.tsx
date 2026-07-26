import React, { useState } from 'react';
import { useLofiStudioStore, getActiveSceneLayers } from '../../store/useLofiStudioStore';
import { LayerItem } from './LayerItem';
import { LayerProperties } from './LayerProperties';
import { Plus, Search, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const LayerPanel: React.FC = () => {
    const {
        selectedLayerIds,
        selectLayers,
        addLayer,
        updateLayer,
        deleteLayer,
        duplicateLayer,
        reorderLayer,
        toggleLayerVisibility,
        toggleLayerLock,
        setCrossfadeDuration
    } = useLofiStudioStore();

    const layers = getActiveSceneLayers();
    const selectedLayer = layers.find(l => selectedLayerIds.includes(l.id));
    const activeScene = useLofiStudioStore(state => state.scenes.find(s => s.id === state.activeSceneId));

    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [layerName, setLayerName] = useState('');

    // File Upload Refs
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [uploadType, setUploadType] = useState<'image' | 'video' | null>(null);

    const handleDragStart = (index: number) => (e: React.DragEvent) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (index: number) => (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (dropIndex: number) => (e: React.DragEvent) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) return;

        const draggedLayer = layers[draggedIndex];
        if (!draggedLayer) return;

        // Calculate direction
        let direction: 'up' | 'down' | 'top' | 'bottom';
        if (dropIndex === 0) {
            direction = 'bottom';
        } else if (dropIndex === layers.length - 1) {
            direction = 'top';
        } else if (dropIndex < draggedIndex) {
            direction = 'down';
        } else {
            direction = 'up';
        }

        reorderLayer(draggedLayer.id, direction);
        setDraggedIndex(null);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadType) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('subfolder', 'studio_uploads');

        try {
            let res;
            let usedDirect = false;

            try {
                res = await fetch('/api/videos/upload_studio', {
                    method: 'POST',
                    body: formData
                });
                if (!res.ok) throw new Error(`Proxy status: ${res.status}`);
            } catch (proxyError) {
                console.warn("Proxy upload failed/network error, attempting direct connection:", proxyError);
                usedDirect = true;
                res = await fetch('/api/videos/upload_studio', {
                    method: 'POST',
                    body: formData
                });
            }

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ detail: res.statusText }));
                throw new Error(errorData.detail || `Upload failed: ${res.status}`);
            }

            const data = await res.json();
            if (data.status !== 'success') throw new Error(data.error || 'Upload failed');

            const serverPath = data.file_path;
            const filename = serverPath.split(/[\\/]/).pop() || file.name;
            const persistentUrl = `/media/studio_uploads/${filename}`;

            const baseLayer = {
                visible: true,
                locked: false,
                x: 0,
                y: 0,
                opacity: 1,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                filePath: serverPath
            };

            if (uploadType === 'image') {
                addLayer({
                    ...baseLayer,
                    type: 'image',
                    name: file.name,
                    width: 400,
                    height: 300,
                    src: persistentUrl,
                    x: 640 - 200,
                    y: 360 - 150
                });
            } else if (uploadType === 'video') {
                addLayer({
                    ...baseLayer,
                    type: 'video',
                    name: file.name,
                    width: 640,
                    height: 360,
                    src: persistentUrl,
                    loop: true,
                    muted: false,
                    x: 640 - 320,
                    y: 360 - 180
                });
            }
        } catch (e) {
            console.error("Upload failed, falling back to local:", e);
            const errorMessage = e instanceof Error ? e.message : 'Unknown Error';
            toast.error(`Upload failed: ${errorMessage}`, {
                description: "Switched to local preview."
            });

            const url = URL.createObjectURL(file);
            const baseLayer = {
                visible: true,
                locked: false,
                x: 0,
                y: 0,
                opacity: 1,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                filePath: ''
            };

            if (uploadType === 'image') {
                addLayer({ ...baseLayer, type: 'image', name: file.name, width: 400, height: 300, src: url, x: 640 - 200, y: 360 - 150 });
            } else {
                addLayer({ ...baseLayer, type: 'video', name: file.name, width: 640, height: 360, src: url, loop: true, muted: false, x: 640 - 320, y: 360 - 180 });
            }
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
        setUploadType(null);
    };

    const handleAddLayer = (type: 'text' | 'image' | 'video' | 'widget') => {
        if (type === 'image' || type === 'video') {
            setUploadType(type);
            if (fileInputRef.current) {
                fileInputRef.current.accept = type === 'image' ? 'image/*' : 'video/*';
                fileInputRef.current.click();
            }
            return;
        }

        const layerDefaults = {
            text: {
                type: 'text' as const,
                name: '새 텍스트',
                visible: true,
                locked: false,
                x: 640,
                y: 360,
                width: 400,
                height: 60,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                opacity: 1,
                text: '새 텍스트',
                fontSize: 48,
                fontFamily: 'Poppins',
                fill: '#FFFFFF',
                textAlign: 'center' as const,
            },
            widget: {
                type: 'widget' as const,
                name: '새 위젯',
                visible: true,
                locked: false,
                x: 640,
                y: 360,
                width: 400,
                height: 100,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                opacity: 1,
                widgetType: 'nowPlaying' as const,
            },
            image: {},
            video: {}
        };

        // @ts-ignore
        if (layerDefaults[type]) addLayer(layerDefaults[type]);
    };

    const handleRename = (layerId: string) => {
        const layer = layers.find(l => l.id === layerId);
        if (!layer) return;

        setSelectedLayerId(layerId);
        setLayerName(layer.name);
        setRenameDialogOpen(true);
    };

    const handleConfirmRename = () => {
        if (!selectedLayerId) return;
        updateLayer(selectedLayerId, { name: layerName });
        setRenameDialogOpen(false);
        setSelectedLayerId(null);
        setLayerName('');
    };

    const handleDelete = (layerId: string) => {
        setSelectedLayerId(layerId);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedLayerId) return;

        const layerToDelete = layers.find(l => l.id === selectedLayerId);

        // Auto-delete file if it's a studio upload
        if (layerToDelete && layerToDelete.filePath) {
            try {
                // Determine if we should delete
                // It is a strict request: "deleted from that folder too"
                await fetch('/api/videos/delete_studio_file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ file_path: layerToDelete.filePath })
                });
                toast.success('파일이 삭제되었습니다.');
            } catch (e) {
                console.error("Failed to delete file", e);
                // We typically still delete the layer even if file delete fails
            }
        }

        deleteLayer(selectedLayerId);
        setDeleteDialogOpen(false);
        setSelectedLayerId(null);
    };

    const filteredLayers = layers.filter(layer =>
        layer.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedLayers = [...filteredLayers].sort((a, b) => b.zIndex - a.zIndex);

    return (
        <div className="h-full flex flex-col bg-gray-50">
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
            {/* Header */}
            <div className="flex-shrink-0 p-3 border-b border-gray-200 bg-white">
                <h2 className="text-sm font-bold text-gray-900 mb-2">레이어 (Layers)</h2>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="레이어 검색..."
                        className="pl-8 h-8 text-sm"
                    />
                </div>
            </div>

            {/* Layer List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sortedLayers.length === 0 && !searchQuery && (
                    <div className="text-center py-12">
                        <p className="text-sm text-slate-600 mb-4">레이어가 없습니다</p>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm">
                                    <Plus className="w-4 h-4 mr-2" />
                                    첫 레이어 추가
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => handleAddLayer('text')}>
                                    텍스트 레이어
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAddLayer('image')}>
                                    이미지 레이어
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAddLayer('video')}>
                                    비디오 레이어
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}

                {sortedLayers.length === 0 && searchQuery && (
                    <div className="text-center py-12">
                        <p className="text-sm text-slate-600">레이어를 찾을 수 없습니다</p>
                    </div>
                )}

                {sortedLayers.map((layer, index) => (
                    <LayerItem
                        key={layer.id}
                        layer={layer}
                        isSelected={selectedLayerIds.includes(layer.id)}
                        index={index}
                        onSelect={() => selectLayers([layer.id])}
                        onToggleVisibility={() => toggleLayerVisibility(layer.id)}
                        onToggleLock={() => toggleLayerLock(layer.id)}
                        onDuplicate={() => duplicateLayer(layer.id)}
                        onDelete={() => handleDelete(layer.id)}
                        onRename={() => handleRename(layer.id)}
                        onDragStart={handleDragStart(index)}
                        onDragOver={handleDragOver(index)}
                        onDrop={handleDrop(index)}
                        onReorder={(direction) => reorderLayer(layer.id, direction)}
                    />
                ))}
            </div>

            {/* Layer Properties */}
            {selectedLayer && (
                <div className="flex-shrink-0 border-t border-gray-200 bg-white max-h-96 overflow-y-auto">
                    <LayerProperties layer={selectedLayer} />
                </div>
            )}

            {/* Footer Actions */}
            <div className="flex-shrink-0 p-3 border-t border-gray-200 bg-white space-y-3">

                {/* Crossfade Support */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-semibold">비디오 크로스페이드 (Crossfade)</Label>
                        <span className="text-xs text-gray-500">{(activeScene?.crossfadeDuration || 0).toFixed(1)}s</span>
                    </div>
                    <Slider
                        value={[activeScene?.crossfadeDuration ?? 0.2]}
                        min={0}
                        max={5}
                        step={0.1}
                        className="w-full"
                        onValueChange={(val) => setCrossfadeDuration(val[0])}
                    />
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button className="w-full" variant="outline" size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            레이어 추가
                            <ChevronDown className="w-4 h-4 ml-auto" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full">
                        <DropdownMenuItem onClick={() => handleAddLayer('text')}>
                            텍스트 레이어
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAddLayer('image')}>
                            이미지 레이어
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAddLayer('video')}>
                            비디오 레이어
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Rename Layer Dialog */}
            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>레이어 이름 변경</DialogTitle>
                        <DialogDescription>
                            새로운 레이어 이름을 입력하세요
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={layerName}
                            onChange={(e) => setLayerName(e.target.value)}
                            placeholder="레이어 이름"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmRename();
                            }}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
                            취소
                        </Button>
                        <Button onClick={handleConfirmRename}>
                            변경
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Layer Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>레이어 삭제</AlertDialogTitle>
                        <AlertDialogDescription>
                            이 레이어를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            삭제
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
