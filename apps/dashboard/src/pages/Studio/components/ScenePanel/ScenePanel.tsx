import React, { useState } from 'react';
import { useLofiStudioStore } from '../../store/useLofiStudioStore';
import { SceneItem } from './SceneItem';
import { Plus, LayoutTemplate, Clapperboard } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

export const ScenePanel: React.FC = () => {
    const {
        scenes,
        activeSceneId,
        setActiveScene,
        addScene,
        updateScene,
        deleteScene,
        duplicateScene,
        reorderScenes,
        isDirectorMode, // [NEW]
        setDirectorMode, // [NEW]
    } = useLofiStudioStore();

    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
    const [sceneName, setSceneName] = useState('');

    // Initialize active scene if none selected
    React.useEffect(() => {
        if (!activeSceneId && scenes.length > 0) {
            setActiveScene(scenes[0].id);
        }
    }, [activeSceneId, scenes, setActiveScene]);

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

        reorderScenes(draggedIndex, dropIndex);
        setDraggedIndex(null);
    };

    const handleCreateScene = () => {
        setSceneName('새 씬');
        setCreateDialogOpen(true);
    };

    const handleTemplateClick = () => {
        addScene({
            name: 'Cozy Room 템플릿',
            thumbnail: '',
            duration: null,
            layers: [
                {
                    id: uuidv4(),
                    type: 'text',
                    zIndex: 0,
                    name: 'Title',
                    text: 'Lofi Vibes',
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
                    fill: '#ffffff',
                    fontSize: 60,
                    fontFamily: 'Poppins',
                    textAlign: 'center'
                }
            ],
            playlist: [],
            playbackOrder: 'sequential',
            transition: {
                type: 'fade',
                duration: 2000,
                easing: 'ease-in-out',
            },
            backgroundVideo: null,
            crossfadeDuration: 0.5,
        });
    };

    const handleConfirmCreate = () => {
        addScene({
            name: sceneName || '새 씬',
            thumbnail: '',
            duration: null,
            layers: [],
            playlist: [],
            playbackOrder: 'sequential',
            transition: {
                type: 'fade',
                duration: 2000,
                easing: 'ease-in-out',
            },
            backgroundVideo: null,
            crossfadeDuration: 0.5,
        });
        setCreateDialogOpen(false);
        setSceneName('');
    };

    const handleRename = (sceneId: string) => {
        const scene = scenes.find(s => s.id === sceneId);
        if (!scene) return;

        setSelectedSceneId(sceneId);
        setSceneName(scene.name);
        setRenameDialogOpen(true);
    };

    const handleConfirmRename = () => {
        if (!selectedSceneId) return;

        updateScene(selectedSceneId, { name: sceneName });
        setRenameDialogOpen(false);
        setSelectedSceneId(null);
        setSceneName('');
    };

    const handleDelete = (sceneId: string) => {
        setSelectedSceneId(sceneId);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (!selectedSceneId) return;

        deleteScene(selectedSceneId);
        setDeleteDialogOpen(false);
        setSelectedSceneId(null);
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="flex-shrink-0 p-3 border-b border-gray-200 bg-white flex justify-between items-center">
                <div>
                    <h2 className="text-sm font-bold text-gray-900 mb-1">씬 (Scenes)</h2>
                    <p className="text-xs text-gray-500">
                        {scenes.length}개의 씬
                    </p>
                </div>
                {/* Director Mode Toggle */}
                <Button
                    variant={isDirectorMode ? "default" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setDirectorMode(!isDirectorMode)}
                    title="AI Director Mode"
                >
                    <Clapperboard className={cn("w-4 h-4", isDirectorMode && "text-white")} />
                </Button>
            </div>

            {/* Scene List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {scenes.map((scene, index) => (
                    <SceneItem
                        key={scene.id}
                        scene={scene}
                        isActive={scene.id === activeSceneId}
                        isDirectorMode={isDirectorMode} // [NEW]
                        index={index}
                        onSelect={() => setActiveScene(scene.id)}
                        onDuplicate={() => duplicateScene(scene.id)}
                        onDelete={() => handleDelete(scene.id)}
                        onRename={() => handleRename(scene.id)}
                        onDragStart={handleDragStart(index)}
                        onDragOver={handleDragOver(index)}
                        onDrop={handleDrop(index)}
                    />
                ))}

                {scenes.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-sm text-slate-600 mb-4">씬이 없습니다</p>
                        <Button onClick={handleCreateScene} size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            첫 씬 만들기
                        </Button>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="flex-shrink-0 p-2 border-t border-gray-200 bg-white space-y-2">
                <Button
                    onClick={handleCreateScene}
                    className="w-full"
                    variant="outline"
                    size="sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    새 씬
                </Button>

                <Button
                    className="w-full"
                    variant="outline"
                    size="sm"
                    onClick={handleTemplateClick}
                >
                    <LayoutTemplate className="w-4 h-4 mr-2" />
                    씬 템플릿
                </Button>
            </div>

            {/* Create Scene Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>새 씬 만들기</DialogTitle>
                        <DialogDescription>
                            새 씬의 이름을 입력하세요
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={sceneName}
                            onChange={(e) => setSceneName(e.target.value)}
                            placeholder="씬 이름"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmCreate();
                            }}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                            취소
                        </Button>
                        <Button onClick={handleConfirmCreate}>
                            만들기
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename Scene Dialog */}
            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>씬 이름 변경</DialogTitle>
                        <DialogDescription>
                            새로운 씬 이름을 입력하세요
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={sceneName}
                            onChange={(e) => setSceneName(e.target.value)}
                            placeholder="씬 이름"
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

            {/* Delete Scene Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>씬 삭제</AlertDialogTitle>
                        <AlertDialogDescription>
                            이 씬을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                            {scenes.length === 1 && (
                                <span className="block mt-2 text-red-600 font-semibold">
                                    마지막 씬은 삭제할 수 없습니다.
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            disabled={scenes.length === 1}
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
