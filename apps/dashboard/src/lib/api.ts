import axios from 'axios';

const getBaseURL = () => {
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        return 'http://127.0.0.1:8000/api';
    }
    return '/api';
};

const getSwarmBaseURL = () => {
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        return 'http://127.0.0.1:4000/swarm';
    }
    return '/swarm';
};

export const API_BASE_URL = getBaseURL();
export const SWARM_BASE_URL = getSwarmBaseURL();

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // 30s for normal API calls
});

// Long-running operations (render, merge, TTS batch) need much longer timeout
export const apiLong = axios.create({
    baseURL: API_BASE_URL,
    timeout: 300000, // 5 minutes
});

// Apply same retry interceptor to apiLong
apiLong.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config as any;
        const isNetworkError = !error.response;
        if (!isNetworkError) return Promise.reject(error);
        config.__retryCount = config.__retryCount || 0;
        if (config.__retryCount >= 2) return Promise.reject(error);
        config.__retryCount++;
        await new Promise((res) => setTimeout(res, 2000));
        return apiLong(config);
    }
);


// [Resilience] 백엔드 시작 지연(Race Condition) 대응 자동 재시도 인터셉터
// ECONNREFUSED / 네트워크 오류 시 최대 3회, 지수 백오프로 재시도
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config as any;
        // 네트워크 오류(백엔드 미준비)만 재시도, 4xx 응답은 재시도 안 함
        const isNetworkError = !error.response;
        if (!isNetworkError) return Promise.reject(error);

        config.__retryCount = config.__retryCount || 0;
        if (config.__retryCount >= 3) return Promise.reject(error);

        config.__retryCount++;
        const delay = 1000 * config.__retryCount; // 1s, 2s, 3s
        await new Promise((res) => setTimeout(res, delay));
        return api(config);
    }
);

export interface Category {
    id: number;
    name: string;
    folder_name: string;
    created_at: string;
}

export interface Channel {
    id: number;
    url: string;
    platform: string;
    name: string;
    folder_name: string;
    thumbnail_path: string | null;
    category_id: number | null;
    last_scanned_at: string | null;
    status: string;
    auto_download: boolean;
    subscriber_count?: number;
    default_script_only: boolean;
    created_at: string;
}

export interface Video {
    id: number;
    channel_id: number;
    video_id: string;
    url?: string;
    title: string;
    file_path: string;
    thumbnail_path: string | null;
    upload_date: string;
    downloaded_at: string;
    viewed_at: string | null;
    status: string;
    view_count?: number;
    duration?: number;
    viral_score?: number;
    velocity_score?: number;
    is_script_only?: boolean;
    script_analysis?: ScriptAnalysis;
    metadata_json: any;
    priority_level?: number;
    upload_status?: string;
    privacy_status?: string;
    uploaded_video_id?: string;
    failure_reason?: string;
    workflow_mode?: string;
    created_at?: string;
    updated_at?: string;
    content?: string;
}

