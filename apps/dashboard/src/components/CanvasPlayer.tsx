import React, { useRef, useEffect, useState, useMemo } from 'react';
import Moveable, { OnDrag, OnResize, OnRotate, OnDragEnd, OnResizeEnd, OnRotateEnd } from 'react-moveable';
import Selecto from 'react-selecto';
import { useEditorStore } from '../hooks/useEditorStore';
import { cn } from '@/lib/utils';

// Helper to parse translate(x, y)
const parseTransform = (transform: string) => {
    const translate = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
    const rotate = transform.match(/rotate\(([^)]+)deg\)/);
    const scale = transform.match(/scale\(([^)]+)\)/);

    return {
        x: translate ? parseFloat(translate[1]) : 0,
        y: translate ? parseFloat(translate[2]) : 0,
        rotation: rotate ? parseFloat(rotate[1]) : 0,
        scale: scale ? parseFloat(scale[1]) : 1
    };
};

const CanvasPlayer: React.FC<{ className?: string, canvasMode?: 'shorts' | 'wide' }> = ({ className, canvasMode = 'shorts' }) => {
    const { tracks, currentTime, selectedClipId, setSelectedClipId, updateClip, previewScale, isPlaying, setPreviewScale } = useEditorStore();
    const [targets, setTargets] = useState<HTMLElement[]>([]);
    const containerRef = useRef<HTMLDivElement>(null); // The wrapper (100% width/height)
    const stageRef = useRef<HTMLDivElement>(null);     // The scaled content box

    // 1. Logical Size
    const width = canvasMode === 'shorts' ? 1080 : 1920;
    const height = canvasMode === 'shorts' ? 1920 : 1080;

    // 2. Responsive Scaling Logic
    const [fitScale, setFitScale] = useState(1);

    useEffect(() => {
        const update = () => {
            if (!containerRef.current) return;
            const { clientWidth: pW, clientHeight: pH } = containerRef.current;
            const scaleW = pW / width;
            const scaleH = pH / height;
            // "Contain" logic + 20px padding logic (approx 0.9 factor or similar)
            // User snippet used 0.9.
            const s = Math.min(scaleW, scaleH) * 0.9;
            setFitScale(s);
        };
        window.addEventListener('resize', update);
        update();
        const timer = setTimeout(update, 50); // Debounce fix
        return () => {
            window.removeEventListener('resize', update);
            clearTimeout(timer);
        };
    }, [width, height]);

    const totalScale = fitScale * (previewScale || 1);

    // 3. Active Clips
    const visualClips = useMemo(() => {
        return tracks
            .filter(t => !t.hidden && ['video', 'image', 'text', 'caption', 'sticker'].includes(t.type))
            .flatMap(t => t.clips.map(c => ({
                ...c,
                trackId: t.id,
                // Calculate zIndex: Top track (index 0) gets highest z-index
                zIndex: (tracks.length - tracks.findIndex(tr => tr.id === t.id)) * 10 + (c.layer || 0)
            })))
            .filter(c => currentTime >= c.start - 0.05 && currentTime <= c.start + c.duration + 0.05) // Keep visibility buffer
            .sort((a, b) => a.zIndex - b.zIndex);
    }, [tracks, currentTime]);

    const activeAudioClips = useMemo(() => {
        return tracks.filter(t => t.type === 'audio' && !t.muted && !t.hidden)
            .flatMap(t => t.clips).filter(c => currentTime >= c.start && currentTime < c.start + c.duration);
    }, [tracks, currentTime]);

    // 4. Update Selection Target
    useEffect(() => {
        if (selectedClipId) {
            const el = document.getElementById(`clip-${selectedClipId}`);
            if (el) setTargets([el]);
            else setTargets([]);
        } else {
            setTargets([]);
        }
    }, [selectedClipId, visualClips]);

    // 5. Interaction Handlers (Optimized)
    const onDrag = ({ target, transform }: OnDrag) => { target.style.transform = transform; };

    const onResize = ({ target, width, height, drag }: OnResize) => {
        target.style.width = `${width}px`;
        target.style.height = `${height}px`;
        target.style.transform = drag.transform;
    };

    const onRotate = ({ target, drag }: OnRotate) => { target.style.transform = drag.transform; };

    const onEnd = ({ target, lastEvent }: any) => {
        if (!lastEvent) return; // Verify event exists

        const { x, y, rotation, scale } = parseTransform(target.style.transform);
        const w = parseFloat(target.style.width);
        const h = parseFloat(target.style.height);

        // Find clip to get trackId
        const clip = visualClips.find(c => c.id === selectedClipId);
        if (clip) {
            updateClip(clip.trackId, clip.id, {
                transform: {
                    ...clip.transform,
                    x, y, rotation, scale,
                    width: w || clip.transform.width,
                    height: h || clip.transform.height
                }
            });
        }
    };

    // Wheel Zoom Handler
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setPreviewScale(Math.min(Math.max(0.1, previewScale + delta), 4));
        }
    };

    return (
        <div
            ref={containerRef}
            className={cn("flex items-center justify-center w-full h-full bg-[#1e1e1e] overflow-hidden select-none", className)}
            onMouseDown={() => setSelectedClipId(null)}
            onWheel={handleWheel}
        >

            {/* SCALED STAGE */}
            <div
                ref={stageRef}
                id="canvas-stage"
                style={{
                    width, height,
                    transform: `scale(${totalScale})`,
                    transformOrigin: 'center',
                    backgroundColor: '#000'
                }}
                className="relative shadow-2xl overflow-hidden"
                onMouseDown={(e) => e.stopPropagation()} // Prevent deselect when clicking stage
            >
                {/* CONTENT */}
                {visualClips.map(clip => {
                    // Check source validity
                    if ((clip.type === 'video' || clip.type === 'image' || clip.type === 'sticker') && !clip.source) {
                        return null;
                    }

                    const tf = clip.transform || {};
                    const hasCrop = clip.crop && clip.sourceDimensions;
                    const innerStyle: React.CSSProperties = hasCrop ? {
                        position: 'absolute',
                        left: -clip.crop!.x * (tf.width || clip.crop!.width) / clip.crop!.width,
                        top: -clip.crop!.y * (tf.height || clip.crop!.height) / clip.crop!.height,
                        width: clip.sourceDimensions!.width * (tf.width || clip.crop!.width) / clip.crop!.width,
                        height: clip.sourceDimensions!.height * (tf.height || clip.crop!.height) / clip.crop!.height,
                        maxWidth: 'none', maxHeight: 'none'
                    } : { width: '100%', height: '100%' };

                    return (
                        <div
                            key={clip.id}
                            id={`clip-${clip.id}`}
                            className={cn("absolute origin-center cursor-pointer target-element", selectedClipId === clip.id && "z-50")}
                            style={{
                                transform: `translate(${tf.x}px, ${tf.y}px) rotate(${tf.rotation}deg) scale(${tf.scale})`,
                                width: tf.width || (clip.type === 'text' ? 'auto' : '100%'),
                                height: tf.height || (clip.type === 'text' ? 'auto' : '100%'),
                                zIndex: clip.zIndex,
                                opacity: tf.opacity ?? 1,
                                color: clip.style?.color || 'white',
                                fontSize: `${clip.style?.fontSize || 40}px`,
                                fontFamily: clip.style?.fontFamily || 'Arial',
                                fontWeight: clip.style?.fontWeight || 'normal',
                                fontStyle: clip.style?.fontStyle || 'normal',
                                textAlign: clip.style?.textAlign || 'center',
                                lineHeight: clip.style?.lineHeight || 1.2,
                                whiteSpace: 'pre-wrap',
                                letterSpacing: `${clip.style?.letterSpacing || 0}px`,
                            }}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                setSelectedClipId(clip.id);
                            }}
                        >
                            {/* Render Video/Image/Text */}
                            {clip.type === 'video' && <div style={innerStyle}><VideoLayer clip={clip} currentTime={currentTime} isPlaying={isPlaying} /></div>}
                            {(clip.type === 'image' || clip.type === 'sticker') && <img src={clip.source} style={innerStyle} className="w-full h-full object-contain pointer-events-none" />}
                            {(clip.type === 'text' || clip.type === 'caption') && (
                                <div className="w-full h-full flex items-center justify-center pointer-events-none">
                                    {clip.content || clip.name}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* MOVEABLE LAYER (OUTSIDE Stage, but linked via zoom prop) */}
            <Moveable
                target={targets}
                // Critical: Use the scale factor here
                zoom={totalScale}

                draggable={true}
                resizable={true}
                keepRatio={true} // FORCE Aspect Ratio as requested
                rotatable={true}
                snappable={true}
                snapThreshold={10}
                verticalGuidelines={[0, width / 2, width]}
                horizontalGuidelines={[0, height / 2, height]}

                onDrag={onDrag} onDragEnd={onEnd}
                onResize={onResize} onResizeEnd={onEnd}
                onRotate={onRotate} onRotateEnd={onEnd}

                // Styling matches CapCut
                controlBeforeCombine={true}
                className="moveable-control-box"
            />

            {activeAudioClips.map(clip => (
                <AudioPlayer key={clip.id} clip={clip} currentTime={currentTime} isPlaying={isPlaying} volume={clip.audio?.volume ?? 1} />
            ))}
        </div>
    );
};

/* Media Players */
const VideoLayer: React.FC<{ clip: any, currentTime: number, isPlaying: boolean, muted?: boolean }> = ({ clip, currentTime, isPlaying, muted }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => { if (videoRef.current && videoRef.current.src !== clip.source) videoRef.current.src = clip.source; }, [clip.source]);
    useEffect(() => { if (!videoRef.current) return; isPlaying ? videoRef.current.play().catch(() => { }) : videoRef.current.pause(); }, [isPlaying]);
    useEffect(() => {
        if (!videoRef.current) return;
        const timeInClip = currentTime - clip.start;
        const seekTime = clip.trimStart + (timeInClip * clip.speed);
        const diff = Math.abs(videoRef.current.currentTime - seekTime);
        if (!isPlaying && diff > 0.1) {
            videoRef.current.currentTime = seekTime;
        } else if (isPlaying && diff > 0.5) {
            videoRef.current.currentTime = seekTime;
        }
        videoRef.current.playbackRate = clip.speed;
    }, [currentTime, clip.start, clip.trimStart, clip.speed, isPlaying]);
    return <video ref={videoRef} className="w-full h-full object-contain pointer-events-none select-none" muted={muted} />;
};
const AudioPlayer: React.FC<{ clip: any, currentTime: number, isPlaying: boolean, volume: number }> = ({ clip, currentTime, isPlaying, volume }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    useEffect(() => { if (audioRef.current) { audioRef.current.volume = volume; audioRef.current.playbackRate = clip.speed; } }, [volume, clip.speed]);
    useEffect(() => { if (audioRef.current) { isPlaying ? audioRef.current.play().catch(console.error) : audioRef.current.pause(); } }, [isPlaying]);
    useEffect(() => { 
        if (!audioRef.current) return;
        const timeInClip = currentTime - clip.start;
        const seekTime = clip.trimStart + (timeInClip * clip.speed);
        const diff = Math.abs(audioRef.current.currentTime - seekTime);
        if (!isPlaying && diff > 0.1) {
            audioRef.current.currentTime = seekTime;
        } else if (isPlaying && diff > 0.5) {
            audioRef.current.currentTime = seekTime;
        }
    }, [currentTime, clip.start, clip.trimStart, clip.speed, isPlaying]);
    const fetchSrc = clip.source.startsWith('http') || clip.source.startsWith('blob:') || clip.source.startsWith('/api/') ? clip.source : `/api/files/stream?path=${encodeURIComponent(clip.source)}`;
    return <audio ref={audioRef} src={fetchSrc} />;
};

export default CanvasPlayer;
