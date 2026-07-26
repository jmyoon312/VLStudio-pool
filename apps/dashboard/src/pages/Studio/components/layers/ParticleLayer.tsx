import React, { useMemo } from 'react';
import { Group, Circle, Rect } from 'react-konva';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { Layer } from '../../store/useLofiStudioStore';

// Pseudo-random generator for determinism
const mulberry32 = (a: number) => {
    return () => {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

interface ParticleLayerProps {
    layer: Layer;
}

export const ParticleLayer = ({ layer }: ParticleLayerProps) => {
    // Remotion Hooks (safe to use in Studio if wrapped or mocked, 
    // but here we might need a fallback if not in Remotion context)
    // For Shared Component, we usually expect 'frame' to be passed or use a flexible hook.
    // However, since we are moving towards Remotion-first, let's try to use Remotion hooks 
    // but adding a fallback for Studio (Active Mode).

    // In Studio, useCurrentFrame might throw or return 0 if not wrapped in <Composition>.
    // Ideally, SharedSceneRenderer should pass 'frame'.
    // BUT for now, let's assume we can use a "Time Context" or fallback.

    // HACK: For now, if we are in Studio, we can't easily get 'frame' from Remotion hooks
    // unless we wrap the entire Studio in Remotion. 
    // Instead, we will use a simplified approach: animate based on internal state if in Studio?
    // No, we want "Shared Core". 
    // Let's assume the parent passes 'frame' or we use a custom hook that detects environment.

    // Current plan: Use internal timer for preview, props for render? 
    // Actually, let's implement the Pure Component requiring 'frame' prop eventually.
    // But Layer interface doesn't have frame.

    // Temporary: Use internal requestAnimationFrame for Studio preview if standard hooks fail?
    // Let's stick to a simple internal "frame" simulation for Studio.

    const [simulatedFrame, setSimulatedFrame] = React.useState(0);

    React.useEffect(() => {
        // Simple 30fps simulation loop for Live Studio
        const interval = setInterval(() => {
            setSimulatedFrame(f => f + 1);
        }, 1000 / 30);
        return () => clearInterval(interval);
    }, []);

    // Try to get actual Remotion frame if available (context check)
    let frame = simulatedFrame;
    let fps = 30;
    try {
        frame = useCurrentFrame();
        fps = useVideoConfig().fps;
    } catch (e) {
        // Not in Remotion context
    }

    const { particles } = useMemo(() => {
        const count = 50;
        const seed = layer.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const random = mulberry32(seed);

        const pts = [];
        for (let i = 0; i < count; i++) {
            pts.push({
                x: random() * layer.width,
                y: random() * layer.height,
                size: random() * 3 + 1,
                speed: random() * 2 + 1,
                offset: random() * 100
            });
        }
        return { particles: pts };
    }, [layer.id, layer.width, layer.height]);

    if (!layer.visible) return null;

    return (
        <Group
            x={layer.x}
            y={layer.y}
            width={layer.width}
            height={layer.height}
            rotation={layer.rotation}
            opacity={layer.opacity}
        >
            {/* Soft Clip/Mask if needed, or just unbound particles */}

            {particles.map((p, i) => {
                // Deterministic Position y = (initial + speed * frame) % height
                const y = (p.y + (p.speed * frame)) % layer.height;
                const x = p.x + Math.sin((frame + p.offset) * 0.05) * 10; // Sway

                return (
                    <Circle
                        key={i}
                        x={x}
                        y={y}
                        radius={p.size}
                        fill="white"
                        opacity={0.6}
                        shadowBlur={5}
                        shadowColor="white"
                    />
                );
            })}
        </Group>
    );
};
