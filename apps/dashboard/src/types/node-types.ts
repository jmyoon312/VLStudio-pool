export interface BaseNodeData {
    label: string;
    description?: string;
    active?: boolean;
}

export interface SchedulerNodeData extends BaseNodeData {
    cron: string;        // e.g. "0 9 * * *"
    interval?: number;   // Override interval in minutes
    timezone?: string;   // e.g. "Asia/Seoul"
}

export interface TTSNodeData extends BaseNodeData {
    engine: 'elevenlabs' | 'typecast' | 'google' | 'edge' | 'kokoro' | 'supertone';
    voice_id: string;
    speed: number;       // 0-100 (or mapped to specific engine range)
    pitch: number;       // 0-100
    emotion?: string;
    settings?: Record<string, any>; // Engine specific settings
}

export interface VideoGenNodeData extends BaseNodeData {
    style_preset: 'kenburns' | 'zoompan' | 'static' | 'cinematic';
    transition: 'fade' | 'cut' | 'dissolve';
    duration_override?: number;
    fps?: number;
    aspect_ratio?: '9:16' | '16:9' | '1:1';
}

export interface SubtitleNodeData extends BaseNodeData {
    model: 'whisper-base' | 'whisper-large' | 'whisper-turbo';
    output_format: 'srt' | 'ass' | 'vtt';
    style?: {
        font: string;
        size: number;
        color: string;
        bg_color: string;
    };
}
