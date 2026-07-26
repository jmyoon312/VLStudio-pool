import React, { useEffect, useRef, useState } from 'react';
import { useStudioStore } from './store/useStudioStore';

export const AudioManager: React.FC = () => {
    const { currentRecipe, lofiPlaylist } = useStudioStore();
    const audioRef = useRef<HTMLAudioElement>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // Reset when recipe changes
    useEffect(() => {
        if (currentRecipe !== 'lofi') {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setIsPlaying(false);
        } else {
            // Should we auto-start? Maybe wait for user action or just start if playlist exists?
            // "24/7 Radio" implies it just runs.
            if (lofiPlaylist.length > 0 && !isPlaying) {
                playTrack(currentIndex);
            }
        }
    }, [currentRecipe, lofiPlaylist]);

    const playTrack = async (index: number) => {
        if (!audioRef.current || !lofiPlaylist[index]) return;

        try {
            audioRef.current.src = lofiPlaylist[index].src;
            audioRef.current.volume = 0.5; // Default volume
            await audioRef.current.play();
            setIsPlaying(true);
            setCurrentIndex(index);
        } catch (e) {
            console.error("Audio playback interrupted", e);
        }
    };

    const handleEnded = () => {
        if (lofiPlaylist.length === 0) return;

        let nextIndex = currentIndex + 1;
        if (nextIndex >= lofiPlaylist.length) {
            nextIndex = 0; // Loop playlist
        }
        playTrack(nextIndex);
    };

    return (
        <audio
            ref={audioRef}
            onEnded={handleEnded}
            className="hidden"
        />
    );
};
