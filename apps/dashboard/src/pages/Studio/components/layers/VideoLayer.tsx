import React, { useEffect, useRef, useState } from 'react';
import { Image as KonvaImage, Group } from 'react-konva';
import Konva from 'konva';
import { continueRender, delayRender } from 'remotion';
import { Layer } from '../../store/useLofiStudioStore';

interface VideoLayerProps {
    layer: Layer;
    onSelect?: () => void;
    onChange?: (newAttrs: Partial<Layer>) => void;
    onDblClick?: () => void;
    currentTime?: number;
    crossfadeDuration?: number;
}

export const VideoLayer = ({ layer, onSelect, onChange, onDblClick, currentTime, crossfadeDuration = 0 }: VideoLayerProps) => {
    // Primary video (Current Loop)
    const shapeRef1 = useRef<Konva.Image>(null);
    const [videoElement1, setVideoElement1] = useState<HTMLVideoElement | null>(null);

    // Secondary video (Previous Loop - for crossfade overlap)
    const shapeRef2 = useRef<Konva.Image>(null);
    const [videoElement2, setVideoElement2] = useState<HTMLVideoElement | null>(null);

    // State to track if we are in overlap
    const [overlapState, setOverlapState] = useState<{
        active: boolean;
        opacity1: number;
        opacity2: number;
    }>({ active: false, opacity1: 1, opacity2: 0 });

    const createVideo = (src: string, isLoop: boolean, isMuted: boolean) => {
        const vid = document.createElement('video');
        vid.src = src;
        if (!src.startsWith('blob:')) {
            vid.crossOrigin = 'anonymous';
        }
        vid.loop = false; // We handle loop manually
        vid.muted = isMuted;
        vid.setAttribute('playsinline', 'true'); // Important for mobile/canvas behavior
        vid.playsInline = true;

        // CRITICAL FIX: Append to DOM for proper loading
        vid.style.position = 'absolute';
        vid.style.top = '-9999px';
        vid.style.left = '-9999px';
        vid.style.width = '1px';
        vid.style.height = '1px';
        document.body.appendChild(vid);

        return vid;
    };

    // Initialize Video Elements
    useEffect(() => {
        if (!layer.src) return;

        console.log(`[VideoLayer] Creating video for ${layer.src}`);
        const vid1 = createVideo(layer.src, !!layer.loop, !!layer.muted);

        // Force update when metadata loads to ensure we have duration/dimensions
        vid1.onloadedmetadata = () => {
            console.log(`[VideoLayer] Metadata loaded: ${vid1.duration}s (${vid1.videoWidth}x${vid1.videoHeight})`);
            // Trigger rerender
            setVideoElement1(prev => prev === vid1 ? vid1 : prev);

            // Prime the video decoder
            vid1.play().then(() => {
                vid1.pause();
                vid1.currentTime = 0;
            }).catch(e => console.warn("Video autoplay blocked/failed", e));
        };

        setVideoElement1(vid1);

        let vid2: HTMLVideoElement | null = null;
        if (crossfadeDuration > 0) {
            vid2 = createVideo(layer.src, !!layer.loop, true);
            vid2.muted = true;
            setVideoElement2(vid2);
        } else {
            setVideoElement2(null);
        }

        return () => {
            console.log(`[VideoLayer] Cleanup video`);
            vid1.pause();
            vid1.removeAttribute('src'); // Better cleanup
            vid1.load(); // Force unload
            vid1.remove();

            if (vid2) {
                vid2.pause();
                vid2.removeAttribute('src');
                vid2.load();
                vid2.remove();
            }
        };
    }, [layer.src, crossfadeDuration, layer.loop, layer.muted]);

    // Animation / Redraw Loop
    useEffect(() => {
        const node = shapeRef1.current;
        if (!node) return;

        const layerNode = node.getLayer();
        if (!layerNode) return;

        console.log("[VideoLayer] Starting Animation Loop");
        const anim = new Konva.Animation(() => {
            // This intentionally does nothing but trigger a layer redraw
            // enabling the <Image> to pick up the updated video frame
        }, layerNode);

        anim.start();

        return () => {
            anim.stop();
        };
    }, [videoElement1, overlapState.active]); // Restart if video or overlap changes (which might change node structure)

    // Update Props
    useEffect(() => {
        if (videoElement1) {
            videoElement1.muted = !!layer.muted;
        }
        // vid2 always muted for now
    }, [layer.muted, videoElement1]);

    // Sync Logic
    useEffect(() => {
        if (!videoElement1 || currentTime === undefined) return;

        const handle = delayRender("VideoLayer Sync");
        const crossfade = crossfadeDuration || 0;

        let targetTime1 = currentTime;
        let targetTime2 = 0;
        let isOverlapping = false;
        let prog = 0;

        // Loop Logic
        if (videoElement1.duration && videoElement1.duration > 0 && layer.loop !== false) {
            const P = videoElement1.duration - crossfade;

            // If crossfade > duration (impossible state), clamp
            const validP = Math.max(0.1, P);

            // Calculate Loop State
            const loopIndex = Math.floor(currentTime / validP);
            const timeInLoop = currentTime % validP;

            // Are we in overlap zone? (Overlap happens at Start of a loop, mixing with End of previous)
            // Range [0, crossfade]
            if (crossfade > 0 && timeInLoop < crossfade && loopIndex > 0) {
                isOverlapping = true;

                // Video 1 (Incoming / Current Loop)
                targetTime1 = timeInLoop;

                // Video 2 (Outgoing / Previous Loop)
                // It should be at validP + timeInLoop
                targetTime2 = validP + timeInLoop;

                // Progress 0 -> 1
                prog = timeInLoop / crossfade;
            } else {
                targetTime1 = timeInLoop;
            }
        }

        // Apply Sync
        const syncVideo = (vid: HTMLVideoElement, time: number) => {
            // Simple seek
            if (Math.abs(vid.currentTime - time) > 0.05) {
                vid.currentTime = time;
            }
        };

        syncVideo(videoElement1, targetTime1);
        if (isOverlapping && videoElement2) {
            syncVideo(videoElement2, targetTime2);
            setOverlapState({
                active: true,
                opacity1: prog,        // Incoming (0 -> 1)
                opacity2: 1 - prog     // Outgoing (1 -> 0)
            });
        } else {
            setOverlapState({ active: false, opacity1: 1, opacity2: 0 });
        }

        // Delay Render Resolution
        // We use requestVideoFrameCallback if available for primary video
        const onSeeked = () => {
            if (videoElement1.requestVideoFrameCallback) {
                videoElement1.requestVideoFrameCallback(() => continueRender(handle));
            } else {
                requestAnimationFrame(() => continueRender(handle));
            }
        };

        // If not seeking (playing smoothly), we might not get 'seeked'. 
        // But here we are setting currentTime manually every frame from Remotion/Store.
        // Check if seek is pending?
        // Simpler: Just resolve.
        // Ideally we wait for 'seeked' but for high freq updates (animation), 
        // waiting for seeked can cause stutter if seek takes long.
        // Remotion 'delayRender' is mainly for initial load or sparse frames.
        // For continuous preview, strict locking might drop fps.

        // Optimistic
        continueRender(handle);

        return () => {
            continueRender(handle);
        };

    }, [videoElement1, videoElement2, currentTime, crossfadeDuration, layer.loop]);


    if (!layer.visible) return null;

    const commonProps = {
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        rotation: layer.rotation,
        scaleX: layer.scaleX,
        scaleY: layer.scaleY,
        draggable: !layer.locked && !!onChange,
        onDragEnd: (e: any) => onChange?.({ x: e.target.x(), y: e.target.y() }),
        onTransformEnd: (e: any) => {
            // ... transform logic ...
            const node = e.target;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            node.scaleX(1); node.scaleY(1);
            onChange?.({
                x: node.x(),
                y: node.y(),
                width: Math.max(5, node.width() * scaleX),
                height: Math.max(node.height() * scaleY),
                rotation: node.rotation(),
            });
        }
    };

    if (overlapState.active && videoElement2) {
        return (
            <Group>
                {/* Outgoing (Bottom) */}
                <KonvaImage
                    {...commonProps}
                    image={videoElement2 ? videoElement2 : undefined}
                    opacity={layer.opacity * overlapState.opacity2}
                    listening={false} // Only top layer listens
                />
                {/* Incoming (Top) */}
                <KonvaImage
                    {...commonProps}
                    id={layer.id} // ID on top layer for transformer
                    name={layer.id}
                    image={videoElement1 ? videoElement1 : undefined}
                    opacity={layer.opacity * overlapState.opacity1}
                    onClick={onSelect}
                    onTap={onSelect}
                    onDblClick={onDblClick}
                    ref={shapeRef1}
                />
            </Group>
        );
    }

    return (
        <KonvaImage
            {...commonProps}
            id={layer.id}
            name={layer.id}
            image={videoElement1 ? videoElement1 : undefined}
            opacity={layer.opacity}
            onClick={onSelect}
            onTap={onSelect}
            onDblClick={onDblClick}
            ref={shapeRef1}
        />
    );
};
