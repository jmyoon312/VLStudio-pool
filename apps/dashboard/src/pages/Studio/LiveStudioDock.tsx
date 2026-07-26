import React, { useState, useRef, ChangeEvent } from 'react';
import {
    Image,
    Type,
    Layers,
    Monitor,
    Search,
    Plus,
    Video as VideoIcon,
    Loader2,
    LayoutTemplate
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api, { Video } from '../../lib/api';
import { useStudioStore } from './store/useStudioStore';
import { getMediaUrl } from '@/lib/utils';
import { resolveFileUrl } from '@/utils/fileUrl';
import { STUDIO_TEMPLATES, StudioTemplate } from './data/templates';
import { v4 as uuidv4 } from 'uuid';

type Tab = 'media' | 'text' | 'widget' | 'template';

export const LiveStudioDock: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('media');
    const [searchQuery, setSearchQuery] = useState('');

    const { addLayer, setLayers } = useStudioStore();

    const handleApplyTemplate = (template: StudioTemplate) => {
        if (!confirm('현재 레이아웃이 초기화됩니다. 계속하시겠습니까?')) return;

        // Map template layers to real layers with IDs
        const newLayers = template.layers.map(l => ({
            ...l,
            id: uuidv4()
        }));

        setLayers(newLayers);
    };

    // Fetch Videos from Gallery API (Strict: studio_assets only)
    const { data: videos, isLoading } = useQuery<Video[]>({
        queryKey: ['studio-gallery-assets'],
        queryFn: async () => {
            const res = await api.get<Video[]>('/videos/', { params: { mode: 'video', folder: 'studio_assets' } });
            return res.data;
        }
    });

    const handleAddMedia = (video: Video) => {
        const fileUrl = resolveFileUrl(video.file_path);
        const thumbUrl = getMediaUrl(video.thumbnail_path); // User Request: No Fallback, show broken if missing

        // Check extension
        const isVideo = video.file_path.endsWith('.mp4') || video.file_path.endsWith('.webm');

        addLayer({
            type: isVideo ? 'video' : 'image',
            src: thumbUrl || '', // If null, src is empty -> broken image
            videoSrc: isVideo ? fileUrl : undefined,
            x: 100,
            y: 100,
            width: 480,
            height: 270,
            scaleX: 1,
            scaleY: 1
        });
    };

    const handleAddText = (text: string, fontSize: number) => {
        addLayer({
            type: 'text',
            text: text,
            fontSize: fontSize,
            fill: '#ffffff',
            x: 200,
            y: 200,
            width: 300,
            height: 50,
            scaleX: 1,
            scaleY: 1
        });
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Mock upload - in real app would upload to server
            alert(`File selected: ${file.name}. (Upload logic to be implemented)`);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-200 w-48 flex-shrink-0 transition-all duration-300">

            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*"
                onChange={handleFileUpload}
            />

            {/* 1. Tabs */}
            <div className="flex border-b border-gray-200">
                <button onClick={() => setActiveTab('media')} className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-bold uppercase transition-colors ${activeTab === 'media' ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600' : 'text-slate-600 hover:text-gray-600 hover:bg-gray-50'}`}>
                    <Image className="w-4 h-4" /> 미디어
                </button>
                <button onClick={() => setActiveTab('text')} className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-bold uppercase transition-colors ${activeTab === 'text' ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600' : 'text-slate-600 hover:text-gray-600 hover:bg-gray-50'}`}>
                    <Type className="w-4 h-4" /> 텍스트
                </button>
                <button onClick={() => setActiveTab('template')} className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-bold uppercase transition-colors ${activeTab === 'template' ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600' : 'text-slate-600 hover:text-gray-600 hover:bg-gray-50'}`}>
                    <LayoutTemplate className="w-4 h-4" /> 템플릿
                </button>
            </div>

            {/* 2. Search */}
            <div className="p-3 border-b border-gray-200">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-600" />
                    <input
                        type="text"
                        placeholder="자산 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-100 text-gray-900 text-xs rounded-md pl-8 pr-3 py-1.5 border border-transparent focus:bg-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
                    />
                </div>
            </div>

            {/* 3. Content Grid */}
            <div className="flex-1 overflow-y-auto p-3">
                {activeTab === 'media' && (
                    <div className="grid grid-cols-1 gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-video bg-gray-50 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center text-slate-600 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 transition-all"
                        >
                            <Plus className="w-5 h-5 mb-1" />
                            <span className="text-xs font-medium">업로드</span>
                        </button>

                        {isLoading ? (
                            <div className="col-span-1 flex justify-center py-10">
                                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                            </div>
                        ) : (
                            videos?.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase())).map((video) => (
                                <div
                                    key={video.id}
                                    onClick={() => handleAddMedia(video)}
                                    className="aspect-video bg-gray-100 rounded-lg overflow-hidden relative group cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-blue-500 shadow-sm transition-all"
                                >
                                    {/* Thumbnail or Placeholder */}
                                    <img
                                        src={getMediaUrl(video.thumbnail_path) || ''}
                                        alt={video.title}
                                        className="w-full h-full object-cover bg-gray-200"
                                    />

                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity p-2 text-center backdrop-blur-[1px]">
                                        <Plus className="w-5 h-5 text-white mb-1 drop-shadow-md" />
                                        <span className="text-[10px] text-white font-bold line-clamp-1 drop-shadow-md">{video.title}</span>
                                    </div>

                                    {/* Type Badge */}
                                    <div className="absolute top-1 right-1 bg-black/60 backdrop-blur-sm px-1 py-0.5 rounded text-[9px] text-white font-medium">
                                        {video.file_path.endsWith('.mp4') ? 'VID' : 'IMG'}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'text' && (
                    <div className="space-y-3">
                        <div onClick={() => handleAddText('제목', 48)} className="p-4 bg-[#2a2a2a] rounded border border-slate-200 cursor-pointer hover:border-white hover:bg-[#333]">
                            <h1 className="text-2xl font-bold text-white pointer-events-none">제목 (Heading)</h1>
                        </div>
                        <div onClick={() => handleAddText('부제목', 32)} className="p-4 bg-[#2a2a2a] rounded border border-slate-200 cursor-pointer hover:border-white hover:bg-[#333]">
                            <h3 className="text-lg font-semibold text-white pointer-events-none">부제목 (Subheading)</h3>
                        </div>
                        <div onClick={() => handleAddText('본문 내용', 18)} className="p-4 bg-[#2a2a2a] rounded border border-slate-200 cursor-pointer hover:border-white hover:bg-[#333]">
                            <p className="text-sm text-slate-700 pointer-events-none">본문 내용 (Body Text)</p>
                        </div>
                    </div>
                )}

                {activeTab === 'widget' && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-[#2a2a2a] rounded border border-slate-200 cursor-pointer hover:border-white">
                            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center text-green-500">
                                <Layers className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-white">채팅창</div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'template' && (
                    <div className="grid grid-cols-1 gap-4">
                        {STUDIO_TEMPLATES.map(template => (
                            <div
                                key={template.id}
                                onClick={() => handleApplyTemplate(template)}
                                className="group relative aspect-video bg-[#2a2a2a] rounded-lg border border-slate-200 hover:border-blue-500 cursor-pointer overflow-hidden"
                            >
                                {/* Placeholder Preview */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                                    <LayoutTemplate className="w-8 h-8 text-gray-600 mb-2 group-hover:text-blue-500" />
                                    <span className="text-sm font-bold text-slate-700 group-hover:text-white">{template.name}</span>
                                    <span className="text-[10px] text-gray-500 text-center mt-1 px-4">{template.description}</span>
                                </div>

                                <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
};
