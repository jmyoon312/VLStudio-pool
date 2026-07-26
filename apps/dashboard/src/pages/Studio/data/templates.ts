import { LayerType } from '../store/useStudioStore';

export interface TemplateLayer {
    type: LayerType;
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
    fontSize?: number;
    fill?: string;
    zIndex: number;
    src?: string; // Placeholder or default
}

export interface StudioTemplate {
    id: string;
    name: string;
    description: string;
    thumbnail: string; // URL to preview image or icon name
    layers: Omit<TemplateLayer, 'id'>[];
}

export const STUDIO_TEMPLATES: StudioTemplate[] = [
    {
        id: 'news-standard',
        name: '뉴스 (Standard)',
        description: '하단 자막 바와 헤드라인이 있는 뉴스 스타일',
        thumbnail: 'news',
        layers: [
            {
                type: 'text',
                text: '메인 헤드라인 입력',
                x: 50,
                y: 550,
                width: 1000,
                height: 60,
                fontSize: 48,
                fill: '#ffffff',
                zIndex: 2
            },
            {
                type: 'text',
                text: '세부 내용이 여기에 들어갑니다.',
                x: 50,
                y: 610,
                width: 1000,
                height: 40,
                fontSize: 24,
                fill: '#cccccc',
                zIndex: 2
            },
            {
                type: 'image', // Placeholder for Lower Third
                x: 0,
                y: 530,
                width: 1280,
                height: 150,
                src: 'https://placehold.co/1280x150/000000/FFFFFF/png?text=Lower+Third+Background',
                zIndex: 1
            }
        ]
    },
    {
        id: 'talk-split',
        name: '토크쇼 (Split)',
        description: '두 명의 화자를 위한 분할 화면',
        thumbnail: 'users',
        layers: [
            {
                type: 'image',
                x: 0,
                y: 0,
                width: 640,
                height: 720,
                src: 'https://placehold.co/640x720/222222/FFFFFF/png?text=Speaker+A',
                zIndex: 1
            },
            {
                type: 'image',
                x: 640,
                y: 0,
                width: 640,
                height: 720,
                src: 'https://placehold.co/640x720/333333/FFFFFF/png?text=Speaker+B',
                zIndex: 1
            },
            {
                type: 'text',
                text: 'LIVE TALK',
                x: 540,
                y: 650,
                width: 200,
                height: 50,
                fontSize: 32,
                fill: '#ff0000',
                zIndex: 3
            }
        ]
    },
    {
        id: 'lofi-full',
        name: '로파이 (Lofi)',
        description: '전체 화면 배경과 중앙 텍스트',
        thumbnail: 'music',
        layers: [
            {
                type: 'image',
                x: 0,
                y: 0,
                width: 1280,
                height: 720,
                src: 'https://placehold.co/1280x720/1a1a2e/FFFFFF/png?text=Lofi+Background',
                zIndex: 0
            },
            {
                type: 'text',
                text: 'Chill Beats',
                x: 400,
                y: 300,
                width: 480,
                height: 80,
                fontSize: 64,
                fill: '#ffffff',
                zIndex: 1
            }
        ]
    },
    {
        id: 'webinar-pip',
        name: '웨비나 (Webinar)',
        description: '화면 공유 및 강사 카메라 (PIP)',
        thumbnail: 'presentation',
        layers: [
            {
                type: 'image',
                text: 'Screen Share',
                x: 0,
                y: 0,
                width: 1280,
                height: 720,
                src: 'https://placehold.co/1280x720/eeeeee/333333/png?text=Presentation+Screen',
                zIndex: 0
            },
            {
                type: 'image',
                text: 'Camera',
                x: 950,
                y: 50,
                width: 300,
                height: 170,
                src: 'https://placehold.co/300x170/333333/ffffff/png?text=Cam',
                zIndex: 1
            },
            {
                type: 'text',
                text: 'Live Webinar',
                x: 50,
                y: 50,
                width: 300,
                height: 40,
                fontSize: 24,
                fill: '#333333',
                zIndex: 2
            }
        ]
    }
];
