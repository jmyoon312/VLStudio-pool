import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, Server, Globe, HelpCircle } from 'lucide-react'; // Added HelpCircle
import { ServerSetupGuide } from './ServerSetupGuide';

interface StationConfigModalProps {
    station: any;
    channels: any[];
    onClose: () => void;
    onSave: () => void;
}

export const StationConfigModal: React.FC<StationConfigModalProps> = ({ station, channels, onClose, onSave }) => {
    // Config State
    const [rtmpUrl, setRtmpUrl] = useState(station.rtmp_url || '');
    const [serverMode, setServerMode] = useState<'local' | 'external'>(station.server_mode || 'local');
    const [channelId, setChannelId] = useState('');

    // Detailed External Settings
    const [extHost, setExtHost] = useState('');
    const [extPort, setExtPort] = useState('1935');
    const [extApp, setExtApp] = useState('live');
    const [extKey, setExtKey] = useState('');

    const [showGuide, setShowGuide] = useState(false);

    // Initial Setup
    useEffect(() => {
        // Try to match channel
        const matched = channels.find(c => station.rtmp_url && station.rtmp_url.includes(c.stream_key));
        if (matched) setChannelId(matched.channel_id);

        // Parse RTMP if in external mode (simple check)
        if (station.rtmp_url && station.server_mode === 'external') {
            try {
                // rtmp://HOST:PORT/APP/KEY
                const regex = /^rtmp:\/\/([^/:]+)(?::(\d+))?\/([^/]+)\/(.+)$/;
                const match = station.rtmp_url.match(regex);
                if (match) {
                    setExtHost(match[1]);
                    setExtPort(match[2] || '1935');
                    setExtApp(match[3]);
                    setExtKey(match[4]);
                } else {
                    // Fallback parse attempt
                    // rtmp://HOST/APP/KEY (no port)
                    const regexNoPort = /^rtmp:\/\/([^/]+)\/([^/]+)\/(.+)$/;
                    const match2 = station.rtmp_url.match(regexNoPort);
                    if (match2) {
                        setExtHost(match2[1]);
                        setExtApp(match2[2]);
                        setExtKey(match2[3]);
                    }
                }
            } catch (e) {
                console.warn("RTMP Parse error", e);
            }
        }
    }, []);

    // Effect: Sync External Fields to RTMP URL
    useEffect(() => {
        if (serverMode === 'external') {
            if (extHost && extApp && extKey) {
                const portPart = extPort && extPort !== '1935' ? `:${extPort}` : '';
                const newUrl = `rtmp://${extHost}${portPart}/${extApp}/${extKey}`;
                setRtmpUrl(newUrl);
            }
        }
    }, [extHost, extPort, extApp, extKey, serverMode]);

    const handleSave = async () => {
        try {
            await axios.patch(`/api/stations/${station.id}`, {
                rtmp_url: rtmpUrl,
                server_mode: serverMode
            });
            alert("방송 설정이 저장되었습니다.");
            onSave();
        } catch (e) {
            alert("설정 저장 실패");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl p-0 overflow-hidden flex flex-col max-h-[85vh] text-foreground">
                <div className="p-6 border-b border-border bg-muted/30 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">방송 송출 설정 (Broadcast Config)</h2>
                        <p className="text-sm text-muted-foreground">{station.name}</p>
                    </div>
                    <Settings className="w-6 h-6 text-muted-foreground" />
                </div>

                <div className="p-6 space-y-8 overflow-y-auto">
                    {/* 1. Server Mode */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Server className="w-4 h-4" /> 송출 서버 선택
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setServerMode('local')}
                                className={`p-3 rounded-xl border text-left transition-all ${serverMode === 'local' ? 'border-indigo-600 bg-indigo-500/10 ring-2 ring-indigo-500/20' : 'border-border hover:bg-muted'}`}
                            >
                                <div className="text-sm font-bold text-foreground">로컬 서버 (Local)</div>
                                <div className="text-xs text-muted-foreground mt-1">현재 PC에서 직접 송출합니다.</div>
                            </button>
                            <button
                                onClick={() => setServerMode('external')}
                                className={`p-3 rounded-xl border text-left transition-all ${serverMode === 'external' ? 'border-indigo-600 bg-indigo-500/10 ring-2 ring-indigo-500/20' : 'border-border hover:bg-muted'}`}
                            >
                                <div className="text-sm font-bold text-foreground">외부 서버 (Relay)</div>
                                <div className="text-xs text-muted-foreground mt-1">외부 릴레이/클라우드 서버 사용</div>
                            </button>
                        </div>
                    </div>

                    {/* 2. Detailed Settings */}
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            {serverMode === 'local' ? '송출 대상 (Output)' : '외부 서버 정보 (External Server Info)'}
                        </label>

                        {serverMode === 'local' ? (
                            /* LOCAL MODE UI */
                            <>
                                <div className="space-y-2">
                                    <select
                                        className="w-full p-3 border border-border bg-background text-foreground rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
                                        value={channelId}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setChannelId(val);
                                            const ch = channels.find(c => c.channel_id === val);
                                            if (ch && ch.stream_key) {
                                                setRtmpUrl(`rtmp://a.rtmp.youtube.com/live2/${ch.stream_key}`);
                                            }
                                        }}
                                    >
                                        <option value="" className="bg-background text-foreground">-- 채널 선택 (YT 자동 설정) --</option>
                                        {channels.map(c => (
                                            <option key={c.channel_id} value={c.channel_id} className="bg-background text-foreground">
                                                {c.channel_name || c.title} ({c.channel_id.slice(0, 6)}...)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground font-bold mb-1 block">RTMP URL (수동 입력)</label>
                                    <input
                                        value={rtmpUrl}
                                        onChange={(e) => setRtmpUrl(e.target.value)}
                                        className="w-full border border-border bg-background text-foreground rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
                                        placeholder="rtmp://..."
                                    />
                                </div>
                            </>
                        ) : (
                            /* EXTERNAL MODE UI */
                            <div className="space-y-4 p-4 bg-muted/20 border border-border rounded-lg">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase">Server Config</h4>
                                    <button
                                        onClick={() => setShowGuide(true)}
                                        className="text-xs bg-card border border-border px-2 py-1 rounded shadow-sm hover:bg-muted text-foreground font-bold flex items-center gap-1 transition-colors"
                                    >
                                        <HelpCircle className="w-3 h-3" />
                                        서버 구축 가이드 보기
                                    </button>
                                </div>

                                <div className="grid grid-cols-[2fr_1fr] gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground block mb-1">서버 주소 (IP/Domain)</label>
                                        <input
                                            value={extHost}
                                            onChange={(e) => setExtHost(e.target.value)}
                                            className="w-full border border-border bg-background text-foreground rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="123.45.67.89"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground block mb-1">포트 (Port)</label>
                                        <input
                                            value={extPort}
                                            onChange={(e) => setExtPort(e.target.value)}
                                            className="w-full border border-border bg-background text-foreground rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="1935"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-[1fr_2fr] gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground block mb-1">App Name</label>
                                        <input
                                            value={extApp}
                                            onChange={(e) => setExtApp(e.target.value)}
                                            className="w-full border border-border bg-background text-foreground rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            placeholder="live"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground block mb-1">Stream Key</label>
                                        <input
                                            value={extKey}
                                            onChange={(e) => setExtKey(e.target.value)}
                                            className="w-full border border-border bg-background text-foreground rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                                            placeholder="stream_key"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-border">
                                    <label className="text-xs font-bold text-muted-foreground block mb-1">최종 RTMP URL (자동 생성)</label>
                                    <div className="w-full bg-muted/30 border border-border rounded px-3 py-2 font-mono text-xs text-muted-foreground break-all">
                                        {rtmpUrl || '(설정 정보를 입력하세요)'}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-border bg-muted/30 flex justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-muted-foreground hover:bg-muted rounded-lg font-medium"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-500/10 transition-all hover:translate-y-px"
                    >
                        설정 저장
                    </button>
                </div>
            </div>

            <ServerSetupGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
        </div>
    );
};