export interface Settings {
    id: number;
    root_download_path: string;
    cookies_path: string | null;
    global_auto_download: boolean;
    scan_interval_minutes: number;
    auto_hd_viral_threshold?: number;
    auto_hd_velocity_threshold?: number;
    outlier_ev_threshold?: number;
    outlier_ratio_threshold?: number;
    ffmpeg_path: string | null;
    whisper_model_path: string | null;
    default_model_size: string;
    default_language: string;
    elevenlabs_api_keys: string[];
    supertone_project_key: string | null;
    supertone_local_enabled?: boolean;
    supertone_model_path?: string;
    typecast_api_keys: string[];
    kokoro_tts_url: string;
    searxng_url: string;
    ixbrowser_api_url?: string;
    web_search_engine: string;
    ollama_api_base_url?: string;
    gemini_api_keys: string[];
    openrouter_api_keys: string[];
    openrouter_api_key: string | null;
    nvidia_api_keys: string[];
    groq_api_keys: string[];
    tavily_api_keys: string[];
    sambanova_api_keys: string[];
    cerebras_api_keys: string[];
    opencode_api_keys: string[];
    jina_reader_endpoint: string;
    jina_reader_api_keys: string[];
    pexels_api_keys: string[];
    pixabay_api_keys: string[];
    fal_api_keys: string[];
    replicate_api_keys: string[];
    muapi_api_keys: string[];
    n8n_base_url?: string;
    kie_api_key: string | null;
    default_model: string;
    ytdlp_auto_update: boolean;
    ytdlp_last_check: string | null;
    ytdlp_version: string | null;
    openclaw_preferred_provider: string | null;
    openclaw_model: string | null;
    paperclip_provider: string | null;
    paperclip_model: string | null;
    openclaude_provider: string | null;
    openclaude_model: string | null;
    ffmpeg_status?: string;
    enable_trend_scheduling?: boolean;
    script_analysis_provider: string;
    script_analysis_model: string;
    audio_node_url?: string;
    audio_node_api_key?: string;
    visual_node_url?: string;
    visual_node_api_key?: string;
    proxy_mode?: string;
    netshare_ip?: string;
    netshare_port?: number;
    isp_proxy_url?: string;
    created_at: string;
}

export interface ScriptGenerationRequest {
    input_text: string;
    style_id: number;
    glossary?: string;
    niche?: string;
    wisdom?: string;
    provider?: string;
    model?: string;
    use_web_search?: boolean;
}

export interface ScriptGenerationResponse {
    script: string;
    model_used: string;
    warning?: string;
    research_used?: boolean;
    research_summary?: string;
    research_sources?: string[];
    trend_used?: boolean;
    trend_count?: number;
}

export interface TrendItem {
    id: number;
    keyword: string;
    category: string;
    micro_topic: string;
    keyword_count: number;
    top_keywords: TrendKeyword[];
    updated_at: string;
}

export interface TrendKeyword {
    ko: string;
    en: string;
    score: number;
    velocity: string;
}

export interface ScriptRefinementRequest {
    current_text: string;
    instruction: string;
    style_id?: number;
    persona?: string;
    provider?: string;
    model?: string;
    tempo_percentage?: number;
}

export interface ScriptStyle {
    id: number;
    name: string;
    system_instruction: string;
    sample_text: string | null;
    created_at: string;
}

export interface ScriptAnalysis {
    id: number;
    video_id: number;
    viral_score: number;
    summary_one_line: string;
    summary_three_lines: string;
    sentiment_score: number;
    sentiment_label: string;
    tone: string;
    keywords: string[];
    hooks: { text: string; type: string }[];
    audience_reaction: { predicted_comments: string; best_comment: string };
    structure_breakdown?: { intro: string; body: string; conclusion: string };
    created_at: string;
}

export interface BrandChannel {
    id: number;
    channel_id: string;
    title: string;
    thumbnail_url: string;
    token_expiry?: string;
    worker_id: number;
    worker?: { email: string; name: string; picture: string };
    default_privacy?: string;
    default_tags?: string;
    default_upload_delay_minutes?: number;
    status?: string;
    engine_mode?: string;
    warmup_config?: any;
}

export interface ConfigPreset {
    id: number;
    type: string;
    name: string;
    config: any;
    created_at: string;
}

export const getBrandChannels = async () => (await api.get<BrandChannel[]>('/brand-channels/')).data;
export const deleteBrandChannel = async (id: number) => (await api.delete(`/brand-channels/${id}/`)).data;
export const updateBrandChannel = async (id: number, data: Partial<BrandChannel>) => (await api.patch<BrandChannel>(`/brand-channels/${id}/`, data)).data;

export const getConfigPresets = async (type: string) => (await api.get<ConfigPreset[]>('/system/config-presets/', { params: { type } })).data;
export const createConfigPreset = async (type: string, name: string, config: any) => (await api.post<ConfigPreset>('/system/config-presets/', { type, name, config })).data;
export const deleteConfigPreset = async (id: number) => (await api.delete(`/system/config-presets/${id}/`)).data;

export default api;
