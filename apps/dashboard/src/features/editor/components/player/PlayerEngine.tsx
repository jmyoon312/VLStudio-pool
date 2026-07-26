import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';

export const PlayerEngine = () => {
    const { width, height } = useEditorStore(state => ({ width: state.width, height: state.height }));
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const videoCache = useRef<Record<string, HTMLVideoElement>>({});
    const audioCache = useRef<Record<string, HTMLAudioElement>>({});
    const imageCache = useRef<Record<string, HTMLImageElement>>({});
    
    useEffect(() => {
        let animationFrameId: number;
        let lastTime = performance.now();
        
        const renderLoop = () => {
            const state = useEditorStore.getState();
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            
            if (!canvas || !ctx) return;
            
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, state.width, state.height);
            
            const playhead = state.playhead;
            const items = Object.values(state.items).sort((a, b) => a.layer - b.layer);
            
            items.forEach(item => {
                const track = state.tracks.find(t => t.id === item.trackId);
                if (!track || track.isHidden) return;

                const isVisible = playhead >= item.startTime && playhead < item.startTime + item.duration;
                
                if (isVisible) {
                    const relativeTime = (playhead - item.startTime + item.offset) / 1000;
                    const resolveMediaUrl = (src: string) => {
                        if (!src) return src;
                        let url = src;
                        try {
                            const decoded = decodeURIComponent(src);
                            if (decoded.includes('path=/temp/')) {
                                const m = decoded.match(/path=(\/temp\/[^&]+)/);
                                if (m) return m[1];
                            }
                            if (decoded.includes('path=/media/')) {
                                const m = decoded.match(/path=(\/media\/[^&]+)/);
                                if (m) return m[1];
                            }
                            if (url.includes('/api/io/stream')) {
                                url = url.replace('/api/io/stream', '/api/files/stream');
                            }
                        } catch(e) {}
                        return url;
                    };

                    if (item.type === 'video') {
                        let video = videoCache.current[item.id];
                        if (!video) {
                            video = document.createElement('video');
                            video.src = resolveMediaUrl(item.source);
                            video.crossOrigin = "anonymous";
                            video.muted = true;
                            video.playsInline = true;
                            videoCache.current[item.id] = video;
                        }
                        
                        if (state.isPlaying) {
                            if (video.paused) video.play().catch(() => {});
                            // Only force sync if drift is large while playing to prevent stutter
                            if (Math.abs(video.currentTime - relativeTime) > 0.3) {
                                video.currentTime = relativeTime;
                            }
                        } else {
                            if (!video.paused) video.pause();
                            // Precise seeking when paused
                            if (Math.abs(video.currentTime - relativeTime) > 0.03) {
                                video.currentTime = relativeTime;
                            }
                        }
                        
                        if (video.readyState >= 2) {
                            ctx.save();
                            ctx.translate(state.width / 2 + item.transform.x, state.height / 2 + item.transform.y);
                            ctx.rotate((item.transform.rotation * Math.PI) / 180);
                            ctx.scale(item.transform.scale, item.transform.scale);
                            ctx.globalAlpha = item.transform.opacity;
                            ctx.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2, video.videoWidth, video.videoHeight);
                            ctx.restore();
                        }
                    }
                    
                    if (item.type === 'image') {
                        let img = imageCache.current[item.id];
                        if (!img) {
                            img = new Image();
                            img.src = resolveMediaUrl(item.source);
                            img.crossOrigin = "anonymous";
                            imageCache.current[item.id] = img;
                        }
                        
                        if (img.complete) {
                            ctx.save();
                            ctx.translate(state.width / 2 + item.transform.x, state.height / 2 + item.transform.y);
                            ctx.rotate((item.transform.rotation * Math.PI) / 180);
                            ctx.scale(item.transform.scale, item.transform.scale);
                            ctx.globalAlpha = item.transform.opacity;
                            ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
                            ctx.restore();
                        }
                    }
                    
                    if (item.type === 'text') {
                        const content = item.properties.content || 'Text';
                        ctx.save();
                        ctx.translate(state.width / 2 + item.transform.x, state.height / 2 + item.transform.y);
                        ctx.rotate((item.transform.rotation * Math.PI) / 180);
                        ctx.scale(item.transform.scale, item.transform.scale);
                        ctx.globalAlpha = item.transform.opacity;
                        
                        ctx.font = `${item.properties.fontWeight || 'bold'} ${item.properties.fontSize || 100}px ${item.properties.fontFamily || 'Arial'}`;
                        ctx.fillStyle = item.properties.color || '#ffffff';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        
                        if (item.properties.strokeColor) {
                            ctx.strokeStyle = item.properties.strokeColor;
                            ctx.lineWidth = item.properties.strokeWidth || 5;
                            ctx.strokeText(content, 0, 0);
                        }
                        ctx.fillText(content, 0, 0);
                        ctx.restore();
                    }
                    
                    if (item.type === 'audio' || (item.type === 'video' && !track.isMuted)) {
                        let audioId = `audio-${item.id}`;
                        let audio = audioCache.current[audioId];
                        if (!audio) {
                            audio = new Audio(resolveMediaUrl(item.source));
                            audioCache.current[audioId] = audio;
                        }
                        
                        if (state.isPlaying) {
                            if (audio.paused) audio.play().catch(() => {});
                            if (Math.abs(audio.currentTime - relativeTime) > 0.3) {
                                audio.currentTime = relativeTime;
                            }
                        } else {
                            if (!audio.paused) audio.pause();
                            if (Math.abs(audio.currentTime - relativeTime) > 0.03) {
                                audio.currentTime = relativeTime;
                            }
                        }
                        
                        audio.volume = (track.volume / 100) * (item.properties.volume !== undefined ? item.properties.volume / 100 : 1);
                    }
                    
                } else {
                    if (item.type === 'video' && videoCache.current[item.id]) {
                        videoCache.current[item.id].pause();
                    }
                    if (audioCache.current[`audio-${item.id}`]) {
                        audioCache.current[`audio-${item.id}`].pause();
                    }
                }
            });
            
            if (state.isPlaying) {
                const now = performance.now();
                const delta = now - lastTime;
                
                const newPlayhead = state.playhead + delta;
                if (newPlayhead >= state.duration) {
                    state.setPlayhead(0);
                    state.togglePlay();
                } else {
                    state.setPlayhead(newPlayhead);
                }
            }
            lastTime = performance.now();
            
            animationFrameId = requestAnimationFrame(renderLoop);
        };
        
        animationFrameId = requestAnimationFrame(renderLoop);
        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden relative select-none">
            <div 
                className="relative bg-black shadow-2xl ring-1 ring-border/50 rounded-md overflow-hidden"
                style={{
                    aspectRatio: `${width} / ${height}`,
                    maxHeight: '100%',
                    maxWidth: '100%'
                }}
            >
                <canvas 
                    ref={canvasRef} 
                    width={width} 
                    height={height}
                    className="w-full h-full pointer-events-none"
                />
            </div>
        </div>
    );
};
