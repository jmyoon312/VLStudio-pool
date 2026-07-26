import React, { useState, useEffect, useRef } from 'react';
import {
    Settings,
    MessageSquare,
    Mic,
    Video,
    Monitor,
    Play,
    Square,
    Users,
    ChevronDown,
    RefreshCw,
    Link as LinkIcon,
    Music,
    Image,
    Repeat,
    Plus,
    Trash2,
    Type,
    Layers,
    Search,
    Loader2,
    LayoutTemplate,
    FolderOpen,
    X,
    Cast,
    Radio,
    RotateCcw // New Icon
} from 'lucide-react';
import { useStudioStore, StreamSettings } from './store/useStudioStore';
import { useLofiStudioStore } from './store/useLofiStudioStore'; // Import Lofi Store
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom'; // [NEW] useSearchParams
import api, { Video as VideoType } from '../../lib/api';
import { cn, getMediaUrl } from '@/lib/utils';
import { resolveFileUrl } from '@/utils/fileUrl';
import { STUDIO_TEMPLATES, StudioTemplate } from './data/templates';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// Mock ID (In real app, get from Context/Auth)
const DEMO_CAPTAIN_ID = "e9060578";

type MainTab = 'settings' | 'library';
type LibraryTab = 'media';

export const LiveStudioControls: React.FC = () => {
    const {
        streamSettings,
        setStreamSettings,
        activeChannelIds,
        addActiveChannel,
        removeActiveChannel,
        currentRecipe,
        lofiPlaylist,
        addToPlaylist,
        removeFromPlaylist,
        updateLayer,
        selectedId,
        setRecipe,
        playbackOrder,
        setPlaybackOrder,
        layers
    } = useStudioStore();

    const isStreaming = false; // Logic moved to button renderer based on multi-select state

    const [isCollapsed, setIsCollapsed] = useState(true);
    const [mainTab, setMainTab] = useState<MainTab>('settings');

    // Fetch Fonts
    const { data: fontData } = useQuery({
        queryKey: ['system-fonts'],
        queryFn: async () => {
            const res = await api.get('/tools/fonts');
            return res.data;
        }
    });

    // Default fonts if fetch fails or loading
    const defaultFonts = ['Pretendard', 'Noto Sans KR', 'Nanum Gothic', 'Gmarket Sans'];
    const koreanFonts = fontData?.Korean || [];
    const englishFonts = fontData?.English || [];
    const otherFonts = [...(fontData?.Japanese || []), ...(fontData?.Chinese || []), ...(fontData?.Other || [])];

    // Combine for Flat List if needed, or use groups
    const hasDynamicFonts = koreanFonts.length > 0 || englishFonts.length > 0;

    const [libTab, setLibTab] = useState<LibraryTab>('media');
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null); // [RESTORED]
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams(); // [NEW]
    const stationIdParam = searchParams.get('stationId');
    const [editingStation, setEditingStation] = useState<any>(null); // [NEW] Local state for loaded station metadata

    // Fetch Videos from Gallery API (Strict: studio_assets only) - From LiveStudioDock
    const { data: videos, isLoading: isAssetsLoading } = useQuery<VideoType[]>({
        queryKey: ['studio-gallery-assets'],
        queryFn: async () => {
            // Filter by 'studio_uploads' folder to separate from Gallery
            const res = await api.get<VideoType[]>('/videos', { params: { folder: 'studio_uploads' } });
            return res.data;
        }
    });

    // [NEW] Load Station Data if ID exists
    useEffect(() => {
        if (!stationIdParam) return;

        const loadStation = async () => {
            try {
                // 1. Fetch Basic Info
                const res = await axios.get(`/api/stations/${stationIdParam}`);
                const station = res.data;
                setEditingStation(station);

                // Set RTMP Url
                if (station.rtmp_url) {
                    setStreamSettings({ rtmpUrl: station.rtmp_url });
                }

                // 2. Fetch Playlist
                const plRes = await axios.get(`/api/stations/${stationIdParam}/playlist`);
                if (plRes.data && plRes.data.tracks_json) {
                    // Map generic tracks to lofi tracks
                    const loadedTracks = plRes.data.tracks_json.map((t: any) => ({
                        id: uuidv4(),
                        title: t.title || 'Untitled',
                        src: '', // URL not strictly needed for list, but usually objectURL or server path
                        filePath: t.path || t.filePath, // Critical for deploy
                        duration: 0
                    }));
                    useStudioStore.getState().setPlaylist(loadedTracks);
                }

                // 3. Set Background (If path exists, we must try to load it or simulate layer)
                if (station.background_video_path) {
                    // Check if we have a layer for this? 
                    // We can't easily resolve server path to blob URL for preview without a proxy route.
                    // But we can add a 'video' layer with filePath set, and maybe a placeholder src?
                    // Or we just fetch the gallery to find the item?
                    // Strategy: If we find a video with this path in `videos` list (gallery), use its thumbnail/src.
                    // If not, just create a placeholder layer.

                    const layers = useStudioStore.getState().layers;
                    const existingBg = layers.find(l => l.type === 'video');

                    // Simple: Add layer with special property
                    // For now, let's assume the user might replace it, or we leave existing canvas if it's already set up? 
                    // Actually, if we are "editing", we should match the station.
                    // But since the Studio is Client-Side state, we might not have the assets loaded.
                    // Let's just warn or try our best.

                    if (!existingBg) {
                        const match = videos?.find(v => v.file_path === station.background_video_path);
                        const newLayer = {
                            id: uuidv4(),
                            type: 'video',
                            src: match ? getMediaUrl(match.thumbnail_path) : '', // Placeholder
                            filePath: station.background_video_path,
                            x: 0, y: 0, width: 1280, height: 720,
                            loop: true
                        };
                        useStudioStore.getState().addLayer(newLayer as any);
                    }
                }

            } catch (e) {
                console.error("Failed to load station", e);
                alert("스테이션 정보를 불러오는데 실패했습니다.");
            }
        };
        // Only run when videos are loaded or if we don't care about video matching immediately
        if (stationIdParam && videos) loadStation();
    }, [stationIdParam, videos]); // videos dependency to match background

    // Handle Reset Studio
    const handleResetStudio = () => {
        if (window.confirm("모든 디자인과 파일이 삭제됩니다.\n초기화 하시겠습니까?")) {
            useLofiStudioStore.getState().resetStudio();
        }
    };


    // Auto-switch to settings if layer selected
    useEffect(() => {
        if (selectedId) {
            setMainTab('settings');
            setIsCollapsed(false);
        }
    }, [selectedId]);

    // [MOVED UP]

    // Auto-switch to settings if layer selected



    // Fetch Channels
    const { data: channels, isLoading: channelsLoading } = useQuery({
        queryKey: ['captain-channels', DEMO_CAPTAIN_ID],
        queryFn: async () => {
            try {
                const res = await api.get(`/youtube/captain/${DEMO_CAPTAIN_ID}/channels`, { params: { role: 'MANAGER' } });
                return res.data;
            } catch (e) {
                const res = await api.get(`/captain/${DEMO_CAPTAIN_ID}/channels`, { params: { view: 'list' } });
                return res.data.channels || res.data;
            }
        }
    });

    const handleChannelToggle = (channelId: string) => {
        const currentIds = streamSettings.selectedChannelIds || [];
        if (currentIds.includes(channelId)) {
            setStreamSettings({
                selectedChannelIds: currentIds.filter(id => id !== channelId)
            });
        } else {
            setStreamSettings({
                selectedChannelIds: [...currentIds, channelId]
            });
        }
    };

    const toggleMultiStream = async () => {
        const targetIds = streamSettings.selectedChannelIds;
        if (!targetIds || targetIds.length === 0) return alert("방송할 채널을 하나 이상 선택해주세요 (Select at least one channel)");

        if (!streamSettings.rtmpUrl) return alert("RTMP URL is missing!");

        // Determine comprehensive state: Are we starting or stopping?
        // Simple logic: If ANY selected channel is active, we stop it? Or we start inactive ones?
        // Better: "Start All" starts inactive ones. "Stop All" stops active ones.
        // Let's implement a smart toggle:
        // If ALL selected are active -> Stop All.
        // Otherwise -> Start any inactive selected channels.

        const activeSelected = targetIds.filter(id => activeChannelIds.includes(id));
        const allSelectedAreActive = activeSelected.length === targetIds.length;

        if (allSelectedAreActive) {
            // STOP ALL SELECTED
            for (const id of targetIds) {
                try {
                    await axios.post('/stream/stop', { channel_id: id });
                    removeActiveChannel(id);
                } catch (e) {
                    console.error(`Failed to stop ${id}`, e);
                }
            }
        } else {
            // START INACTIVE SELECTED
            const toStart = targetIds.filter(id => !activeChannelIds.includes(id));
            for (const id of toStart) {
                const channel = channels?.find((c: any) => c.channel_id === id);
                if (!channel) continue;

                // Use channel-specific stream key if available, else global fallback
                // Logic change: streamSettings.streamKey might be global or channel specific.
                // Ideally each channel has its own key.
                const key = channel.stream_key || streamSettings.streamKey;

                try {
                    const payload = {
                        channel_id: id,
                        rtmp_url: streamSettings.rtmpUrl + (key && !streamSettings.rtmpUrl.includes(key) ? '/' + key : '')
                    };
                    console.log(`Starting stream for ${id}`, payload);
                    await axios.post('/stream/start', payload);
                    addActiveChannel(id);
                } catch (e) {
                    console.error(`Failed to start ${id}`, e);
                    // alert(`Failed to start ${channel.channel_name}`); // Don't spam alerts
                }
            }
        }
    };

    const selectedLayer = useStudioStore((state) => state.layers.find(l => l.id === state.selectedId));

    // --- Actions from LiveStudioDock ---
    const { addLayer, setLayers } = useStudioStore();

    const handleApplyTemplate = (template: StudioTemplate) => {
        if (!confirm('현재 레이아웃이 초기화됩니다. 계속하시겠습니까?')) return;
        const newLayers = template.layers.map(l => ({
            ...l,
            id: uuidv4()
        }));
        setLayers(newLayers);
        setRecipe(null); // Reset recipe if template applied manually? Or Keep? Let's keep for now.
    };

    const handleAddMedia = (video: VideoType) => {
        const fileUrl = resolveFileUrl(video.file_path);
        const thumbUrl = getMediaUrl(video.thumbnail_path);
        const isVideo = video.file_path.endsWith('.mp4') || video.file_path.endsWith('.webm');

        addLayer({
            type: isVideo ? 'video' : 'image',
            src: isVideo ? fileUrl : (thumbUrl || ''),
            videoSrc: isVideo ? fileUrl : undefined,
            x: 100, y: 100, width: 480, height: 270, scaleX: 1, scaleY: 1,
            id: undefined
        } as any);
    };



    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('subfolder', 'studio_uploads');

        try {
            // Using axios directly or api wrapper if it supports multipart
            // Assuming 'api' is an axios instance
            await api.post('/videos/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            // Refresh Library
            queryClient.invalidateQueries({ queryKey: ['studio-gallery-assets'] });
        } catch (error) {
            console.error("Upload failed", error);
            alert("업로드 실패: " + ((error as any).response?.data?.detail || (error as any).message));
        } finally {
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // --- Update Station Handler ---
    const handleUpdateStation = async () => {
        if (!editingStation) return;

        // 1. Validation (Same as Create)
        const bgLayer = layers.find(l => l.type === 'video');
        if (!bgLayer || !bgLayer.filePath) {
            alert('배경 비디오가 서버 파일이어야 합니다.');
            return;
        }

        const validTracks = lofiPlaylist.filter(t => t.filePath);
        if (validTracks.length === 0) {
            alert('재생목록이 유효하지 않습니다.');
            return;
        }

        try {
            // 1. Update Metadata (Only Name/BG, NOT RTMP)
            const payload: any = {};
            const backgroundPath = bgLayer.filePath;
            if (backgroundPath) payload.background_video_path = backgroundPath;

            await axios.patch(`/api/stations/${editingStation.id}`, payload);

            // 2. Update Playlist
            const tracks = validTracks.map(t => ({
                path: t.filePath || '',
                title: t.title,
                weight: 1
            }));
            if (tracks.length > 0) {
                await axios.post(`/api/stations/${editingStation.id}/playlist`, {
                    name: `${editingStation.name} Playlist`,
                    tracks_json: tracks
                });
            }

            alert("방송 디자인이 업데이트되었습니다.");

            // If station was Online, warn user?
            if (editingStation.status === 'ONLINE') {
                if (confirm("방송이 현재 송출 중입니다. 변경 사항을 적용하려면 방송을 재시작해야 합니다. 지금 재시작하시겠습니까?")) {
                    await axios.post(`/api/stations/${editingStation.id}/stop`);
                    setTimeout(async () => {
                        await axios.post(`/api/stations/${editingStation.id}/start`);
                        alert("방송이 재시작되었습니다.");
                    }, 2000);
                }
            } else {
                navigate('/station-manager');
            }

        } catch (e: any) {
            alert("업데이트 실패: " + e.message);
        }
    };

    // --- Headless Deploy Handler (Persistent Station) ---
    const handleCreateStation = async () => {
        // 1. Validation (Design Only)
        // Background Video check: We need at least one video layer or background path?
        // Actually, user might just want to register a design draft.
        // Let's at least enforce having a background layer for now, as the backend Station model expects `background_video_path`.

        let backgroundPath = '';
        const bgLayer = layers.find(l => l.type === 'video');

        if (bgLayer && bgLayer.src) {
            // Resolve file path logic (same as before)
            // Ideally we store the original path on the layer object to avoid guessing
            // For now assuming we can get it or use studio_assets path logic
            // If we really need a path for ffmpeg:
            // We'll rely on the fact that if it's a gallery item, we might have the path.
            // For now, let's just use a dummy or the layer's filePath if we added it.
            backgroundPath = (bgLayer as any).filePath || '';
        }

        if (!backgroundPath) {
            // Search in gallery map if we can?
            // Or prompt user?
            // Strict workflow: "Background Video Required"
            // But maybe we allow draft?
            // Let's ask user for Name first.
        }

        const name = prompt("방송 디자인 이름 (Station Name):", "New Broadcast Design");
        if (!name) return;

        try {
            // playlist
            const tracks = lofiPlaylist.map(t => ({
                path: t.filePath || t.src, // Prefer filePath
                title: t.title,
                duration: t.duration
            }));

            // 1. Create Station (No RTMP)
            const res = await axios.post('/api/stations/', {
                name: name,
                rtmp_url: "", // [CHANGED] Send empty string to avoid DB Null constraint
                background_video_path: backgroundPath || 'default_bg.mp4' // Fallback
            });
            const newStation = res.data;

            // 2. Save Playlist
            if (tracks.length > 0) {
                await axios.post(`/api/stations/${newStation.id}/playlist`, {
                    name: `${name} Playlist`,
                    tracks_json: tracks
                });
            }

            alert("방송 디자인이 등록되었습니다. 스테이션 관제탑으로 이동합니다.");
            navigate('/station-manager');

        } catch (e: any) {
            console.error(e);
            alert("방송 등록 실패: " + (e.response?.data?.detail || e.message));
        }
    };

    // --- Sub-Components ---
    const LibraryView = () => (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b border-gray-200">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-600" />
                    <input
                        type="text"
                        placeholder="자산 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-100 text-gray-900 text-xs rounded-md pl-8 pr-3 py-1.5 border border-transparent focus:bg-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                    />
                </div>
            </div>

            {/* Sub Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50/50">
                <button onClick={() => setLibTab('media')} className={`flex-1 py-2 text-[10px] font-bold uppercase ${libTab === 'media' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600'}`}>미디어</button>

            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-3">
                {libTab === 'media' && (
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="aspect-video bg-gray-50 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center text-slate-600 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 transition-all">
                            <Plus className="w-5 h-5 mb-1" />
                            <span className="text-xs">업로드</span>
                        </button>
                        {isAssetsLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto col-span-2" /> :
                            videos?.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase())).map(v => (
                                <div key={v.id} onClick={() => handleAddMedia(v)} className="aspect-video bg-gray-100 rounded overflow-hidden relative group cursor-pointer hover:ring-2 hover:ring-blue-500">
                                    <img src={getMediaUrl(v.thumbnail_path) || ''} className="w-full h-full object-cover" />
                                    <div className="absolute top-1 right-1 bg-black/60 px-1 rounded text-[9px] text-white">{v.file_path.endsWith('.mp4') ? 'VID' : 'IMG'}</div>
                                    {/* Delete Button */}
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (confirm('이 항목을 목록에서 제거하시겠습니까? (파일은 유지됩니다)')) {
                                                try {
                                                    await api.post('/videos/batch/delete', {
                                                        video_ids: [v.id],
                                                        keep_file: true
                                                    });
                                                    // Refetch
                                                    queryClient.invalidateQueries({ queryKey: ['studio-gallery-assets'] });
                                                } catch (err) {
                                                    alert("삭제 실패: " + err);
                                                }
                                            }
                                        }}
                                        className="absolute top-1 left-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                        title="목록에서 제거"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))
                        }
                    </div>
                )}


            </div>

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
        </div>
    );

    // --- Settings Views (Existing) ---
    const LofiPanel = () => {
        // Helper to upload file immediately
        const uploadAsset = async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('subfolder', 'studio_uploads');
            // Use upload_studio to avoid DB pollution
            const res = await api.post('/videos/upload_studio', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return res.data; // { file_path, filename }
        };

        return (
            <div className="space-y-3 animate-in fade-in duration-300">
                {/* Background Control */}
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm space-y-2">
                    <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                        <Image className="w-3 h-3" /> 배경 화면
                    </label>
                    <label className="flex-1 h-16 bg-gray-50 border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                        <Repeat className="w-5 h-5 text-slate-600 mb-0.5" />
                        <span className="text-[10px] text-gray-500">영상 선택</span>
                        <input type="file" className="hidden" accept="video/*" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                try {
                                    // 1. Upload
                                    const uploaded = await uploadAsset(file);

                                    // 2. Resolve URL
                                    // Convert windows path to media URL
                                    const mediaUrl = getMediaUrl(uploaded.file_path);

                                    const bgLayer = useStudioStore.getState().layers.find(l => l.type === 'video');
                                    if (bgLayer) {
                                        updateLayer(bgLayer.id, {
                                            src: mediaUrl,
                                            filePath: uploaded.file_path, // Store server path
                                            loop: true
                                        });
                                    } else {
                                        addLayer({
                                            type: 'video',
                                            src: mediaUrl,
                                            filePath: uploaded.file_path, // Store server path
                                            loop: true,
                                            x: 0, y: 0, width: 1280, height: 720, scaleX: 1, scaleY: 1
                                        } as any);
                                    }
                                } catch (err) {
                                    alert("배경 업로드 실패: " + err);
                                }
                            }
                        }} />
                    </label>
                </div>

                {/* Audio Playlist Control */}
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                            <Music className="w-3 h-3" /> 플레이리스트
                        </label>
                        <label className="cursor-pointer p-1 hover:bg-gray-100 rounded transition-colors">
                            <Plus className="w-3.5 h-3.5 text-blue-500" />
                            <input type="file" className="hidden" multiple accept="audio/*" onChange={async (e) => {
                                if (e.target.files) {
                                    const files = Array.from(e.target.files);
                                    for (const f of files) {
                                        try {
                                            const uploaded = await uploadAsset(f);
                                            const mediaUrl = getMediaUrl(uploaded.file_path);

                                            addToPlaylist({
                                                id: Math.random().toString(),
                                                title: f.name,
                                                src: mediaUrl,
                                                filePath: uploaded.file_path, // Critical for backend
                                                duration: 0
                                            });
                                        } catch (err) {
                                            console.error("Audio upload failed", err);
                                        }
                                    }
                                }
                            }} />
                        </label>
                    </div>

                    {/* Playback Order Controls */}
                    <div className="flex bg-gray-50 p-0.5 rounded-md border border-gray-200 gap-0.5">
                        <button
                            onClick={() => setPlaybackOrder('sequential')}
                            className={cn(
                                "flex-1 py-1 text-[9px] font-bold rounded transition-all",
                                playbackOrder === 'sequential' ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:bg-gray-200"
                            )}
                        >
                            순서
                        </button>
                        <button
                            onClick={() => setPlaybackOrder('random')}
                            className={cn(
                                "flex-1 py-1 text-[9px] font-bold rounded transition-all",
                                playbackOrder === 'random' ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:bg-gray-200"
                            )}
                        >
                            랜덤
                        </button>
                        <button
                            onClick={() => setPlaybackOrder('reverse')}
                            className={cn(
                                "flex-1 py-1 text-[9px] font-bold rounded transition-all",
                                playbackOrder === 'reverse' ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:bg-gray-200"
                            )}
                        >
                            역순
                        </button>
                    </div>

                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {lofiPlaylist.length === 0 && <p className="text-[10px] text-slate-600 text-center py-3">음악 파일 추가</p>}
                        {lofiPlaylist.map((track) => (
                            <div key={track.id} className="flex items-center justify-between p-1.5 bg-gray-50 rounded text-[10px]">
                                <span className="truncate flex-1 font-medium text-gray-700">{track.title}</span>
                                <button onClick={() => removeFromPlaylist(track.id)} className="text-red-400 hover:text-red-600 p-0.5">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        );
    };

    const WebinarPanel = () => (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4 animate-in fade-in">
            <label className="text-xs font-bold text-gray-500 flex items-center gap-2 pb-2 border-b border-gray-100">
                <Monitor className="w-3 h-3" /> 화면 공유 설정
            </label>
            <button className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors" onClick={() => alert("화면 공유 소스 선택 (구현 예정)")}>
                화면 소스 변경
            </button>
            <div className="flex items-center justify-between text-xs text-gray-600">
                <span>PIP 카메라</span>
                <input type="checkbox" defaultChecked className="toggle" />
            </div>
        </div>
    );

    return (
        <div
            onMouseEnter={() => setIsCollapsed(false)}
            onMouseLeave={() => setIsCollapsed(true)}
            className={`pointer-events-auto flex flex-col h-full transition-all duration-300 ease-in-out relative z-20 ml-auto shadow-2xl border-l border-gray-200 ${isCollapsed ? 'w-14 bg-white/0 hover:bg-white' : 'w-[225px] bg-white'
                }`}
        >
            {/* 1. Sidebar Toggle / Status Strip */}
            <div className={`flex flex-col items-center h-full py-4 gap-4 w-14 absolute left-0 top-0 z-30 transition-colors ${isCollapsed ? 'bg-transparent' : 'bg-gray-50 border-r border-gray-100'
                }`}>
                {/* Collapse Toggle */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
                    title={isCollapsed ? "메뉴 열기" : "메뉴 닫기"}
                >
                    {isCollapsed ? <Settings className="w-6 h-6" /> : <X className="w-6 h-6" />}
                </button>

                {/* Status Indicator */}
                <div className={`w-3 h-3 rounded-full ${isStreaming ? 'bg-red-500 animate-pulse ring-2 ring-red-200' : 'bg-green-500'}`} />

                {/* Main Tabs (Vertical) if Expanded, or just Icons */}
                <div className="flex flex-col gap-2 mt-4 w-full px-2">
                    <button
                        onClick={() => { setMainTab('settings'); setIsCollapsed(false); }}
                        className={cn("p-2 rounded-lg flex justify-center transition-colors", mainTab === 'settings' && !isCollapsed ? "bg-blue-100 text-blue-600" : "text-slate-600 hover:bg-gray-100")}
                        title="설정"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => { setMainTab('library'); setIsCollapsed(false); }}
                        className={cn("p-2 rounded-lg flex justify-center transition-colors", mainTab === 'library' && !isCollapsed ? "bg-blue-100 text-blue-600" : "text-slate-600 hover:bg-gray-100")}
                        title="라이브러리"
                    >
                        <FolderOpen className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* 2. Expanded Content Area */}
            {!isCollapsed && (
                <div className="flex-1 flex flex-col ml-16 h-full">
                    {/* Header */}
                    <div className="h-14 border-b border-gray-200 flex items-center justify-between px-5 bg-white flex-shrink-0">
                        <h3 className="font-bold text-gray-900 text-sm">
                            {mainTab === 'library' ? '라이브러리' :
                                (currentRecipe === 'lofi' ? '로파이 설정' : '제어 센터')}
                        </h3>

                        {/* [NEW] Export / Broadcast Actions */}
                        {mainTab === 'settings' && (
                            <div className="flex items-center gap-2">
                                {/* Only show 'Update Station' if we are in 'Edit Mode' */}
                                {editingStation ? (
                                    <button
                                        onClick={handleUpdateStation}
                                        className="px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-md hover:bg-green-600 flex items-center gap-1.5 shadow-sm"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        방송 업데이트
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={handleCreateStation}
                                            className="px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-md hover:bg-blue-600 flex items-center gap-1.5 shadow-sm"
                                            title="현재 디자인을 방송국으로 등록합니다"
                                        >
                                            <Radio className="w-3.5 h-3.5" />
                                            방송 등록
                                        </button>
                                        <button
                                            onClick={() => {
                                                const duration = prompt("영상 길이 (시간)를 입력하세요 (예: 1, 2)", "1");
                                                if (!duration) return;
                                                // Call render API
                                                // MVP: Alert logic for now
                                                const startRender = async () => {
                                                    try {
                                                        const { scenes, activeSceneId } = useLofiStudioStore.getState();
                                                        const scene = scenes.find(s => s.id === activeSceneId);
                                                        const playlist = lofiPlaylist;
                                                        await axios.post('/api/render/generate', {
                                                            scene,
                                                            playlist: playlist.map(t => ({ ...t, file_path: t.filePath })),
                                                            duration_minutes: parseInt(duration) * 60,
                                                            output_filename: `render_${Date.now()}`
                                                        });
                                                        alert("렌더링 작업이 시작되었습니다. (백엔드 로그 확인)");
                                                    } catch (e) { alert("렌더링 요청 실패"); }
                                                };
                                                startRender();
                                            }}
                                            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-md hover:bg-indigo-100 flex items-center gap-1.5 border border-indigo-100"
                                            title="긴 영상으로 추출"
                                        >
                                            <Video className="w-3.5 h-3.5" />
                                            영상 추출
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Body */}
                    {mainTab === 'library' ? (
                        <LibraryView />
                    ) : (
                        <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-gray-50/50">
                            {/* Settings Content */}
                            {selectedLayer ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    {/* Header / Type Info */}
                                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                        <div className="p-2 bg-blue-50 rounded text-blue-600">
                                            {selectedLayer.type === 'text' && <Type className="w-4 h-4" />}
                                            {selectedLayer.type === 'video' && <Video className="w-4 h-4" />}
                                            {selectedLayer.type === 'image' && <Image className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-gray-700">
                                                {selectedLayer.type === 'text' ? '텍스트 레이어' : (selectedLayer.type === 'video' ? '비디오 레이어' : '이미지 레이어')}
                                            </div>
                                            <div className="text-[10px] text-slate-600">
                                                ID: {selectedLayer.id.slice(0, 8)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* TEXT Specific Controls */}
                                    {selectedLayer.type === 'text' && (
                                        <>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500">텍스트 내용</label>
                                                <textarea
                                                    value={selectedLayer.text}
                                                    onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none h-24 transition-all"
                                                    placeholder="자막 내용을 입력하세요..."
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500">스타일</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {/* Font Family */}
                                                    <div className="col-span-2">
                                                        <select
                                                            value={selectedLayer.fontFamily || 'Pretendard'}
                                                            onChange={(e) => updateLayer(selectedLayer.id, { fontFamily: e.target.value })}
                                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-xs outline-none"
                                                        >
                                                            {!hasDynamicFonts && defaultFonts.map(font => (
                                                                <option key={font} value={font}>{font}</option>
                                                            ))}

                                                            {hasDynamicFonts && (
                                                                <>
                                                                    {koreanFonts.length > 0 && (
                                                                        <optgroup label="한국어">
                                                                            {koreanFonts.map((font: string) => <option key={font} value={font}>{font}</option>)}
                                                                        </optgroup>
                                                                    )}
                                                                    {englishFonts.length > 0 && (
                                                                        <optgroup label="English">
                                                                            {englishFonts.map((font: string) => <option key={font} value={font}>{font}</option>)}
                                                                        </optgroup>
                                                                    )}
                                                                    {otherFonts.length > 0 && (
                                                                        <optgroup label="Other">
                                                                            {otherFonts.map((font: string) => <option key={font} value={font}>{font}</option>)}
                                                                        </optgroup>
                                                                    )}
                                                                </>
                                                            )}
                                                        </select>
                                                    </div>

                                                    <div className="p-2 bg-gray-50 rounded border border-gray-200">
                                                        <label className="text-[10px] text-slate-600 block mb-1">크기 ({selectedLayer.fontSize}px)</label>
                                                        <input
                                                            type="range"
                                                            min="12"
                                                            max="200"
                                                            value={selectedLayer.fontSize || 40}
                                                            onChange={(e) => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })}
                                                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                        />
                                                    </div>
                                                    <div className="p-2 bg-gray-50 rounded border border-gray-200 flex items-center justify-between">
                                                        <label className="text-[10px] text-slate-600">색상</label>
                                                        <input
                                                            type="color"
                                                            value={selectedLayer.fill || '#ffffff'}
                                                            onChange={(e) => updateLayer(selectedLayer.id, { fill: e.target.value })}
                                                            className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                                                        />
                                                    </div>

                                                    {/* Alignment */}
                                                    <div className="col-span-2 flex gap-1 bg-gray-50 p-1 rounded border border-gray-200">
                                                        {['left', 'center', 'right'].map((align) => (
                                                            <button
                                                                key={align}
                                                                onClick={() => updateLayer(selectedLayer.id, { textAlign: align as any })}
                                                                className={cn(
                                                                    "flex-1 py-1 text-[10px] uppercase font-bold rounded hover:bg-white hover:shadow-sm transition-all",
                                                                    selectedLayer.textAlign === align ? "bg-white shadow text-blue-600" : "text-slate-600"
                                                                )}
                                                            >
                                                                {align}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* Animation */}
                                                    <div className="col-span-2">
                                                        <label className="text-[10px] text-slate-600 block mb-1">애니메이션</label>
                                                        <select
                                                            value={selectedLayer.animation || 'none'}
                                                            onChange={(e) => updateLayer(selectedLayer.id, { animation: e.target.value as any })}
                                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-xs outline-none"
                                                        >
                                                            <option value="none">없음</option>
                                                            <option value="fade">페이드 인 (Fade In)</option>
                                                            <option value="typewriter">타자기 효과 (Typewriter)</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* MEDIA (Video/Image) Specific Info */}
                                    {(selectedLayer.type === 'video' || selectedLayer.type === 'image') && (
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="bg-gray-50 p-2 rounded">
                                                    <span className="text-slate-600 block">너비</span>
                                                    <span className="font-mono">{Math.round(selectedLayer.width || 0)}px</span>
                                                </div>
                                                <div className="bg-gray-50 p-2 rounded">
                                                    <span className="text-slate-600 block">높이</span>
                                                    <span className="font-mono">{Math.round(selectedLayer.height || 0)}px</span>
                                                </div>
                                                <div className="bg-gray-50 p-2 rounded">
                                                    <span className="text-slate-600 block">X 좌표</span>
                                                    <span className="font-mono">{Math.round(selectedLayer.x || 0)}</span>
                                                </div>
                                                <div className="bg-gray-50 p-2 rounded">
                                                    <span className="text-slate-600 block">Y 좌표</span>
                                                    <span className="font-mono">{Math.round(selectedLayer.y || 0)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Global Delete Button (Visible for ALL types) */}
                                    <button
                                        onClick={() => {
                                            const { setLayers, layers } = useStudioStore.getState();
                                            setLayers(layers.filter(l => l.id !== selectedLayer.id));
                                            useStudioStore.setState({ selectedId: null });
                                        }}
                                        className="w-full py-3 bg-red-50 text-red-500 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2 mt-4"
                                    >
                                        <Trash2 className="w-4 h-4" /> 레이어 삭제
                                    </button>
                                </div>
                            ) : (
                                /* No Layer Selected -> Global Settings */
                                <>
                                    {/* Recipe Panels */}
                                    {currentRecipe === 'lofi' && <LofiPanel />}
                                    {currentRecipe === 'webinar' && <WebinarPanel />}

                                    {/* General Stream Controls - REMOVED for Strict Separation */}
                                    {/* Only show informative text or link to Tower */}
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-[10px] text-blue-800 space-y-1">
                                        <p className="font-bold">📢 워크플로우</p>
                                        <p>
                                            디자인 구성 후 <strong>스테이션 관제탑</strong>에서 송출 설정
                                        </p>
                                    </div>


                                </>
                            )}
                        </div>
                    )
                    }

                    {/* Footer: Action Button */}
                    <div className="p-5 border-t border-gray-200 bg-white">
                        {/* Dynamic Button: Register or Update */}
                        {editingStation ? (
                            <button
                                onClick={handleUpdateStation}
                                className="w-full py-4 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                디자인 업데이트
                            </button>
                        ) : (
                            <button
                                onClick={handleCreateStation}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Cast className="w-4 h-4" />
                                디자인 등록
                            </button>
                        )}
                    </div>
                </div >
            )
            }
        </div >
    );
};

