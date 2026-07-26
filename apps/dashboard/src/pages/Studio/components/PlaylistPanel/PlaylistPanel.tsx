import React, { useState, useRef, useEffect } from 'react';
import { useLofiStudioStore, getActiveScenePlaylist, Track } from '../../store/useLofiStudioStore';
import { Play, Pause, Plus, Search, Music, MoreVertical, Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import api from '@/lib/api'; // Add api import

interface TrackItemProps {
    track: Track;
    isPlaying: boolean;
    index: number;
    onPlay: () => void;
    onPause: () => void;
    onDelete: () => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
}

const TrackItem: React.FC<TrackItemProps> = ({
    track,
    isPlaying,
    index,
    onPlay,
    onPause,
    onDelete,
    onDragStart,
    onDragOver,
    onDrop,
}) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragStart = (e: React.DragEvent) => {
        setIsDragging(true);
        onDragStart(e);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={cn(
                'group p-3 rounded-lg border transition-all',
                isPlaying && 'bg-blue-50 border-blue-500',
                !isPlaying && 'bg-white border-gray-200 hover:border-gray-300',
                isDragging && 'opacity-50'
            )}
        >
            <div className="flex items-center gap-3">
                {/* Play/Pause Button */}
                <button
                    onClick={isPlaying ? onPause : onPlay}
                    className={cn(
                        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                        isPlaying ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500 font-mono">{index + 1}.</span>
                        <h4 className={cn(
                            'text-sm font-semibold truncate',
                            isPlaying ? 'text-blue-900' : 'text-gray-900'
                        )}>
                            {track.title}
                        </h4>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{track.artist}</span>
                        <span>•</span>
                        <span>{formatDuration(track.duration)}</span>
                    </div>
                </div>

                {/* Actions */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onDelete} className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
};

export const PlaylistPanel: React.FC = () => {
    const {
        currentTrackId,
        playbackState,
        addTrack,
        removeTrack,
        reorderTracks,
        setPlaybackOrder,
        setCurrentTrack,
        setPlaybackState,
        setCrossfadeDuration,
    } = useLofiStudioStore();

    const playlist = getActiveScenePlaylist();
    const activeScene = useLofiStudioStore(state =>
        state.scenes.find(s => s.id === state.activeSceneId)
    );

    const [searchQuery, setSearchQuery] = useState('');
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ... (rest of component logic) ...

    // Skipping to lines 356-366 replacement
    <div>
        <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-semibold">Crossfade</Label>
            <span className="text-xs text-gray-500">{activeScene?.crossfadeDuration || 0}s</span>
        </div>
        <Slider
            value={[activeScene?.crossfadeDuration || 4]}
            min={0}
            max={10}
            step={0.5}
            className="w-full"
            onValueChange={(val) => setCrossfadeDuration(val[0])}
        />
    </div>

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

        reorderTracks(draggedIndex, dropIndex);
        setDraggedIndex(null);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const fileArray = Array.from(files);
        for (const file of fileArray) {
            if (file.type.startsWith('audio/')) {
                try {
                    // 1. Upload
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('subfolder', 'studio_uploads');

                    // Assuming api is available globally or we fetch
                    const res = await fetch('/api/videos/upload_studio', {
                        method: 'POST',
                        body: formData
                    });
                    const uploaded = await res.json();

                    if (!uploaded.file_path) throw new Error("Upload failed");

                    // 2. Add Track
                    const url = URL.createObjectURL(file); // Keep using blob for immediate local playback if desired, or use server URL
                    // Actually, consistent with LiveStudioControls, we should use server URL if we want consistency?
                    // But for "Lofi" mode, we might want instant playback.
                    // However, for RENDER, we NEED filePath.

                    // Let's get duration.
                    const audio = new Audio(url);
                    audio.addEventListener('loadedmetadata', () => {
                        addTrack({
                            title: file.name.replace(/\.[^/.]+$/, ''),
                            artist: 'Unknown Artist',
                            duration: audio.duration,
                            src: url, // Local blob for playback responsiveness
                            filePath: uploaded.file_path, // Critical for backend render/cleanup
                            volume: 1,
                            fadeIn: 2,
                            fadeOut: 3,
                        });
                    });
                } catch (err) {
                    console.error("Failed to upload audio:", err);
                    alert("오디오 업로드 실패");
                }
            }
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handlePlay = (trackId: string) => {
        setCurrentTrack(trackId);
        setPlaybackState('playing');
    };

    const handlePause = () => {
        setPlaybackState('paused');
    };

    const handleDelete = (trackId: string) => {
        setSelectedTrackId(trackId);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (selectedTrackId) {
            removeTrack(selectedTrackId);
            if (currentTrackId === selectedTrackId) {
                setCurrentTrack(null);
                setPlaybackState('stopped');
            }
        }
        setDeleteDialogOpen(false);
        setSelectedTrackId(null);
    };

    const filteredTracks = playlist.filter(track =>
        track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        track.artist.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
                <h2 className="text-sm font-bold text-gray-900 mb-3">재생목록 (Playlist)</h2>

                {/* Search */}
                <div className="relative mb-3">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="트랙 검색..."
                        className="pl-8 h-8 text-sm"
                    />
                </div>

                {/* Add Track Button */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                />
                <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                    variant="outline"
                    size="sm"
                >
                    <Upload className="w-4 h-4 mr-2" />
                    음악 추가
                </Button>
            </div>

            {/* Track List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredTracks.length === 0 && !searchQuery && (
                    <div className="text-center py-12">
                        <Music className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <p className="text-sm text-slate-600 mb-4">트랙이 없습니다</p>
                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            size="sm"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            첫 트랙 추가
                        </Button>
                    </div>
                )}

                {filteredTracks.length === 0 && searchQuery && (
                    <div className="text-center py-12">
                        <p className="text-sm text-slate-600">트랙을 찾을 수 없습니다</p>
                    </div>
                )}

                {filteredTracks.map((track, index) => (
                    <TrackItem
                        key={track.id}
                        track={track}
                        isPlaying={currentTrackId === track.id && playbackState === 'playing'}
                        index={index}
                        onPlay={() => handlePlay(track.id)}
                        onPause={handlePause}
                        onDelete={() => handleDelete(track.id)}
                        onDragStart={handleDragStart(index)}
                        onDragOver={handleDragOver(index)}
                        onDrop={handleDrop(index)}
                    />
                ))}
            </div>

            {/* Playback Settings */}
            <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white space-y-4">
                <div>
                    <Label className="text-xs font-semibold mb-2 block">재생 순서</Label>
                    <Select
                        value={activeScene?.playbackOrder || 'sequential'}
                        onValueChange={(value: 'sequential' | 'random' | 'reverse') => setPlaybackOrder(value)}
                    >
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="sequential">순차 재생</SelectItem>
                            <SelectItem value="random">무작위</SelectItem>
                            <SelectItem value="reverse">역순</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>트랙 삭제</AlertDialogTitle>
                        <AlertDialogDescription>
                            재생목록에서 이 트랙을 삭제하시겠습니까?
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
