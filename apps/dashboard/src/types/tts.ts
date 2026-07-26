export interface TTSConfig {
    engine: string;
    language: string;
    voice_id: string;
    speed: number;      // 0.5 ~ 2.0
    pitch: number;      // -20 ~ 20 (or engine specific)

    // Advanced Settings
    emotion?: string;   // For Typecast/Supertone
    xi_stability?: number; // For ElevenLabs (mapped to stability)
    xi_similarity_boost?: number;// For ElevenLabs
    xi_style?: number;     // For ElevenLabs

    // Silence Removal
    use_silence_removal?: boolean;
    silence_threshold?: number;
    min_silence_len?: number;
    keep_silence_len?: number;

    // Supertonic Local
    noise_scale?: number;
    mix_voice_id?: string;
    mix_ratio?: number;
}

export interface TTSVoice {
    id: string;
    name: string;
    gender?: string;
    age_group?: string; // youth, adult, senior, unknown
    styles?: string[];
}
