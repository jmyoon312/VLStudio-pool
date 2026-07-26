import React, { useState } from 'react';
import { BookOpen, Sparkles, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const WorkflowGuideButton = () => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                onClick={() => setOpen(true)}
                className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 animate-gradient-x group"
                size="default"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 opacity-0 group-hover:opacity-30 transition-opacity duration-300" />
                <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                <span className="relative z-10">워크플로우 가이드</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
                    <div className="relative">
                        <DialogHeader className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white p-6">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                    <BookOpen className="w-6 h-6" />
                                </div>
                                🎬 ViraLoop 워크플로우 완벽 가이드
                            </DialogTitle>
                            <p className="text-white/90 text-sm mt-2">
                                초보자부터 전문가까지, 영상 제작 자동화의 모든 것
                            </p>
                        </DialogHeader>

                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                            <Tabs defaultValue="nodes" className="w-full">
                                <TabsList className="grid w-full grid-cols-4 mb-6">
                                    <TabsTrigger value="nodes">📚 노드 설명</TabsTrigger>
                                    <TabsTrigger value="scenarios">🎯 시나리오</TabsTrigger>
                                    <TabsTrigger value="tutorial">🎓 튜토리얼</TabsTrigger>
                                    <TabsTrigger value="examples">✨ 예제</TabsTrigger>
                                </TabsList>

                                {/* Nodes Tab with Detailed Documentation */}
                                <TabsContent value="nodes" className="space-y-6">
                                    <h3 className="text-2xl font-bold mb-4">📚 전체 노드 상세 가이드</h3>

                                    {/* Input Nodes */}
                                    <div className="space-y-4">
                                        <h4 className="text-xl font-semibold text-purple-600 border-b-2 border-purple-200 pb-2">
                                            📥 입력 노드 (Input Nodes)
                                        </h4>

                                        <DetailedNodeCard
                                            icon="⏰"
                                            title="스케줄러 (Scheduler)"
                                            description="정해진 시간에 워크플로우를 자동 실행합니다."
                                            settings={[
                                                { label: "Cron 표현식", type: "text", example: "0 9 * * * (매일 9시)" },
                                                { label: "시간대", type: "select", example: "Asia/Seoul" },
                                                { label: "활성화", type: "toggle", example: "ON/OFF" }
                                            ]}
                                            steps={[
                                                "노드 더블클릭 → Inspector 열기",
                                                "Cron 표현식 입력 (예: 0 9 * * *)",
                                                "시간대 선택",
                                                "활성화 토글 ON",
                                                "저장 버튼 클릭"
                                            ]}
                                            isNew={false}
                                        />

                                        <DetailedNodeCard
                                            icon="🎯"
                                            title="수동 트리거 (Manual Trigger)"
                                            description="버튼 클릭으로 워크플로우를 즉시 실행합니다."
                                            settings={[
                                                { label: "트리거 데이터", type: "json", example: '{"script": "안녕하세요"}' }
                                            ]}
                                            steps={[
                                                "노드 더블클릭",
                                                "트리거 데이터 JSON 입력 (선택)",
                                                "저장",
                                                "▶️ 즉시 실행 버튼 클릭"
                                            ]}
                                            isNew={true}
                                        />

                                        <DetailedNodeCard
                                            icon="🌐"
                                            title="웹 스크래퍼 (Web Scraper)"
                                            description="YouTube 채널이나 웹페이지에서 콘텐츠를 자동 수집합니다."
                                            settings={[
                                                { label: "스크래핑 유형", type: "tabs", example: "YouTube 채널 / 텍스트" },
                                                { label: "URL", type: "text", example: "https://youtube.com/@channel" },
                                                { label: "수집 개수", type: "slider", example: "1~50개" },
                                                { label: "CSS 선택자", type: "text", example: "body (텍스트 모드)" }
                                            ]}
                                            steps={[
                                                "스크래핑 유형 선택",
                                                "URL 입력",
                                                "수집 개수 설정",
                                                "🔍 테스트 버튼으로 확인",
                                                "저장"
                                            ]}
                                            isNew={true}
                                        />

                                        <DetailedNodeCard
                                            icon="🎬"
                                            title="스톡 자산 (Stock Asset)"
                                            description="Pexels/Unsplash에서 무료 스톡 자산을 검색하고 다운로드합니다."
                                            settings={[
                                                { label: "소스", type: "select", example: "Pexels / Unsplash" },
                                                { label: "검색어", type: "text", example: "ocean sunset" },
                                                { label: "자산 유형", type: "select", example: "Videos / Photos" },
                                                { label: "결과 개수", type: "number", example: "1~50" },
                                                { label: "방향", type: "select", example: "Landscape / Portrait" }
                                            ]}
                                            steps={[
                                                "소스 선택 (Pexels/Unsplash)",
                                                "검색어 입력",
                                                "자산 유형 선택",
                                                "결과 개수 설정",
                                                "저장 → 자동 다운로드"
                                            ]}
                                            isNew={true}
                                        />
                                    </div>

                                    {/* Process Nodes */}
                                    <div className="space-y-4 mt-8">
                                        <h4 className="text-xl font-semibold text-pink-600 border-b-2 border-pink-200 pb-2">
                                            ⚙️ 처리 노드 (Process Nodes)
                                        </h4>

                                        <DetailedNodeCard
                                            icon="🤖"
                                            title="AI Agent"
                                            description="AI를 사용하여 텍스트 생성, 분석, 메타데이터 작성을 수행합니다."
                                            settings={[
                                                { label: "모델 선택", type: "select", example: "GPT-4 / Claude / Gemini" },
                                                { label: "프롬프트", type: "textarea", example: "다음 스크립트를 YouTube 제목으로 변환: {{script}}" },
                                                { label: "온도", type: "slider", example: "0.0~1.0" },
                                                { label: "최대 토큰", type: "number", example: "2000" }
                                            ]}
                                            steps={[
                                                "모델 선택",
                                                "프롬프트 입력 (변수 사용 가능: {{변수명}})",
                                                "온도 조절 (창의성)",
                                                "🧪 테스트 실행으로 확인",
                                                "저장"
                                            ]}
                                        />

                                        <DetailedNodeCard
                                            icon="🎤"
                                            title="TTS (음성 생성)"
                                            description="텍스트를 자연스러운 음성으로 변환합니다."
                                            settings={[
                                                { label: "엔진", type: "tabs", example: "Edge TTS / ElevenLabs / Typecast" },
                                                { label: "음성 선택", type: "select", example: "언어별 음성 목록" },
                                                { label: "속도", type: "slider", example: "0.5x ~ 2.0x" },
                                                { label: "피치", type: "slider", example: "-10 ~ +10" },
                                                { label: "침묵 제거", type: "checkbox", example: "ON/OFF" }
                                            ]}
                                            steps={[
                                                "엔진 선택",
                                                "음성 선택 → 🔊 미리듣기",
                                                "속도/피치 조절",
                                                "침묵 제거 옵션 설정",
                                                "저장"
                                            ]}
                                        />

                                        <DetailedNodeCard
                                            icon="📝"
                                            title="스튜디오 자막 (Studio Subtitle)"
                                            description="Whisper 기반으로 정확한 타이밍의 자막을 생성합니다."
                                            settings={[
                                                { label: "모드", type: "tabs", example: "Subtitle / Overlay" },
                                                { label: "스크립트", type: "textarea", example: "자막 텍스트" },
                                                { label: "스타일", type: "presets", example: "기본 / 볼드 / 네온" },
                                                { label: "Whisper 동기화", type: "toggle", example: "ON/OFF" },
                                                { label: "폰트/색상", type: "picker", example: "Arial, #FFFFFF" }
                                            ]}
                                            steps={[
                                                "모드 선택 (Subtitle/Overlay)",
                                                "스크립트 입력",
                                                "스타일 프리셋 선택",
                                                "Whisper 동기화 ON",
                                                "👁️ 미리보기 확인",
                                                "저장"
                                            ]}
                                            isNew={true}
                                        />

                                        <DetailedNodeCard
                                            icon="🎵"
                                            title="오디오 믹스 (Audio Mix)"
                                            description="음성과 BGM을 자동으로 믹싱합니다. Auto-Ducking 지원."
                                            settings={[
                                                { label: "Voice 입력", type: "connection", example: "TTS 노드 연결" },
                                                { label: "BGM 입력", type: "connection", example: "Asset Loader 연결" },
                                                { label: "BGM 볼륨", type: "slider", example: "0.0~1.0" },
                                                { label: "Auto-Ducking", type: "toggle", example: "ON/OFF" },
                                                { label: "Ducking 강도", type: "slider", example: "0.0~1.0" }
                                            ]}
                                            steps={[
                                                "Voice 입력 연결 (TTS)",
                                                "BGM 입력 연결 (Asset)",
                                                "BGM 볼륨 조절",
                                                "Auto-Ducking ON (음성 시 BGM 자동 감소)",
                                                "🔊 미리듣기",
                                                "저장"
                                            ]}
                                            isNew={true}
                                        />

                                        <DetailedNodeCard
                                            icon="⏸️"
                                            title="수동 작업 (Manual Task)"
                                            description="워크플로우를 일시 중지하고 사용자 승인/입력을 대기합니다."
                                            settings={[
                                                { label: "작업 유형", type: "tabs", example: "승인 / 입력 / 파일업로드" },
                                                { label: "메시지", type: "text", example: "승인이 필요합니다" },
                                                { label: "타임아웃", type: "number", example: "60분" },
                                                { label: "타임아웃 동작", type: "select", example: "자동승인 / 거부 / 스킵" },
                                                { label: "알림 채널", type: "multiselect", example: "Email / Slack" }
                                            ]}
                                            steps={[
                                                "작업 유형 선택",
                                                "메시지 입력",
                                                "타임아웃 설정",
                                                "알림 채널 선택",
                                                "저장 → 실행 시 승인 대기"
                                            ]}
                                            isNew={true}
                                        />
                                    </div>

                                    {/* Distribution Nodes */}
                                    <div className="space-y-4 mt-8">
                                        <h4 className="text-xl font-semibold text-blue-600 border-b-2 border-blue-200 pb-2">
                                            📤 배포 노드 (Distribution Nodes)
                                        </h4>

                                        <DetailedNodeCard
                                            icon="🔗"
                                            title="웹훅 (Webhook)"
                                            description="외부 시스템과 HTTP 통신을 수행합니다."
                                            settings={[
                                                { label: "유형", type: "tabs", example: "발신 (Outgoing) / 수신 (Incoming)" },
                                                { label: "URL", type: "text", example: "https://api.example.com/endpoint" },
                                                { label: "메서드", type: "select", example: "GET / POST / PUT / DELETE" },
                                                { label: "헤더", type: "keyvalue", example: "Authorization: Bearer token" },
                                                { label: "바디", type: "json", example: '{"data": "{{input}}"}' },
                                                { label: "인증", type: "select", example: "None / API Key / Basic" },
                                                { label: "재시도", type: "number", example: "0~10회" },
                                                { label: "타임아웃", type: "number", example: "30초" }
                                            ]}
                                            steps={[
                                                "유형 선택 (Outgoing)",
                                                "URL 입력",
                                                "메서드 선택",
                                                "헤더/바디 설정",
                                                "인증 설정",
                                                "재시도 정책 설정",
                                                "저장"
                                            ]}
                                            isNew={true}
                                        />

                                        <DetailedNodeCard
                                            icon="📤"
                                            title="배포 매니저 (Distribution)"
                                            description="YouTube, Music, Camera에 동시 업로드합니다."
                                            settings={[
                                                { label: "플랫폼", type: "checkbox", example: "☑️ YouTube / Music / Camera" },
                                                { label: "제목", type: "text", example: "영상 제목" },
                                                { label: "설명", type: "textarea", example: "영상 설명" },
                                                { label: "태그", type: "tags", example: "tag1, tag2, tag3" },
                                                { label: "공개 범위", type: "select", example: "공개 / 비공개 / 일부공개" }
                                            ]}
                                            steps={[
                                                "플랫폼 선택 (다중 선택 가능)",
                                                "제목/설명 입력",
                                                "태그 입력 (쉼표 구분)",
                                                "공개 범위 설정",
                                                "📤 즉시 업로드 또는 저장"
                                            ]}
                                            isNew={true}
                                        />

                                        <DetailedNodeCard
                                            icon="📊"
                                            title="레퍼런스 감시 (Reference Monitor)"
                                            description="특정 채널/키워드를 모니터링하여 새 콘텐츠 발견 시 자동 트리거합니다."
                                            settings={[
                                                { label: "모니터링 유형", type: "tabs", example: "YouTube 채널 / RSS / 키워드" },
                                                { label: "채널 URL", type: "text", example: "https://youtube.com/@channel" },
                                                { label: "체크 간격", type: "select", example: "5분 / 10분 / 30분 / 60분" },
                                                { label: "최신 영상 개수", type: "number", example: "1~10개" },
                                                { label: "최소 조회수", type: "number", example: "1000" },
                                                { label: "키워드 포함", type: "text", example: "필수 키워드" }
                                            ]}
                                            steps={[
                                                "모니터링 유형 선택",
                                                "채널 URL 또는 키워드 입력",
                                                "체크 간격 설정",
                                                "필터링 조건 설정 (조회수, 키워드 등)",
                                                "저장 → 자동 모니터링 시작"
                                            ]}
                                            isNew={true}
                                        />
                                    </div>

                                    <div className="mt-8 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                                        <h4 className="font-semibold text-purple-900 mb-2">💡 공통 팁</h4>
                                        <ul className="text-sm text-purple-800 space-y-1">
                                            <li>• 노드 연결: 출력 핸들(오른쪽) → 입력 핸들(왼쪽)</li>
                                            <li>• 자동 저장: 설정 변경 후 3초</li>
                                            <li>• 수동 저장: Ctrl+S</li>
                                            <li>• 디버깅: 노드 우클릭 → "로그 보기"</li>
                                        </ul>
                                    </div>
                                </TabsContent>

                                {/* Scenarios Tab */}
                                <TabsContent value="scenarios" className="space-y-4">
                                    <h3 className="text-2xl font-bold mb-4">🎯 실전 시나리오</h3>

                                    <ScenarioCard
                                        title="시나리오 1: AI 자동 콘텐츠 생성"
                                        difficulty="중급"
                                        time="5분"
                                        workflow={[
                                            "Manual Trigger (스크립트 입력)",
                                            "AI Agent (이미지 프롬프트 생성)",
                                            "TTS (음성 생성)",
                                            "Video Gen (영상 결합)",
                                            "Studio Subtitle (자막 추가)",
                                            "Distribution (업로드)"
                                        ]}
                                        result="스크립트 입력만으로 완성 영상 자동 생성 및 업로드"
                                    />

                                    <ScenarioCard
                                        title="시나리오 2: 트렌드 쇼츠 자동화"
                                        difficulty="고급"
                                        time="자동"
                                        workflow={[
                                            "Scheduler (매일 9시)",
                                            "Web Scraper (YouTube 트렌드)",
                                            "Asset Loader (영상 다운로드)",
                                            "Smart Cut (하이라이트 추출)",
                                            "Crop Template (9:16 변환)",
                                            "Upload to Queue"
                                        ]}
                                        result="매일 자동으로 트렌드 쇼츠 생성"
                                    />

                                    <ScenarioCard
                                        title="시나리오 3: 스톡 자산 활용 영상 제작"
                                        difficulty="초급"
                                        time="3분"
                                        workflow={[
                                            "Stock Asset (Pexels 검색)",
                                            "TTS (내레이션 생성)",
                                            "Audio Mix (BGM 추가)",
                                            "Studio Subtitle (자막)",
                                            "Distribution (업로드)"
                                        ]}
                                        result="무료 스톡 자산으로 전문가급 영상 제작"
                                    />

                                    <ScenarioCard
                                        title="시나리오 4: 웹훅 연동 자동화"
                                        difficulty="고급"
                                        time="즉시"
                                        workflow={[
                                            "Webhook (외부 트리거 수신)",
                                            "AI Agent (콘텐츠 분석)",
                                            "Manual Task (승인 대기)",
                                            "Video Gen (영상 생성)",
                                            "Webhook (완료 알림 발신)"
                                        ]}
                                        result="외부 시스템과 완전 자동화된 워크플로우"
                                    />
                                </TabsContent>

                                {/* Tutorial Tab */}
                                <TabsContent value="tutorial" className="space-y-4">
                                    <h3 className="text-2xl font-bold mb-4">🎓 초보자 튜토리얼</h3>

                                    <TutorialStep
                                        number={1}
                                        title="첫 워크플로우 만들기"
                                        time="5분"
                                        steps={[
                                            "워크플로우 페이지 접속",
                                            '"+ 새 시나리오 만들기" 클릭',
                                            "빈 캔버스 확인"
                                        ]}
                                    />

                                    <TutorialStep
                                        number={2}
                                        title="노드 추가 및 연결"
                                        time="5분"
                                        steps={[
                                            "좌측 팔레트에서 노드 드래그",
                                            "노드의 오른쪽 핸들 → 다음 노드의 왼쪽 핸들 연결",
                                            "화살표 애니메이션 확인"
                                        ]}
                                    />

                                    <TutorialStep
                                        number={3}
                                        title="노드 설정하기"
                                        time="5분"
                                        steps={[
                                            "노드 더블클릭하여 Inspector 열기",
                                            "필요한 설정 입력",
                                            "자동 저장 확인 (3초 후)"
                                        ]}
                                    />

                                    <TutorialStep
                                        number={4}
                                        title="워크플로우 실행"
                                        time="5분"
                                        steps={[
                                            '"시나리오 저장 (Ctrl+S)" 클릭',
                                            '"실행" 버튼 클릭',
                                            "각 노드의 실행 상태 확인"
                                        ]}
                                    />

                                    <TutorialStep
                                        number={5}
                                        title="첫 영상 업로드"
                                        time="15분"
                                        steps={[
                                            "Asset Loader → Upload to Queue 연결",
                                            "영상 선택 및 메타데이터 입력",
                                            "Work Queue에서 승인 후 업로드"
                                        ]}
                                    />
                                </TabsContent>

                                {/* Examples Tab */}
                                <TabsContent value="examples" className="space-y-4">
                                    <h3 className="text-2xl font-bold mb-4">✨ 템플릿 예제</h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <TemplateCard
                                            title="기본 업로드"
                                            nodes="2개"
                                            difficulty="⭐"
                                            description="갤러리 영상을 YouTube에 업로드"
                                        />

                                        <TemplateCard
                                            title="AI 콘텐츠 생성"
                                            nodes="6개"
                                            difficulty="⭐⭐⭐"
                                            description="스크립트 → 완성 영상 자동 생성"
                                        />

                                        <TemplateCard
                                            title="쇼츠 자동화"
                                            nodes="5개"
                                            difficulty="⭐⭐"
                                            description="긴 영상 → 여러 쇼츠 자동 생성"
                                        />

                                        <TemplateCard
                                            title="다국어 배포"
                                            nodes="8개"
                                            difficulty="⭐⭐⭐⭐"
                                            description="1개 영상 → 3개 언어 자동 번역"
                                        />
                                    </div>

                                    <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                                        <h4 className="font-semibold text-purple-900 mb-2">💡 Pro Tip</h4>
                                        <p className="text-sm text-purple-800">
                                            자주 사용하는 워크플로우는 저장해두고 재사용하세요!
                                            Ctrl+C, Ctrl+V로 노드를 복사할 수 있습니다.
                                        </p>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes gradient-x {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .animate-gradient-x {
                    background-size: 200% 200%;
                    animation: gradient-x 3s ease infinite;
                }
            `}} />
        </>
    );
};

// Enhanced DetailedNodeCard Component
interface DetailedNodeCardProps {
    icon: string;
    title: string;
    description: string;
    settings: Array<{ label: string; type: string; example: string }>;
    steps: string[];
    isNew?: boolean;
}

const DetailedNodeCard: React.FC<DetailedNodeCardProps> = ({ icon, title, description, settings, steps, isNew = false }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="border-2 border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200">
            <div
                className="p-4 bg-gradient-to-r from-gray-50 to-white cursor-pointer hover:from-gray-100 hover:to-gray-50"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-start gap-3">
                    <div className="text-3xl">{icon}</div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-bold text-lg">{title}</h5>
                            {isNew && (
                                <span className="px-2 py-0.5 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full">
                                    NEW
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-600">{description}</p>
                    </div>
                    <div className="text-slate-600">
                        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                </div>
            </div>

            {expanded && (
                <div className="p-4 bg-white border-t-2 border-gray-100 space-y-4">
                    {/* Settings */}
                    <div>
                        <h6 className="font-semibold text-purple-700 mb-2 flex items-center gap-2">
                            ⚙️ Inspector 설정
                        </h6>
                        <div className="space-y-2">
                            {settings.map((setting, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm">
                                    <span className="font-medium text-gray-700 min-w-[120px]">
                                        {setting.label}:
                                    </span>
                                    <span className="text-gray-600">
                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono">
                                            {setting.type}
                                        </span>
                                        {' '}
                                        <span className="text-gray-500">예: {setting.example}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Steps */}
                    <div>
                        <h6 className="font-semibold text-pink-700 mb-2 flex items-center gap-2">
                            📋 사용 방법
                        </h6>
                        <ol className="space-y-1">
                            {steps.map((step, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-bold">
                                        {idx + 1}
                                    </span>
                                    <span className="text-gray-700 pt-0.5">{step}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper Components
const ScenarioCard: React.FC<{ title: string, difficulty: string, time: string, workflow: string[], result: string }> = ({ title, difficulty, time, workflow, result }) => (
    <div className="p-5 border-2 border-purple-200 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 hover:shadow-lg transition-all duration-300">
        <div className="flex items-start justify-between mb-3">
            <h4 className="font-bold text-lg">{title}</h4>
            <div className="flex gap-2">
                <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">{difficulty}</span>
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">⏱️ {time}</span>
            </div>
        </div>
        <div className="space-y-2 mb-3">
            {workflow.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                        {i + 1}
                    </div>
                    <span>{step}</span>
                </div>
            ))}
        </div>
        <div className="pt-3 border-t border-purple-200">
            <p className="text-sm font-semibold text-purple-900">✨ 결과: {result}</p>
        </div>
    </div>
);

const TutorialStep: React.FC<{ number: number, title: string, time: string, steps: string[] }> = ({ number, title, time, steps }) => (
    <div className="p-4 border-l-4 border-blue-500 bg-blue-50 rounded-r-lg">
        <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                {number}
            </div>
            <div>
                <h4 className="font-semibold">{title}</h4>
                <span className="text-xs text-blue-600">⏱️ {time}</span>
            </div>
        </div>
        <ul className="space-y-2 ml-11">
            {steps.map((step, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span>{step}</span>
                </li>
            ))}
        </ul>
    </div>
);

const TemplateCard: React.FC<{ title: string, nodes: string, difficulty: string, description: string }> = ({ title, nodes, difficulty, description }) => (
    <div className="p-4 border rounded-lg hover:shadow-md transition-all duration-200 cursor-pointer hover:-translate-y-1 bg-white">
        <h4 className="font-semibold mb-2">{title}</h4>
        <div className="flex gap-2 mb-2">
            <span className="px-2 py-1 text-xs bg-gray-100 rounded">{nodes}</span>
            <span className="px-2 py-1 text-xs bg-yellow-100 rounded">{difficulty}</span>
        </div>
        <p className="text-sm text-gray-600">{description}</p>
        <Button size="sm" className="w-full mt-3" variant="outline">
            템플릿 사용하기
        </Button>
    </div>
);

export default WorkflowGuideButton;
