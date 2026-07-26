import React from 'react';
import { AbsoluteFill, Video, Sequence, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { z } from 'zod';
import { ViralCaptions, Word } from '../components/ViralCaptions';

export const SovereignShortsSchema = z.object({
    backgroundVideo: z.string(),
    syncVideo: z.string().optional(), // AI Actor video
    syncVideoPosition: z.enum(['top-right', 'bottom-right', 'center']).default('top-right'),
    words: z.array(z.object({
        word: z.string(),
        start: z.number(),
        end: z.number()
    })),
    title: z.string().optional(),
    zoomIntensity: z.number().default(1.1)
});

export const SovereignShorts: React.FC<z.infer<typeof SovereignShortsSchema>> = ({
    backgroundVideo,
    syncVideo,
    syncVideoPosition,
    words,
    title,
    zoomIntensity
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();

    // 1. Zoom Logic (Slow zoom in)
    const scale = interpolate(frame, [0, 300], [1, zoomIntensity], { extrapolateRight: 'clamp' });

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            {/* Background Layer with Zoom */}
            <AbsoluteFill style={{ transform: `scale(${scale})` }}>
                <Video src={backgroundVideo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
            </AbsoluteFill>

            {/* AI Actor Layer (Sync Video) */}
            {syncVideo && (
                <div style={{
                    position: 'absolute',
                    top: syncVideoPosition === 'top-right' ? 100 : 'auto',
                    bottom: syncVideoPosition === 'bottom-right' ? 100 : 'auto',
                    right: 50,
                    width: 350,
                    height: 350,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '5px solid #FFD700',
                    boxShadow: '0 0 30px rgba(255, 215, 0, 0.5)',
                    zIndex: 5
                }}>
                    <Video src={syncVideo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
            )}

            {/* Title Overlay */}
            {title && (
                <div style={{
                    position: 'absolute',
                    top: 150,
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    fontSize: 80,
                    fontWeight: 'bold',
                    color: 'white',
                    fontFamily: 'Impact',
                    textTransform: 'uppercase',
                    textShadow: '5px 5px 0px black'
                }}>
                    {title}
                </div>
            )}

            {/* Viral Captions Layer */}
            <ViralCaptions words={words as Word[]} />

            {/* Cinematic Overlay (Slight Vignette) */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle, transparent 40%, rgba(0,0,0,0.5) 100%)',
                pointerEvents: 'none'
            }} />
        </AbsoluteFill>
    );
};
