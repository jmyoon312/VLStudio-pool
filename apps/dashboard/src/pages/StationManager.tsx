import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Play, Square, Settings, Radio, Plus, RefreshCw, AlertCircle, Cast, Server, Globe, Trash2, Music, Video } from 'lucide-react';
import api from "@/lib/api"; // Ensure api key is imported

import { StationConfigModal } from './components/StationConfigModal';

interface Station {
    id: number;
    name: string;
    rtmp_url: string;
    status: 'OFFLINE' | 'STARTING' | 'ONLINE' | 'ERROR';
    current_playlist_id?: number;
    pid?: number;
    last_error?: string;
    thumbnail_path?: string;
    server_mode?: 'local' | 'external';
    background_video_path?: string;
}

export default function StationManager() {
    const [stations, setStations] = useState<Station[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const [showConfigModal, setShowConfigModal] = useState(false);
    const [selectedStation, setSelectedStation] = useState<Station | null>(null);
    const [channels, setChannels] = useState<any[]>([]);

    // Form State (Create)
    const [newName, setNewName] = useState('');
    const [newBgPath, setNewBgPath] = useState(''); // No RTMP at create

    // Form State (Config)
    const [configRtmp, setConfigRtmp] = useState('');
    const [configChannelId, setConfigChannelId] = useState('');
    const [configServerMode, setConfigServerMode] = useState<'local' | 'external'>('local');

    // Playlist Preview
    const [previewPlaylist, setPreviewPlaylist] = useState<{ name: string, tracks: any[] } | null>(null);
    const [showPlaylistModal, setShowPlaylistModal] = useState(false);

    // Video Preview State
    const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
    const [showVideoModal, setShowVideoModal] = useState(false);

    // [NEW] Selection Mode
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const fetchStations = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/stations/');
            setStations(res.data);
        } catch (err: any) {
            console.error("Failed to fetch stations", err);
            if (err.response?.status === 404) {
                // Ignore 404 initially if backend restarting
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchChannels = async () => {
        try {
            // [FIX] Dynamic Captain ID
            // 1. Get Active Captain
            const profileRes = await api.get('/resources/profiles?type=CAPTAIN&status=ACTIVE');
            const profiles = profileRes.data;

            if (!profiles || profiles.length === 0) {
                console.warn("No active captain profile found for StationManager.");
                setChannels([]);
                return;
            }

            const captainId = profiles[0].id;

            // 2. Fetch Channels for that Captain
            const res = await api.get(`/youtube/captain/${captainId}/channels`);
            setChannels(res.data);
        } catch (e) {
            console.error("Failed to fetch channels", e);
        }
    };


    const fetchPlaylist = async (stationId: number) => {
        try {
            const res = await axios.get(`/api/stations/${stationId}/playlist`);
            // Backend might return { name: string, tracks: [...] } or { name: string, tracks_json: [...] }
            // Or sometimes the station object itself with a `playlist` relation.
            // Let's assume standard response from /playlist endpoint.
            const tracks = res.data.tracks || res.data.tracks_json || [];

            setPreviewPlaylist({
                name: res.data.name || '플레이리스트',
                tracks: Array.isArray(tracks) ? tracks : []
            });
            setShowPlaylistModal(true);
        } catch (e) {
            console.error(e);
            alert("플레이리스트 정보를 불러올 수 없습니다.");
        }
    }

    useEffect(() => {
        console.log("StationManager Mounted");
        fetchStations();
        fetchChannels();
    }, []);



    const handleCreate = async () => {
        if (!newName) return alert("스테이션 이름을 입력해주세요.");
        try {
            // Strict Separation: No RTMP at create
            await axios.post('/api/stations/', {
                name: newName,
                rtmp_url: null,
                background_video_path: newBgPath || ''
            });
            setShowCreateModal(false);
            setNewName('');
            setNewBgPath('');
            fetchStations();
        } catch (err) {
            alert("스테이션 생성 실패");
        }
    };

    const openConfig = (station: Station) => {
        setSelectedStation(station);
        setConfigRtmp(station.rtmp_url || '');
        setConfigServerMode(station.server_mode || 'local');

        const matched = channels.find(c => station.rtmp_url && station.rtmp_url.includes(c.stream_key));
        setConfigChannelId(matched ? matched.channel_id : '');
        setShowConfigModal(true);
    };

    const handleSaveConfig = async () => {
        if (!selectedStation) return;
        try {
            await axios.patch(`/api/stations/${selectedStation.id}`, {
                rtmp_url: configRtmp,
                server_mode: configServerMode
            });
            alert("방송 설정이 저장되었습니다.");
            setShowConfigModal(false);
            fetchStations();
        } catch (e) {
            alert("설정 저장 실패");
        }
    };

    const handleStart = async (id: number) => {
        if (!confirm("방송을 시작하시겠습니까?")) return;
        try {
            await axios.post(`/api/stations/${id}/start`);
            // Poll for status update
            setTimeout(fetchStations, 1000);
            setTimeout(fetchStations, 3000);
        } catch (err: any) {
            alert("시작 실패: " + (err.response?.data?.detail || err.message));
        }
    };

    const handleStop = async (id: number) => {
        if (!confirm("방송을 종료하시겠습니까?")) return;
        try {
            await axios.post(`/api/stations/${id}/stop`);
            setTimeout(fetchStations, 1000);
        } catch (err) {
            alert("종료 실패");
        }
    };

    const handleDelete = async (station: Station) => {
        if (station.status === 'ONLINE') return alert("방송 중인 스테이션은 삭제할 수 없습니다. 먼저 방송을 종료해주세요.");
        if (!confirm(`'${station.name}' 스테이션을 정말 삭제하시겠습니까?`)) return;

        try {
            await axios.delete(`/api/stations/${station.id}`);
            fetchStations();
        } catch (e) {
            alert("삭제 실패");
        }
    };

    // [NEW] Batch Selection Logic
    const toggleSelection = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`선택한 ${selectedIds.size}개의 스테이션을 정말 삭제하시겠습니까?`)) return;

        try {
            // Sequential delete or Promise.all
            // Simple loop for now
            for (const id of Array.from(selectedIds)) {
                const st = stations.find(s => s.id === id);
                if (st && st.status === 'ONLINE') {
                    console.warn(`Skipping ONLINE station ${st.name}`);
                    continue;
                }
                await axios.delete(`/api/stations/${id}`);
            }
            setSelectedIds(new Set());
            setIsSelectionMode(false);
            fetchStations();
            alert("삭제 완료");
        } catch (e) {
            alert("일부 스테이션 삭제 실패");
            fetchStations();
        }
    };

    const toggleSelectionMode = () => {
        if (isSelectionMode) {
            setIsSelectionMode(false);
            setSelectedIds(new Set());
        } else {
            setIsSelectionMode(true);
        }
    };



    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 bg-background text-foreground min-h-screen">
            <header className="flex items-center justify-between">
                <div />
                <div className="flex gap-2">
                    <button
                        onClick={fetchStations}
                        className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                        title="새로고침"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    {/* [NEW] Delete & Selection Controls */}
                    {isSelectionMode ? (
                        <>
                            <button
                                onClick={handleBatchDelete}
                                disabled={selectedIds.size === 0}
                                className="px-4 py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" /> 삭제 ({selectedIds.size})
                            </button>
                            <button
                                onClick={toggleSelectionMode}
                                className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg font-medium"
                            >
                                취소
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={toggleSelectionMode}
                            className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                            title="선택 모드"
                        >
                            <span className="text-xs font-bold">선택</span>
                        </button>
                    )}



                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-sm font-bold transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" /> 새 스테이션 만들기
                    </button>
                </div>
            </header>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stations.map(station => (
                    <div
                        key={station.id}
                        className={`bg-card rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-all group flex flex-col relative ${selectedIds.has(station.id) ? 'ring-2 ring-indigo-600 border-indigo-600 bg-indigo-500/10' : 'border-border'}`}
                        onClick={() => {
                            if (isSelectionMode) toggleSelection(station.id);
                        }}
                    >
                        {/* [NEW] Selection Overlay */}
                        {isSelectionMode && (
                            <div className="absolute inset-0 z-50 cursor-pointer flex items-start justify-end p-3">
                                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${selectedIds.has(station.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-card border-border'}`}>
                                    {selectedIds.has(station.id) && <div className="w-2.5 h-1.5 border-b-2 border-l-2 border-white -rotate-45 mb-0.5" />}
                                </div>
                            </div>
                        )}

                        {/* Thumbnail Preview Area */}
                        <div className="w-full aspect-video bg-card border-b border-border relative overflow-hidden group/thumb">
                            {station.thumbnail_path ? (
                                <img
                                    src={station.thumbnail_path}
                                    className="w-full h-full object-cover"
                                    alt="Station Preview"
                                    onError={(e) => {
                                        // 1x1 Transparent Pixel
                                        (e.target as HTMLImageElement).src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
                                        (e.target as HTMLImageElement).onerror = null;
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-muted">
                                    <div className="text-center">
                                        <Cast className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <span className="text-xs">No Preview</span>
                                    </div>
                                </div>
                            )}

                            {/* Overlay Controls */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-4">
                                <Link
                                    to={`/live-studio?stationId=${station.id}`}
                                    className="w-32 py-2 bg-background text-foreground rounded-lg text-sm font-bold hover:bg-muted flex items-center justify-center gap-2 shadow-lg hover:scale-105 transition-transform"
                                >
                                    <Cast className="w-4 h-4" /> 채널 편집
                                </Link>
                                <button
                                    onClick={() => fetchPlaylist(station.id)}
                                    className="w-32 py-2 bg-muted/20 text-foreground backdrop-blur-sm rounded-lg text-sm font-bold hover:bg-muted/30 flex items-center justify-center gap-2 shadow-lg hover:scale-105 transition-transform"
                                >
                                    <Server className="w-4 h-4" /> 오디오 목록
                                </button>
                                {station.background_video_path && (
                                    <button
                                        onClick={() => {
                                            const path = station.background_video_path!;
                                            // Handle local vs http
                                            const url = path.startsWith('http')
                                                ? path
                                                : `/api/stream?path=${encodeURIComponent(path)}`;
                                            console.log("Playing Video:", url);
                                            setPreviewVideoUrl(url);
                                            setShowVideoModal(true);
                                        }}
                                        className="w-32 py-2 bg-indigo-600/80 text-white backdrop-blur-sm rounded-lg text-sm font-bold hover:bg-indigo-600 flex items-center justify-center gap-2 shadow-lg hover:scale-105 transition-transform"
                                    >
                                        <Video className="w-4 h-4" /> 동영상 보기
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-5 flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                                        {station.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`w-2.5 h-2.5 rounded-full ${station.status === 'ONLINE' ? 'bg-green-500 animate-pulse' :
                                            station.status === 'ERROR' ? 'bg-red-500' :
                                                !station.rtmp_url ? 'bg-amber-500' : 'bg-muted'
                                            }`} />
                                        <span className={`text-sm font-bold uppercase tracking-wide ${station.status === 'ONLINE' ? 'text-green-600 dark:text-green-400' :
                                            station.status === 'ERROR' ? 'text-red-600' :
                                                !station.rtmp_url ? 'text-amber-500' : 'text-muted-foreground'
                                            }`}>
                                            {station.status === 'ONLINE' ? '방송 중' :
                                                station.status === 'STARTING' ? '시작 중...' :
                                                    station.status === 'ERROR' ? '오류 발생' :
                                                        !station.rtmp_url ? '설정 필요 (DRAFT)' : '준비됨 (READY)'}
                                        </span>
                                        {station.pid && <span className="text-xs text-muted-foreground font-mono">PID: {station.pid}</span>}
                                        {station.server_mode === 'external' && <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">RELAY</span>}
                                    </div>
                                </div>
                                {!isSelectionMode && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(station);
                                        }}
                                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors absolute top-5 right-5"
                                        title="스테이션 삭제"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <div className="text-sm text-muted-foreground space-y-2 mb-6 bg-muted/30 p-3 rounded-lg border border-border">
                                <div className="flex justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">현재 플레이리스트</span>
                                    <span className="font-bold text-foreground">{station.current_playlist_id ? `#${station.current_playlist_id}` : '미지정'}</span>
                                </div>
                                <div className="flex justify-between items-center group/url">
                                    <span className="text-xs font-medium text-muted-foreground">송출 대상</span>
                                    <span className="font-mono text-xs truncate max-w-[150px] opacity-50 group-hover/url:opacity-100 transition-opacity text-foreground">
                                        {station.rtmp_url || '-'}
                                    </span>
                                </div>
                            </div>

                            {station.last_error && (
                                <div className="mb-4 p-2 bg-red-500/10 text-red-500 text-xs rounded border border-red-500/20 flex gap-2 break-all">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    {station.last_error}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 mt-auto">
                                {station.status === 'ONLINE' ? (
                                    <button
                                        onClick={() => handleStop(station.id)}
                                        className="py-2.5 px-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500/20 flex items-center justify-center gap-2 text-sm font-bold transition-colors"
                                    >
                                        <Square className="w-4 h-4" /> 방송 종료
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleStart(station.id)}
                                        disabled={!station.rtmp_url}
                                        className={`py-2.5 px-3 border rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-colors ${!station.rtmp_url
                                            ? 'bg-muted text-muted-foreground border-border cursor-not-allowed'
                                            : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/20'
                                            }`}
                                    >
                                        <Play className="w-4 h-4" /> 방송 시작
                                    </button>
                                )}
                                <button
                                    onClick={() => openConfig(station)}
                                    className="py-2.5 px-3 bg-card text-foreground border border-border rounded-lg hover:bg-muted flex items-center justify-center gap-2 text-sm font-bold transition-colors"
                                >
                                    <Settings className="w-4 h-4" /> 설정
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Playlist Preview Modal */}
            {showPlaylistModal && previewPlaylist && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col text-foreground">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30 rounded-t-2xl">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Server className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                {previewPlaylist.name}
                            </h3>
                            <button onClick={() => setShowPlaylistModal(false)} className="text-muted-foreground hover:text-foreground bg-muted rounded-full p-1 w-8 h-8 flex items-center justify-center">
                                ✕
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 space-y-2">
                            {previewPlaylist.tracks.length === 0 && (
                                <div className="text-center py-10 space-y-2">
                                    <Music className="w-12 h-12 mx-auto text-muted-foreground opacity-55" />
                                    <p className="text-muted-foreground">트랙이 없습니다.</p>
                                </div>
                            )}
                            {previewPlaylist.tracks.map((track, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg border border-transparent hover:border-border transition-all">
                                    <div className="w-8 h-8 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center text-xs font-bold font-mono">
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-foreground text-sm truncate">{track.title || track.name || track.path ? (track.title || track.name || (track.path ? track.path.split('/').pop() : 'Unknown Track')) : 'Unknown Track'}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                                            {track.artist && <span className="text-muted-foreground">{track.artist}</span>}
                                            {track.duration && <span>• {Math.floor(track.duration)}s</span>}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100 text-foreground">
                        <h2 className="text-xl font-bold mb-1 text-foreground">새 스테이션 만들기 (Draft)</h2>
                        <p className="text-sm text-muted-foreground mb-6">방송 디자인 초안을 생성합니다. 송출 설정은 이후에 진행합니다.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-muted-foreground mb-1">스테이션 이름</label>
                                <input
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    className="w-full border border-border bg-background text-foreground rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="예: Morning Lofi Radio"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-muted-foreground mb-1">배경 영상 경로 (Optional)</label>
                                <input
                                    value={newBgPath}
                                    onChange={e => setNewBgPath(e.target.value)}
                                    className="w-full border border-border bg-background text-foreground rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="C:\assets\background_loop.mp4"
                                />
                                <p className="text-xs text-muted-foreground mt-1">스튜디오에서 편집 시 변경할 수 있습니다.</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-5 py-2.5 text-muted-foreground hover:bg-muted rounded-lg font-medium transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleCreate}
                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-500/10 transition-all hover:shadow-xl hover:-translate-y-0.5"
                            >
                                스테이션 생성
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Config Modal */}
            {showConfigModal && selectedStation && (
                <StationConfigModal
                    station={selectedStation}
                    channels={channels}
                    onClose={() => setShowConfigModal(false)}
                    onSave={() => {
                        setShowConfigModal(false);
                        fetchStations();
                    }}
                />
            )}

            {/* Playlist Preview Modal */}
            {showPlaylistModal && previewPlaylist && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] text-foreground">
                        <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600 dark:text-purple-400">
                                    <Server className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground">{previewPlaylist.name}</h3>
                                    <p className="text-xs text-muted-foreground">{previewPlaylist.tracks.length} Tracks</p>
                                </div>
                            </div>
                            <button onClick={() => {
                                setShowPlaylistModal(false);
                                if ((window as any).currentAudio) {
                                    (window as any).currentAudio.pause();
                                    (window as any).currentAudio = null;
                                }
                            }} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted">
                                ✕
                            </button>
                        </div>

                        <div className="overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {previewPlaylist.tracks.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Music className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                    <p>트랙이 없습니다.</p>
                                </div>
                            ) : (
                                previewPlaylist.tracks.map((track: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 bg-muted/10 rounded-xl hover:bg-muted/20 transition-colors group">
                                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg font-bold text-xs">
                                            {idx + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-sm text-foreground truncate">
                                                {track.name || track.filename || `Track ${idx + 1}`}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                <span>• {Math.floor(track.duration || 0)}s</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const path = track.path || track.file_path;
                                                if (!path) return alert("파일 경로가 없습니다.");

                                                // Stop previous direct usage
                                                if ((window as any).currentAudio) {
                                                    (window as any).currentAudio.pause();
                                                }

                                                const url = path.startsWith('http') ? path : `/api/stream?path=${encodeURIComponent(path)}`;
                                                const audio = new Audio(url);
                                                audio.play();
                                                (window as any).currentAudio = audio;
                                            }}
                                            className="p-2 bg-card text-foreground border border-border rounded-lg hover:bg-purple-500/10 hover:text-purple-600 hover:border-purple-500/20 shadow-sm transition-all"
                                        >
                                            <Play className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Video Preview Modal */}
            {showVideoModal && previewVideoUrl && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="relative w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
                        <button
                             onClick={() => setShowVideoModal(false)}
                             className="absolute top-4 right-4 z-10 text-white/50 hover:text-white bg-black/50 rounded-full p-2"
                        >
                            ✕
                        </button>
                        <video
                            src={previewVideoUrl}
                            controls
                            autoPlay
                            className="w-full h-full object-contain"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
