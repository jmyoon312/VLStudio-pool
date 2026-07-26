import React from 'react';
import { Series, Video, Audio, Img, AbsoluteFill, useVideoConfig, interpolate, spring } from 'remotion';
import { z } from 'zod';

export const AIMovieSchema = z.object({
    scenes: z.array(z.object({
        type: z.enum(['video', 'image']),
        src: z.string(),
        audioSrc: z.string().optional(),
        subtitle: z.string().optional(),
        durationInFrames: z.number(),
        metadata: z.object({
            dialect: z.string().optional()
        }).optional()
    }))
});

export const AIMovie: React.FC<z.infer<typeof AIMovieSchema>> = ({ scenes }) => {
    const { fps } = useVideoConfig();

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            <Series>
                {scenes.map((scene, i) => (
                    <Series.Sequence key={i} durationInFrames={scene.durationInFrames}>
                        {/* Visual Layer */}
                        <AbsoluteFill>
                            {scene.type === 'video' ? (
                                <Video src={scene.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <Img src={scene.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                        </AbsoluteFill>

                        {/* Audio Layer */}
                        {scene.audioSrc && <Audio src={scene.audioSrc} />}

                        {/* Subtitle / Caption Layer */}
                        {scene.subtitle && (
                            <AbsoluteFill style={{
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                paddingBottom: 100,
                                textAlign: 'center'
                            }}>
                                <div style={{
                                    backgroundColor:
                                        scene.metadata?.dialect === 'gyeongsang' ? 'rgba(239, 68, 68, 0.7)' : // Red for blunt
                                            scene.metadata?.dialect === 'jeolla' ? 'rgba(34, 197, 94, 0.7)' :    // Green for friendly
                                                scene.metadata?.dialect === 'chungcheong' ? 'rgba(234, 179, 8, 0.7)' : // Yellow for slow
                                                    'rgba(0,0,0,0.6)',
                                    color: 'white',
                                    fontSize: 48,
                                    padding: '10px 30px',
                                    borderRadius: 15,
                                    fontFamily: 'sans-serif',
                                    fontWeight: 'bold',
                                    maxWidth: '80%',
                                    transition: 'transform 0.5s ease',
                                    textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                                    border: '3px solid white'
                                }}>
                                    {scene.subtitle}
                                </div>
                            </AbsoluteFill>
                        )}
                    </Series.Sequence>
                ))}
            </Series>
        </AbsoluteFill>
    );
};
