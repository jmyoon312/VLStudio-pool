import React, { useEffect, useRef, useState } from 'react';
import { useLofiStudioStore } from './store/useLofiStudioStore';
import { ScenePanel } from './components/ScenePanel';
import { LayerPanel } from './components/LayerPanel';
import { PlaylistPanel } from './components/PlaylistPanel';
import { WidgetPanel } from './components/WidgetPanel';
import { LiveStudioStage } from './LiveStudioStage';
import { Save, Upload, Settings, Video, RefreshCw, Radio, RotateCcw, ArrowLeft, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from "@/components/ui/use-toast";
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { RenderVideoModal } from './components/RenderVideoModal';
import { AssetGeneratorDialog } from './components/AssetGeneratorDialog'; // [NEW]
import html2canvas from 'html2canvas';

export const LiveStudio: React.FC = () => {
    const {
        scenes,
        activeSceneId,
        setActiveScene,
        currentTrackId,
        playbackState,
        setCurrentTrack,
        setPlaybackState,
        loadFromStation,
        loadFromTemplate,
        resetStudio
    } = useLofiStudioStore();

    const audioRef = useRef<HTMLAudioElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const stationIdParam = searchParams.get('stationId');
    const [editingStation, setEditingStation] = useState<any>(null);

    // [NEW] Load Station Data
    useEffect(() => {
        if (!stationIdParam) return;

        const loadStation = async () => {
            try {
                // 1. Fetch Station Metadata First
                const stationRes = await axios.get(`/api/stations/${stationIdParam}`);
                setEditingStation(stationRes.data);

                // 2. Try Fetching Existing Design
                try {
                    const designRes = await axios.get(`/api/stations/${stationIdParam}/design`);

                    if (designRes.data && (designRes.data.scene || designRes.data.scenes)) {
                        const { scene, scenes, playlist } = designRes.data;
                        console.log("Loading existing design:", scenes ? `${scenes.length} scenes` : scene);
                        // Pass activeSceneId if available
                        loadFromStation({ scene, scenes, playlist, activeSceneId: designRes.data.activeSceneId });
                        toast({ title: "스테이션 로드됨", description: stationRes.data.name });
                        return; // Successfully loaded existing design
                    }
                } catch (designErr) {
                    // 404 Not Found is expected for new stations
                    console.log("No existing design found, initializing specific defaults...");
                }

                // 3. If No Design, Initialize with Station Config (Draft Mode)
                if (stationRes.data) {
                    console.log("Initializing draft station:", stationRes.data);

                    // Create a custom initial scene based on station settings
                    // Create a custom initial scene based on station settings
                    const draftScene = {
                        id: crypto.randomUUID(),
                        name: stationRes.data.name || 'Main Scene',
                        backgroundVideo: stationRes.data.background_video_path || null,
                        layers: [],
                        playlist: [],
                        thumbnail: '',
                        duration: 0,
                        playbackOrder: 'sequential' as const,
                        transition: 'none' as any,
                        crossfadeDuration: 0.5
                    };

                    // Hydrate with this draft scene
                    loadFromStation({ scene: draftScene, playlist: [] });

                    toast({ title: "새 디자인 시작", description: "스테이션 설정으로 초기화되었습니다." });
                }

            } catch (e) {
                console.error("Failed to load station", e);
                toast({ variant: "destructive", title: "로드 실패", description: "스테이션 정보를 가져올 수 없습니다." });
                navigate('/station-manager'); // Go back on critical error
            }
        };
        loadStation();
    }, [stationIdParam, loadFromStation, toast, navigate]);

    // Initialize active scene
    useEffect(() => {
        if (!activeSceneId && scenes.length > 0) {
            setActiveScene(scenes[0].id);
        }
    }, [activeSceneId, scenes, setActiveScene]);

    // Audio Engine
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const activeScene = scenes.find(s => s.id === activeSceneId);
        if (!activeScene) return;

        if (currentTrackId) {
            const track = activeScene.playlist.find(t => t.id === currentTrackId);
            if (track) {
                if (!audio.src || !audio.src.includes(track.src)) {
                    audio.src = track.src;
                }

                if (playbackState === 'playing') {
                    audio.play().catch(e => console.error("Playback failed", e));
                } else if (playbackState === 'paused') {
                    audio.pause();
                } else {
                    audio.pause();
                    audio.currentTime = 0;
                }
            }
        } else {
            audio.pause();
            audio.currentTime = 0;
            audio.src = '';
        }
    }, [currentTrackId, playbackState, activeSceneId, scenes]);

    const handleTrackEnded = () => {
        const activeScene = scenes.find(s => s.id === activeSceneId);
        if (!activeScene || !currentTrackId) return;

        const currentIndex = activeScene.playlist.findIndex(t => t.id === currentTrackId);
        if (currentIndex !== -1 && currentIndex < activeScene.playlist.length - 1) {
            setCurrentTrack(activeScene.playlist[currentIndex + 1].id);
        } else {
            if (activeScene.playlist.length > 0) {
                setCurrentTrack(activeScene.playlist[0].id);
            } else {
                setPlaybackState('stopped');
            }
        }
    };

    const handleSaveTemplate = () => {
        const state = useLofiStudioStore.getState();
        const data = {
            scenes: state.scenes,
            widgets: state.widgets,
            brandKit: state.brandKit,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `lofi-template-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
            title: "템플릿 저장 완료",
            description: "현재 디자인이 JSON 파일로 다운로드되었습니다.",
        });
    };

    const handleLoadTemplateClick = () => {
        fileInputRef.current?.click();
    };

    const handleTemplateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                loadFromTemplate(json);
                toast({ title: "템플릿 로드 완료", description: "저장된 템플릿을 불러왔습니다." });
            } catch (err) {
                console.error(err);
                toast({ variant: "destructive", title: "로드 실패", description: "파일 형식이 올바르지 않습니다." });
            }
        };
        reader.readAsText(file);
        // Reset
        e.target.value = '';
    };

    const [renderModalOpen, setRenderModalOpen] = useState(false);
    const [assetGeneratorOpen, setAssetGeneratorOpen] = useState(false); // [NEW]

    // [NEW] Logic: Register or Update Station
    const handleRegisterDesign = async () => {
        console.log("handleRegisterDesign started");
        try {
            const activeScene = scenes.find(s => s.id === activeSceneId);
            if (!activeScene) {
                console.error("No active scene found");
                return;
            }

            // Validation
            const bgLayer = activeScene.layers.find(l => l.type === 'video' || l.type === 'image');
            if (!bgLayer) {
                toast({ variant: "destructive", title: "배경 없음", description: "최소한 하나의 이미지 또는 비디오 배경이 필요합니다." });
                return;
            }

            // Warn if filePath is missing (backend might fail to load it)
            if (!bgLayer.filePath && !bgLayer.src?.startsWith('http')) {
                // If it's a blob, we must warn
                if (bgLayer.src?.startsWith('blob:')) {
                    toast({ variant: "destructive", title: "경로 오류", description: "배경 파일이 서버에 업로드되지 않았습니다. 레이어를 다시 추가해주세요." });
                    return;
                }
            }

            // Background Path for Station Config
            const bgPath = bgLayer.filePath || bgLayer.src || '';

            // Capture Thumbnail (Safe Mode)
            let thumbnailData = '';
            try {
                console.log("Attempting thumbnail capture...");
                const konvaCanvas = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement;
                if (konvaCanvas) {
                    // Fast path: use Konva canvas directly
                    thumbnailData = konvaCanvas.toDataURL("image/png", 0.5);
                    console.log("Thumbnail captured from Konva canvas");
                } else {
                    // Fallback path
                    const element = document.querySelector('#studio-stage-container');
                    if (element) {
                        const canvas = await html2canvas(element as HTMLElement, { useCORS: true, scale: 0.5, logging: false });
                        thumbnailData = canvas.toDataURL("image/png");
                        console.log("Thumbnail captured with html2canvas");
                    }
                }
            } catch (err) {
                console.warn("Thumbnail capture failed, continuing without thumbnail", err);
            }

            console.log("Saving station data...", editingStation ? "UPDATE ID:" + editingStation.id : "CREATE");

            if (editingStation) {
                // UPDATE Mode
                // Get full state
                const state = useLofiStudioStore.getState();

                await axios.post(`/api/stations/${editingStation.id}/design`, {
                    scene: activeScene, // Legacy/Active
                    scenes: state.scenes, // New: Full Project State
                    activeSceneId: state.activeSceneId,
                    playlist: activeScene.playlist,
                    thumbnail_data: thumbnailData
                });
                console.log("Update request success");
                toast({ title: "방송 업데이트 완료", description: "변경사항이 방송국에 적용되었습니다." });

                // Restart Prompt
                if (editingStation.status === 'ONLINE') {
                    if (confirm("방송이 현재 송출 중입니다. 재시작하시겠습니까? (잠시 끊김)")) {
                        try {
                            await axios.post(`/api/stations/${editingStation.id}/stop`);
                            setTimeout(async () => {
                                await axios.post(`/api/stations/${editingStation.id}/start`);
                                toast({ title: "방송 재시작됨" });
                            }, 2000);
                        } catch (e) { console.error("Restart failed", e); }
                    }
                }

                // Clean exit (Reset but keep files)
                state.resetStudio(true);
                navigate('/station-manager');
            } else {
                // CREATE Mode
                const name = prompt("새 방송국 이름:", activeScene.name);
                if (!name) return;

                // 1. Create Station
                const res = await axios.post('/api/stations/', {
                    name,
                    status: 'OFFLINE',
                    background_video_path: bgPath
                });
                const newStation = res.data;

                // Get full state
                const state = useLofiStudioStore.getState();

                // 2. Push Design
                await axios.post(`/api/stations/${newStation.id}/design`, {
                    scene: activeScene,
                    scenes: state.scenes,
                    activeSceneId: state.activeSceneId,
                    playlist: activeScene.playlist,
                    thumbnail_data: thumbnailData
                });

                toast({ title: "방송국 생성 완료", description: "스테이션 관리 페이지로 이동합니다." });
                // Clean exit
                state.resetStudio(true);
                navigate('/station-manager');
            }
        } catch (e: any) {
            console.error("handleRegisterDesign error:", e);
            toast({ variant: "destructive", title: "오류 발생", description: e.response?.data?.detail || e.message || "요청 실패" });
        }
    };

    // [NEW] Logic: Render Video
    const handleDownloadVideo = () => {
        const activeScene = scenes.find(s => s.id === activeSceneId);
        if (!activeScene) {
            toast({ title: "오류", description: "씬이 없습니다." });
            return;
        }
        setRenderModalOpen(true);
    };

    const handleSettings = () => {
        toast({ title: "설정", description: "설정 기능은 준비 중입니다." });
    };

    const handleResetStudio = () => {
        if (confirm("모든 디자인과 파일이 삭제됩니다.\n초기화 하시겠습니까?")) {
            resetStudio();
            toast({ title: "초기화 완료", description: "디자인이 초기화되었습니다." });
        }
    };

    // [NEW] Dynamic Layout Adjustment
    const [bottomPadding, setBottomPadding] = useState(0);

    useEffect(() => {
        const updateLayout = () => {
            const canvasContainer = document.getElementById('studio-stage-container');
            if (canvasContainer) {
                const rect = canvasContainer.getBoundingClientRect();
                const windowHeight = window.innerHeight;
                // Calculate gap: Window Height - Canvas Bottom
                // We want to force the sidebars to "stop" at the same visual line as the canvas bottom
                // So we add padding to the bottom of the sidebar containers equal to this gap
                // But we must account for any existing bottom UI or margins if necessary.
                // For now, pure gap calculation:
                const gap = Math.max(0, windowHeight - rect.bottom);
                setBottomPadding(gap);
            }
        };

        // Initial check
        updateLayout();

        // Resize Observer
        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(updateLayout);
        });

        const canvasContainer = document.getElementById('studio-stage-container');
        if (canvasContainer) resizeObserver.observe(canvasContainer);
        window.addEventListener('resize', updateLayout);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateLayout);
        };
    }, []);

    return (
        <div className="h-full w-full flex flex-col bg-gray-100 overflow-hidden">
            <audio
                ref={audioRef}
                onEnded={handleTrackEnded}
                className="hidden"
            />
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="application/json"
                onChange={handleTemplateFileChange}
            />

            {/* Top Bar */}
            <div className="flex-shrink-0 h-12 bg-white border-b border-gray-200 flex items-center justify-between px-3 relative z-20">
                <div className="min-w-0 flex-shrink flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/station-manager')}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-sm font-bold text-gray-900 truncate">라이브 디자인 스튜디오</h1>
                        <p className="text-xs text-gray-500 truncate">
                            {editingStation ? `Editing: ${editingStation.name}` : '새 디자인 작업 중'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-xs px-2"
                        onClick={handleLoadTemplateClick}
                    >
                        <Upload className="w-3 h-3 mr-1" />
                        <span className="hidden sm:inline">불러오기</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-xs px-2"
                        onClick={handleSaveTemplate}
                    >
                        <Save className="w-3 h-3 mr-1" />
                        <span className="hidden sm:inline">템플릿 저장</span>
                    </Button>

                    {/* [NEW] Asset Generator Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-xs px-2 text-purple-600 border-purple-200 hover:bg-purple-50"
                        onClick={() => setAssetGeneratorOpen(true)}
                    >
                        <Wand2 className="w-3 h-3 mr-1" />
                        <span className="hidden sm:inline">AI 생성</span>
                    </Button>

                    {/* [NEW] Reset Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-xs px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={handleResetStudio}
                        disabled={!!editingStation}
                        title={editingStation ? "기존 스테이션 편집 중에는 초기화할 수 없습니다." : "새 디자인 시작"}
                    >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        <span className="hidden sm:inline">새 디자인</span>
                    </Button>

                    {/* [NEW] Render Button */}
                    <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs px-2"
                        onClick={handleDownloadVideo}
                    >
                        <Video className="w-3 h-3 mr-1" />
                        <span className="hidden sm:inline">영상 추출</span>
                    </Button>

                    {/* [NEW] Register/Update Button */}
                    <Button
                        size="sm"
                        className={`text-xs px-2 ${editingStation ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        onClick={handleRegisterDesign}
                    >
                        {editingStation ? <RefreshCw className="w-3 h-3 mr-1" /> : <Radio className="w-3 h-3 mr-1" />}
                        <span className="hidden sm:inline">{editingStation ? "방송 업데이트" : "방송 등록"}</span>
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="px-2"
                        onClick={handleSettings}
                    >
                        <Settings className="w-3 h-3" />
                    </Button>
                </div>
            </div>

            {/* Main Content - Responsive Layout */}
            <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[minmax(180px,15%)_1fr_minmax(200px,20%)] gap-0 overflow-hidden min-h-0 bg-gray-200">
                {/* Left Panel - Scene Manager (Desktop) */}
                <div
                    className="hidden lg:block border-r border-gray-200 bg-white overflow-hidden transition-[padding] duration-200 ease-out"
                    style={{ paddingBottom: `${bottomPadding + 10}px` }} // +10px for visual breathing room
                >
                    <ScenePanel />
                </div>

                {/* Center Panel - Canvas */}
                <div className="flex bg-transparent overflow-hidden items-center justify-center relative z-10 w-full lg:w-auto h-auto lg:h-full">
                    <div id="studio-stage-container" className="w-full aspect-video bg-black shadow-2xl relative max-h-[calc(100vh-100px)]">
                        <LiveStudioStage />
                    </div>
                </div>

                {/* Right Panel - Properties & Mobile Tabs */}
                <div
                    className="flex-1 border-gray-200 bg-white overflow-hidden flex flex-col lg:border-l transition-[padding] duration-200 ease-out"
                    style={{ paddingBottom: `${bottomPadding + 10}px` }} // +10px for visual breathing room
                >
                    <Tabs defaultValue="layers" className="h-full flex flex-col">
                        <TabsList className="w-full grid grid-cols-4 lg:grid-cols-3 rounded-none border-b flex-shrink-0">
                            {/* Mobile Only: Scene Tab */}
                            <TabsTrigger value="scenes" className="text-xs lg:hidden">씬</TabsTrigger>
                            <TabsTrigger value="layers" className="text-xs">레이어</TabsTrigger>
                            <TabsTrigger value="playlist" className="text-xs">재생목록</TabsTrigger>
                        </TabsList>

                        {/* Mobile Only: Scene Content */}
                        <TabsContent value="scenes" className="flex-1 overflow-hidden m-0 lg:hidden">
                            <ScenePanel />
                        </TabsContent>

                        <TabsContent value="layers" className="flex-1 overflow-hidden m-0">
                            <LayerPanel />
                        </TabsContent>

                        <TabsContent value="playlist" className="flex-1 overflow-hidden m-0">
                            <PlaylistPanel />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
            <RenderVideoModal
                isOpen={renderModalOpen}
                onClose={() => setRenderModalOpen(false)}
                scene={scenes.find(s => s.id === activeSceneId) || null}
            />

            <AssetGeneratorDialog
                isOpen={assetGeneratorOpen}
                onClose={() => setAssetGeneratorOpen(false)}
            />
        </div>
    );
};
