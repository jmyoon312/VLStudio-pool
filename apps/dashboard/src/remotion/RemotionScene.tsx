import React from 'react';
import { Stage, Layer } from 'react-konva';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Sequence, Audio } from 'remotion';
import { SharedSceneRenderer } from '../pages/Studio/components/SharedSceneRenderer';
import { Scene } from '../pages/Studio/store/useLofiStudioStore';

interface RemotionSceneProps {
    scene: Scene;
}

export const RemotionScene: React.FC<RemotionSceneProps> = ({ scene }) => {
    // Fixed resolution for rendering (can be parameterized later)
    const width = 1280;
    const height = 720;

    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const currentTime = frame / fps;

    // Simple audio selection: taking the first track for visualization for now
    // In a real implementation, we'd map time -> playlist item
    const activeAudioSrc = scene.playlist?.[0]?.src;

    return (
        <AbsoluteFill style={{ backgroundColor: '#000000' }}>
            {scene.playlist?.map((item, index) => {
                // Determine start frame based on previous items if duration is known
                // Since we might not have dynamic duration here without pre-calculation, 
                // and the user complaint is about "screen" (visual), we focus on video.
                // However, overlapping audio is bad.
                // Ideally we would chain them. For now, assuming single track or manual mix.
                // Just keeping existing overlap logic but noting it needs metadata.
                return (
                    <Sequence key={item.id} from={0} durationInFrames={Infinity}>
                        <Audio src={item.src} volume={item.volume || 1.0} />
                    </Sequence>
                );
            })}
            <Stage width={width} height={height}>
                <Layer>
                    <SharedSceneRenderer
                        layers={scene.layers}
                        // Remotion is non-interactive, so we pass no-op or undefined for callbacks
                        selectedLayerIds={[]}
                        currentTime={currentTime}
                        activeAudioSrc={activeAudioSrc}
                        crossfadeDuration={scene.crossfadeDuration}
                    />
                </Layer>
            </Stage>
        </AbsoluteFill>
    );
};
