import React from 'react';
import {
    Music,
    Mic,
    GraduationCap,
    Sliders,
    X
} from 'lucide-react';

export type RecipeType = 'lofi' | 'talk' | 'webinar' | 'custom' | null;

interface LiveStudioRecipeModalProps {
    onSelect: (recipe: RecipeType) => void;
    onClose: () => void;
}

export const LiveStudioRecipeModal: React.FC<LiveStudioRecipeModalProps> = ({ onSelect, onClose }) => {
    const recipes = [
        {
            id: 'lofi' as RecipeType,
            title: '24/7 로파이 라디오',
            icon: <Music className="w-8 h-8 text-purple-500" />,
            subtitle: '무한 반복 + 자동 셔플 재생목록',
            desc: 'PC를 꺼도 방송 유지 (클라우드 호스팅)',
            color: 'hover:border-purple-200 hover:bg-purple-50 shadow-sm hover:shadow-md'
        },
        {
            id: 'talk' as RecipeType,
            title: '라이브 토크 / 팟캐스트',
            icon: <Mic className="w-8 h-8 text-green-500" />,
            subtitle: '웹캠 + 실시간 채팅 오버레이',
            desc: '소통 방송에 최적화된 화면 구성',
            color: 'hover:border-green-200 hover:bg-green-50 shadow-sm hover:shadow-md'
        },
        {
            id: 'webinar' as RecipeType,
            title: '웨비나 / 온라인 강의',
            icon: <GraduationCap className="w-8 h-8 text-blue-500" />,
            subtitle: '화면 공유 + 강사 카메라 (PIP)',
            desc: '강의 및 프레젠테이션 모드',
            color: 'hover:border-blue-200 hover:bg-blue-50 shadow-sm hover:shadow-md'
        },
        {
            id: 'custom' as RecipeType,
            title: '커스텀 (고급 설정)',
            icon: <Sliders className="w-8 h-8 text-gray-500" />,
            subtitle: '빈 캔버스에서 시작하기',
            desc: '자유로운 화면 배치 및 구성',
            color: 'hover:border-gray-200 hover:bg-gray-50 shadow-sm hover:shadow-md'
        }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all scale-100">

                {/* Header */}
                <div className="p-8 pb-4 text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">어떤 방송을 시작하시겠습니까?</h2>
                    <p className="text-gray-500">원하시는 방송 형태를 선택하면, 최적의 화면을 자동으로 구성해드립니다.</p>
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-700 hover:text-gray-500 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Cards Grid */}
                <div className="p-8 pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {recipes.map((recipe) => (
                        <button
                            key={recipe.id}
                            onClick={() => onSelect(recipe.id)}
                            className={`group relative flex flex-col items-center p-6 bg-white border border-gray-100 rounded-xl transition-all duration-200 ${recipe.color} text-left`}
                        >
                            <div className="mb-4 p-4 bg-gray-50 border border-gray-100 rounded-full group-hover:scale-110 transition-transform duration-200">
                                {recipe.icon}
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">{recipe.title}</h3>
                            <p className="text-sm text-gray-500 font-medium mb-2">{recipe.subtitle}</p>
                            <p className="text-xs text-slate-600">{recipe.desc}</p>

                            {/* Select Badge on Hover */}
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                                    선택
                                </span>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-center">
                    <button onClick={onClose} className="text-slate-600 hover:text-gray-600 text-sm font-medium hover:underline transition-colors">
                        건너뛰고 빈 프로젝트 열기
                    </button>
                </div>

            </div>
        </div>
    );
};
