
export interface SubtitleConfig {
    enabled?: boolean; // For toggling usage
    // Style (From CreativeStudio)
    font: string;       // e.g., 'Arial', 'NanumGothic'
    fontSize: number;   // 10 ~ 100
    textColor: string;  // Hex code
    isBold: boolean;
    isItalic: boolean;
    outlineSize: number; // 0 ~ 10 (Text Stroke)
    outlineColor: string;
    shadowSize: number;  // 0 ~ 10 (Drop Shadow)
    shadowColor: string;
    textAlign?: 'left' | 'center' | 'right'; // Alignment

    // Background Box
    useBox?: boolean;
    boxColor: string; // Background box color
    boxOpacity: number; // 0 ~ 100 (percentage)

    // Legacy mapping (optional, can be deprecated)
    backgroundColor?: string;
    backgroundOpacity?: number;

    position: 'bottom' | 'top' | 'center' | 'custom';
    marginV?: number;  // Distance from top/bottom (default 50)
    customX?: number;  // For 'custom' position
    customY?: number;  // For 'custom' position

    // Animation - Detailed
    animationEntrance?: string;
    animationEntranceDuration?: number; // seconds
    animationEntranceDelay?: number; // seconds

    animationEmphasis?: string;
    animationEmphasisDuration?: number;
    animationEmphasisDelay?: number;

    animationExit?: string;
    animationExitDuration?: number;
    animationExitDelay?: number;

    // Simple Animation (Backwards Compatibility)
    animation: 'none' | 'fade_in' | 'pop_up' | 'typewriter';

    // Segmentation (From SubtitleConverter)
    splitLimit: number; // Max characters per line (Default: 20)
    maxLines: number;   // Max lines per chunk (Default: 2)
}

export const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
    enabled: true,
    font: 'NanumGothic',
    fontSize: 40,
    textColor: '#FFFFFF',
    isBold: true,
    isItalic: false,
    textAlign: 'center',
    outlineSize: 2,
    outlineColor: '#000000',
    shadowSize: 2,
    shadowColor: '#000000',

    useBox: false,
    boxColor: '#000000',
    boxOpacity: 50,
    backgroundColor: '#000000',
    backgroundOpacity: 0,

    position: 'bottom',
    marginV: 50,
    customX: 0,
    customY: 0,

    animation: 'fade_in',
    animationEntrance: 'fade_in',
    animationEntranceDuration: 0.5,
    animationEntranceDelay: 0,
    animationEmphasis: 'none',
    animationEmphasisDuration: 0.5,
    animationEmphasisDelay: 0,
    animationExit: 'none',
    animationExitDuration: 0.5,
    animationExitDelay: 0,

    splitLimit: 20,
    maxLines: 2
};

export const KOREAN_FONTS = [
    { value: 'NanumGothic', label: '나눔고딕 (NanumGothic)' },
    { value: 'NanumMyeongjo', label: '나눔명조 (NanumMyeongjo)' },
    { value: 'NanumPen', label: '나눔펜 (NanumPen)' },
    { value: 'Noto Sans KR', label: '노토산스 (Noto Sans KR)' },
    { value: 'Black Han Sans', label: '블랙한산스 (Black Han Sans)' },
    { value: 'Jua', label: '주아 (Jua)' },
    { value: 'Do Hyeon', label: '도현 (Do Hyeon)' },
    { value: 'Gugi', label: '구기 (Gugi)' },
];

export const ANIMATIONS = [
    { value: 'none', label: '없음 (None)' },
    { value: 'fade_in', label: '페이드 인 (Fade In)' },
    { value: 'pop_up', label: '팝업 (Pop Up)' },
    { value: 'typewriter', label: '타자기 (Typewriter)' },
];
