import React from 'react';
import { AbsoluteFill, Video, Sequence, Audio, useVideoConfig, useCurrentFrame, interpolate, Img } from 'remotion';
import { z } from 'zod';

export const EliteSequenceSchema = z.object({
    beats: z.array(z.object({
        id: z.string(),
        content: z.string(),
        media_url: z.string().optional(),
        media_type: z.enum(['video', 'image']).default('video'),
        duration_sec: z.number().default(5),
        transform: z.object({
            scale: z.number().default(1),
            x: z.number().default(0),
            y: z.number().default(0),
            rotate: z.number().default(0),
            opacity: z.number().default(1)
        }).optional(),
        fx: z.object({
            blur: z.number().default(0),
            brightness: z.number().default(100),
            contrast: z.number().default(100)
        }).optional()
    })),
    audio_src: z.string().optional(),
    bgm_src: z.string().optional(),
    bgm_volume: z.number().default(0.1),
    aspect_ratio: z.enum(['9:16', '16:9']).default('9:16')
});

export const EliteSequence: React.FC<z.infer<typeof EliteSequenceSchema>> = ({
    beats,
    audio_src,
    bgm_src,
    bgm_volume,
    aspect_ratio
}) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();

    let currentStartFrame = 0;

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            {/* Background Music Layer */}
            {bgm_src && (
                <Audio src={bgm_src} volume={bgm_volume} loop />
            )}

            {/* Voiceover Layer */}
            {audio_src && (
                <Audio src={audio_src} volume={1.0} />
            )}

            {/* Beats Sequence */}
            {beats.map((beat, index) => {
                const durationFrames = Math.floor((beat.duration_sec || 5) * fps);
                const startFrame = currentStartFrame;
                currentStartFrame += durationFrames;

                const t = beat.transform || { scale: 1, x: 0, y: 0, rotate: 0, opacity: 1 };
                const f = beat.fx || { blur: 0, brightness: 100, contrast: 100 };

                // Apply Ken Burns if scale is > 1 (Auto-motion)
                // If scale is exactly 1, we can add a subtle zoom
                const scaleVal = t.scale === 1 
                    ? interpolate(frame - startFrame, [0, durationFrames], [1, 1.1], { extrapolateRight: 'clamp' })
                    : t.scale;

                return (
                    <Sequence 
                        key={beat.id} 
                        from={startFrame} 
                        durationInFrames={durationFrames}
                    >
                        <AbsoluteFill style={{ 
                            transform: `scale(${scaleVal}) translate(${t.x}%, ${t.y}%) rotate(${t.rotate}deg)`,
                            opacity: t.opacity,
                            filter: `blur(${f.blur}px) brightness(${f.brightness}%) contrast(${f.contrast}%)`,
                            overflow: 'hidden'
                        }}>
                            {beat.media_url ? (
                                beat.media_type === 'video' ? (
                                    <Video 
                                        src={beat.media_url} 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        muted 
                                    />
                                ) : (
                                    <Img 
                                        src={beat.media_url} 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    />
                                )
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' }}>
                                    <span style={{ color: '#94a3b8' }}>Awaiting Asset...</span>
                                </div>
                            )}
                        </AbsoluteFill>

                        {/* Text Overlay for this beat */}
                        <AbsoluteFill style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'flex-end', 
                            paddingBottom: 100 
                        }}>
                            <div style={{ 
                                padding: '16px 32px', 
                                backgroundColor: 'rgba(0,0,0,0.6)', 
                                color: 'white', 
                                fontSize: 48, 
                                fontWeight: 900, 
                                textAlign: 'center',
                                borderRadius: 16,
                                maxWidth: '80%',
                                border: '2px solid rgba(255,255,255,0.1)',
                                textShadow: '0 4px 10px rgba(0,0,0,0.5)'
                            }}>
                                {beat.content}
                            </div>
                        </AbsoluteFill>
                    </Sequence>
                );
            })}

            {/* Global Vignette */}
            <AbsoluteFill style={{
                background: 'radial-gradient(circle, transparent 30%, rgba(0,0,0,0.4) 100%)',
                pointerEvents: 'none'
            }} />
        </AbsoluteFill>
    );
};
