import React from 'react';
import {
    BookOpen,
    Search,
    Zap,
    Video,
    Workflow,
    ChevronRight,
    Play,
    BarChart3,
    Download,
    Image as ImageIcon,
    Sparkles,
    Clapperboard,
    Scissors,
    Edit,
    Languages,
    Mic,
    Wand2,
    Share2,
    Activity,
    Shield,
    ListVideo,
    UploadCloud,
    FileText,
    LayoutGrid,
    Settings,
    TrendingUp,
    Globe,
    CheckCircle2,
    MousePointerClick,
    Info,
    Eraser,
    Radio,
    Moon,
    Sun
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

export default function GuideCenter() {
    // [FIX] Full Synchronization with Layout.tsx + Detailed Content for EVERY item
    const detailedGuides: Record<string, { image?: string; titleOverride?: string; overview: string; features: { icon: any; title: string; desc: string; }[]; steps: string[]; }> = {
        // --- 1. Analytics & Insights (분석 & 인사이트) ---
        dashboard: {
            image: "guide/dashboard.png",
            overview: "ViraLoop의 시작점이자 관제 센터입니다. 현재 시스템의 상태, 등록된 채널의 현황, 그리고 최근 발생한 중요 활동들을 한눈에 파악할 수 있습니다.",
            features: [
                {
                    icon: Activity,
                    title: "시스템 상태 모니터링",
                    desc: "화면 상단의 카드는 전체 시스템의 상태를 보여줍니다. 'Total Channels'는 관리 중인 총 채널 수, 'Active Monitoring'은 현재 실시간으로 추적 중인 채널 수를 의미합니다."
                },
                {
                    icon: TrendingUp,
                    title: "활동 타임라인",
                    desc: "우측 패널에는 최근 다운로드된 영상, 실행된 워크플로우 등 시스템의 모든 활동 로그가 실시간으로 기록됩니다. 클릭 시 해당 화면으로 즉시 이동합니다."
                }
            ],
            steps: [
                "좌측 사이드바에서 '통합 대시보드'를 클릭하여 접근합니다.",
                "상단 지표 카드를 통해 전체 현황을 빠르게 확인하세요.",
                "특정 활동을 자세히 보고 싶다면 활동 로그의 해당 항목을 클릭하여 이동할 수 있습니다."
            ]
        },
        captain: {
            // Placeholder image if specific one missing, fallback to dashboard
            image: "guide/dashboard.png",
            overview: "특정 YouTube 채널의 성과를 깊이 있게 분석하는 '캡틴' 전용 대시보드입니다. 구독자 증가 추이, 조회수 폭발 지점, 시청자 반응 등을 정밀하게 분석합니다.",
            features: [
                {
                    icon: BarChart3,
                    title: "채널 성장 분석",
                    desc: "지난 30일간의 구독자 및 조회수 변화를 그래프로 시각화하여 성장 모멘텀을 파악합니다."
                },
                {
                    icon: Globe,
                    title: "경쟁 채널 비교",
                    desc: "등록된 레퍼런스 채널들과 성과를 비교하여 내 채널의 위치를 객관적으로 진단합니다."
                }
            ],
            steps: [
                "메뉴에서 '캡틴 대시보드'를 선택합니다.",
                "상단 드롭다운에서 분석하고자 하는 내 채널(Captain 계정)을 선택합니다.",
                "각 지표 탭을 클릭하여 상세 데이터를 확인합니다."
            ]
        },
        keyword: {
            image: "guide/script_lab.png", // Reusing script lab image for text heavy feature
            overview: "현재 유튜브에서 트렌딩하고 있는 키워드를 발굴하고, 해당 키워드의 경쟁 강도를 분석하여 '이길 수 있는' 주제를 찾아줍니다.",
            features: [
                {
                    icon: Search,
                    title: "키워드 발굴",
                    desc: "핵심 주제를 입력하면 연관 검색어와 조회수 급상승 키워드를 추천합니다."
                },
                {
                    icon: TrendingUp,
                    title: "경쟁도 분석",
                    desc: "해당 키워드로 검색했을 때 상위 노출될 확률을 AI가 계산하여 제공합니다."
                }
            ],
            steps: [
                "메뉴에서 '키워드 탐색기'를 클릭합니다.",
                "관심 주제(예: '재테크', '다이어트')를 검색창에 입력합니다.",
                "추천 키워드 목록에서 경쟁도가 낮은 '블루 오션' 키워드를 찾습니다."
            ]
        },
        reports: {
            image: "guide/dashboard.png",
            overview: "매일 아침, 전날의 성과와 주요 이벤트를 정리하여 리포트로 제공합니다. 일일 브리핑을 통해 놓치기 쉬운 트렌드를 점검하세요.",
            features: [
                {
                    icon: FileText,
                    title: "자동 생성 리포트",
                    desc: "매일 설정된 시간에 전날 수집된 데이터와 활동 내역을 기반으로 리포트가 자동 생성됩니다."
                },
                {
                    icon: Download,
                    title: "PDF 내보내기",
                    desc: "리포트를 PDF로 다운로드하여 팀원들과 공유하거나 보관할 수 있습니다."
                }
            ],
            steps: [
                "메뉴에서 '일일 리포트'를 클릭합니다.",
                "날짜를 선택하여 과거 리포트를 조회합니다.",
                "주요 인사이트 섹션을 중점적으로 읽어보세요."
            ]
        },

        // --- 2. Content Sourcing (콘텐츠 소싱) ---
        channels_ref: { // Renamed from 'channels' to avoid conflict or clarify
            image: "guide/channels.png",
            titleOverride: "레퍼런스 채널 관리",
            overview: "벤치마킹할 유튜브 채널을 등록하고 관리하는 곳입니다. 여기에 등록된 채널들은 시스템이 24시간 감시하며 신규 영상을 수집합니다.",
            features: [
                {
                    icon: ListVideo,
                    title: "채널 등록 및 카테고리",
                    desc: "유튜브 채널 URL만 넣으면 자동으로 등록됩니다. '뉴스', '예능' 등 카테고리별로 분류하여 체계적으로 감시합니다."
                },
                {
                    icon: Activity,
                    title: "자동 수집 상태 모니터링",
                    desc: "각 채널별 마지막 확인 시간, 마지막 업로드 영상 정보를 실시간으로 보여줍니다."
                }
            ],
            steps: [
                "메뉴에서 '레퍼런스 채널'을 클릭합니다.",
                "우측 상단 '채널 추가' 버튼을 누릅니다.",
                "URL 입력 후 '추가'를 누르면 즉시 모니터링이 시작됩니다."
            ]
        },
        download: {
            image: "guide/gallery.png", // Reuse gallery or ideally distinct
            overview: "특정 영상 URL을 직접 입력하여 즉시 다운로드하고 분석 대기열에 추가합니다. 자동 수집 외에 수동으로 급하게 필요한 자료를 확보할 때 유용합니다.",
            features: [
                {
                    icon: Download,
                    title: "고화질 다운로드",
                    desc: "최대 4K 화질까지 지원하며, 영상 파일뿐만 아니라 섬네일, 자막 데이터까지 한 번에 가져옵니다."
                }
            ],
            steps: [
                "메뉴에서 '영상 다운로드'를 선택합니다.",
                "유튜브 영상 URL을 붙여넣고 '다운로드 시작'을 클릭합니다.",
                "완료되면 자동으로 '갤러리'에 추가됩니다."
            ]
        },
        gallery: {
            image: "guide/gallery.png",
            overview: "수집된 모든 영상 자산이 모이는 보물창고입니다. Viral Score(조회수 급상승 지표)를 통해 어떤 영상이 현재 뜨고 있는지 한눈에 파악할 수 있습니다.",
            features: [
                {
                    icon: Zap,
                    title: "Viral Score 분석",
                    desc: "채널 평균 대비 조회수가 높은 '대박 영상'을 빨간색 Viral 배지로 표시합니다. 이 점수가 높은 소재를 우선적으로 참고하세요."
                },
                {
                    icon: Play,
                    title: "대시보드형 미리보기",
                    desc: "카드를 클릭하면 다이얼로그 창에서 영상 재생과 함께 상세 메타데이터(태그, 설명란, 댓글 반응 등)를 볼 수 있습니다."
                }
            ],
            steps: [
                "메뉴에서 '갤러리'를 선택합니다.",
                "필터(Viral Only, 최근 업로드 등)를 활용해 영상을 좁혀서 봅니다.",
                "분석하고 싶은 영상 카드를 클릭합니다."
            ]
        },
        script_lab: {
            image: "guide/script_lab.png",
            overview: "영상은 필요 없고, '내용'만 핵심적으로 보고 싶을 때 사용하는 강력한 텍스트 분석 도구입니다. 수천 개의 영상 자막을 텍스트 데이터베이스로 구축합니다.",
            features: [
                {
                    icon: FileText,
                    title: "대용량 자막 검색",
                    desc: "엑셀처럼 정리된 그리드에서 특정 키워드(예: 'AI', '비트코인')가 포함된 문장을 0.1초 만에 검색합니다."
                },
                {
                    icon: Edit,
                    title: "스크립트 내보내기",
                    desc: "원하는 자막을 선택하여 클립보드로 복사하거나, AI 작가에게 바로 보내 새로운 대본으로 각색할 수 있습니다."
                }
            ],
            steps: [
                "메뉴에서 '자막 수집'을 클릭합니다.",
                "리스트에서 흥미로운 제목을 클릭하여 전체 스크립트를 읽습니다.",
                "필요한 부분은 드래그하여 복사하거나 저장합니다."
            ]
        },

        // --- 3. Content Creation (콘텐츠 제작) ---
        studio: {
            image: "guide/dashboard.png", // Placeholder
            titleOverride: "스튜디오 (Creative Studio)",
            overview: "웹 브라우저에서 바로 작동하는 전문 영상 편집 도구입니다. 컷 편집, 자막 추가, 효과 삽입 등 프리미어 프로급의 기능을 웹에서 수행합니다.",
            features: [
                {
                    icon: Clapperboard,
                    title: "타임라인 편집",
                    desc: "여러 트랙을 지원하는 타임라인에서 영상을 자르고 붙이고, 오디오를 믹싱할 수 있습니다."
                },
                {
                    icon: Zap,
                    title: "AI 효과 자동 적용",
                    desc: "AI가 분석한 하이라이트 구간을 자동으로 컷 편집하거나, 자막 스타일을 일괄 적용할 수 있습니다."
                }
            ],
            steps: [
                "메뉴에서 '스튜디오'를 클릭합니다.",
                "새 프로젝트를 생성하고 '갤러리'에서 소스를 불러옵니다.",
                "편집을 마치고 '내보내기'를 눌러 영상을 완성합니다."
            ]
        },
        cut_editor: {
            image: "guide/dashboard.png",
            overview: "오로지 '자르기'에만 집중한 초고속 편집 도구입니다. 긴 영상에서 필요한 부분만 빠르게 발췌하여 쇼츠(Shorts)로 만들 때 최적화되어 있습니다.",
            features: [
                {
                    icon: Scissors,
                    title: "장면 감지 (Scene Detection)",
                    desc: "화면 전환이 일어나는 지점을 자동으로 찾아내어 클립을 분할해줍니다."
                }
            ],
            steps: [
                "메뉴에서 '컷 편집'을 선택합니다.",
                "영상을 로드하고 타임라인에서 'I'(시작점)와 'O'(끝점) 단축키로 구간을 설정합니다.",
                "'추출하기' 버튼을 누릅니다."
            ]
        },
        remover: {
            image: "guide/dashboard.png",
            overview: "영상 내의 불필요한 자막, 워터마크, 로고 등을 AI가 감쪽같이 지워주는 '매직 이레이저' 도구입니다.",
            features: [
                {
                    icon: Eraser,
                    title: "객체 지우기",
                    desc: "지우고 싶은 부분을 마우스로 칠하면, 주변 배경을 분석하여 자연스럽게 채워 넣습니다."
                }
            ],
            steps: [
                "메뉴에서 '리무버 편집'을 선택합니다.",
                "지울 대상 영역을 브러쉬로 칠합니다.",
                "AI 처리 버튼을 누르고 결과를 확인합니다."
            ]
        },
        live_studio: {
            image: "guide/dashboard.png",
            overview: "OBS 없이도 웹에서 바로 유튜브 라이브 스트리밍을 송출할 수 있는 방송국 모듈입니다.",
            features: [
                {
                    icon: Radio,
                    title: "멀티 스트림",
                    desc: "여러 채널에 동시에 라이브 방송을 송출할 수 있습니다."
                }
            ],
            steps: [
                "메뉴에서 '라이브 스튜디오'를 선택합니다.",
                "방송 제목과 스트림 키를 입력합니다.",
                "'방송 시작'을 누릅니다."
            ]
        },
        virtual_studio: {
            image: "guide/dashboard.png",
            overview: "크로마키 없이도 가상 배경을 합성하고, 3D 아바타를 활용하여 방송할 수 있는 버추얼 프로덕션 도구입니다.",
            features: [
                {
                    icon: Wand2,
                    title: "가상 배경 합성",
                    desc: "AI가 인물을 인식하여 배경을 뉴스룸, 스튜디오 등으로 실시간 교체합니다."
                }
            ],
            steps: [
                "메뉴에서 '버추얼 스튜디오'를 선택합니다.",
                "웹캠을 연결하고 원하는 배경 테마를 고릅니다."
            ]
        },

        // --- 4. AI Enhancement (AI 강화) ---
        insights: { // insights -> AI 콘텐츠 분석
            image: "guide/dashboard.png",
            titleOverride: "AI 콘텐츠 분석",
            overview: "영상의 시각적 요소, 음성 내용, 댓글 반응 등을 종합적으로 분석하여 '왜 이 영상이 떴는지' 이유를 도출해냅니다.",
            features: [
                {
                    icon: TrendingUp,
                    title: "심층 리포트",
                    desc: "영상 구조(Hook-Body-CTA), 감정선 변화, 주요 키워드 등을 분석한 리포트를 제공합니다."
                }
            ],
            steps: [
                "메뉴에서 'AI 콘텐츠 분석'을 클릭합니다.",
                "분석할 영상을 선택하고 AI 모델을 고릅니다.",
                "분석이 완료되면 인사이트 리포트를 정독합니다."
            ]
        },
        script_writer: { // script-writer -> 대본 번역/작성
            image: "guide/dashboard.png",
            titleOverride: "대본 번역 및 작성",
            overview: "해외 우수 영상의 스크립트를 한국 정서에 맞게 자연스럽게 번역하거나, 완전히 새로운 대본으로 재창작(Rewrite)합니다.",
            features: [
                {
                    icon: Edit,
                    title: "초월 번역",
                    desc: "단순 직역이 아닌, 문맥과 유행어를 반영한 자연스러운 의역을 제공합니다."
                }
            ],
            steps: [
                "메뉴에서 '대본 번역'을 선택합니다.",
                "원본 스크립트를 입력하거나 불러옵니다.",
                "타겟 언어와 톤앤매너(예: 유머러스하게)를 설정하고 실행합니다."
            ]
        },
        subtitle_tool: { // subtitle -> 자막 변환
            image: "guide/dashboard.png",
            titleOverride: "자막 변환 도구",
            overview: "음성을 인식하여 자막 파일(SRT, VTT)을 자동 생성하고, 다른 언어로 번역하여 다국어 자막을 만듭니다.",
            features: [
                {
                    icon: Languages,
                    title: "STT (Speech to Text)",
                    desc: "Whisper 등 최신 AI 모델을 사용하여 높은 정확도로 음성을 텍스트로 변환합니다."
                }
            ],
            steps: [
                "메뉴에서 '자막 변환'을 선택합니다.",
                "영상 또는 오디오 파일을 업로드합니다.",
                "변환된 자막을 에디터에서 수정하고 다운로드합니다."
            ]
        },
        multi_tts: { // tts -> 멀티 TTS
            image: "guide/dashboard.png",
            titleOverride: "멀티 TTS (음성 합성)",
            overview: "텍스트 대본을 입력하면 실제 사람 같은 AI 성우 내레이션으로 변환해줍니다. 여러 성우의 목소리를 섞어 대화형 오디오를 만들 수도 있습니다.",
            features: [
                {
                    icon: Mic,
                    title: "다양한 보이스",
                    desc: "뉴스 앵커, 예능 톤, 차분한 다큐멘터리 등 수백 가지 스타일의 보이스를 제공합니다."
                }
            ],
            steps: [
                "메뉴에서 '멀티 TTS'를 선택합니다.",
                "대본을 입력하고 문장별로 성우를 지정합니다.",
                "'오디오 생성'을 눌러 결과물을 들어봅니다."
            ]
        },
        silence_remover: { // silence -> 무음 제거
            image: "guide/dashboard.png",
            titleOverride: "무음 제거기",
            overview: "녹음 파일에서 말을 하지 않는 '침묵 구간'만 찾아내어 자동으로 잘라냅니다. 컷 편집 시간을 획기적으로 줄여줍니다.",
            features: [
                {
                    icon: Scissors,
                    title: "데시벨 기반 감지",
                    desc: "소리 크기가 설정값 이하인 구간을 정밀하게 탐지하여 제거합니다."
                }
            ],
            steps: [
                "메뉴에서 '무음 제거'를 선택합니다.",
                "파일을 올리고 감도(Sensitivity)를 설정합니다.",
                "단축된 결과를 확인하고 저장합니다."
            ]
        },
        remaster_lab: { // remaster -> 리마스터 랩
            image: "guide/dashboard.png",
            titleOverride: "리마스터 랩",
            overview: "저화질 영상을 4K로 업스케일링하거나, 노이즈를 제거하여 고품질 영상으로 복원합니다.",
            features: [
                {
                    icon: Wand2,
                    title: "AI 업스케일링",
                    desc: "720p 영상을 4K로 확대하면서도 디테일을 선명하게 살려냅니다."
                }
            ],
            steps: [
                "메뉴에서 '리마스터 랩'을 선택합니다.",
                "개선할 영상을 업로드합니다."
            ]
        },

        // --- 5. Automation Studio (자동화 스튜디오) ---
        workflows: {
            image: "guide/workflows.png",
            titleOverride: "워크플로우 빌더",
            overview: "반복되는 단순 작업을 자동화하는 공장입니다. '영상 다운로드 -> 자막 추출 -> 요약 -> 블로그 글 작성'과 같은 일련의 과정을 블록 쌓듯이 조립하여 자동화할 수 있습니다.",
            features: [
                {
                    icon: Workflow,
                    title: "노드 기반 에디터",
                    desc: "화면에 보이는 박스(노드)들을 선으로 연결하여 작업 흐름을 만듭니다. 코딩 없이 마우스 드래그만으로 복잡한 로직을 설계할 수 있습니다."
                },
                {
                    icon: Play,
                    title: "원클릭 실행",
                    desc: "만들어진 워크플로우는 '실행' 버튼 하나로 작동하며, 작업 대기열에서 진행 상황을 실시간으로 보여줍니다."
                }
            ],
            steps: [
                "메뉴에서 '워크플로우 빌더'로 이동합니다.",
                "우측 도구 상자에서 원하는 기능(예: YouTube 다운로드)을 캔버스로 드래그합니다.",
                "각 노드의 점들을 선으로 연결하고 저장 후 실행합니다."
            ]
        },
        work_queue: {
            image: "guide/workflows.png", // Reuse workflow image or queue screenshot if available
            overview: "백그라운드에서 돌아가는 자동화 작업들의 줄(Queue)을 관리합니다. 현재 어떤 작업이 진행 중인지, 실패한 작업은 무엇인지 확인합니다.",
            features: [
                {
                    icon: Activity,
                    title: "실시간 진행률",
                    desc: "각 작업의 진행 상황(%)과 소요 시간을 실시간으로 보여줍니다."
                }
            ],
            steps: [
                "메뉴에서 '작업 대기열'을 클릭합니다.",
                "상태(진행 중, 완료, 실패) 필터를 통해 작업을 확인합니다."
            ]
        },

        // --- 6. Distribution (배포) ---
        distribution: {
            image: "guide/channels.png",
            titleOverride: "배포 관리",
            overview: "완성된 콘텐츠를 여러 YouTube 채널에 예약 업로드하고, 관리하는 배포 센터입니다.",
            features: [
                {
                    icon: UploadCloud,
                    title: "다채널 예약",
                    desc: "한 번의 설정으로 A채널에는 6시, B채널에는 7시에 올라가도록 예약할 수 있습니다."
                }
            ],
            steps: [
                "메뉴에서 '배포 관리'를 선택합니다.",
                "업로드할 영상 파일과 메타데이터(제목, 설명)를 입력합니다.",
                "업로드할 채널들을 체크하고 '예약'을 누릅니다."
            ]
        },

        // --- 7. Account & Channel (계정 & 채널) ---
        account_manager: {
            image: "guide/channels.png",
            titleOverride: "계정 관리",
            overview: "구글 계정(Vault, Captain)을 안전하게 관리하고 로그인 세션을 유지하는 보안 센터입니다.",
            features: [
                {
                    icon: Shield,
                    title: "쿠키 및 세션 관리",
                    desc: "로그인 풀림 방지를 위해 브라우저 쿠키와 세션을 자동으로 갱신하고 관리합니다."
                }
            ],
            steps: [
                "메뉴에서 '계정 관리'를 선택합니다.",
                "보유한 구글 계정을 등록하거나 상태를 점검합니다."
            ]
        },
        incubator: {
            image: "guide/channels.png",
            overview: "신규 채널이나 계정을 '숙성'시키는 인큐베이터입니다. 갑작스러운 활동으로 인한 밴(Ban)을 막기 위해 7단계 웜업 프로세스를 자동으로 수행합니다.",
            features: [
                {
                    icon: Sparkles,
                    title: "7일 자동 웜업",
                    desc: "영상 시청, 좋아요, 댓글 달기 등 인간적인 활동을 시뮬레이션하여 계정 신뢰도를 높입니다."
                }
            ],
            steps: [
                "메뉴에서 '인큐베이터'를 선택합니다.",
                "웜업할 계정을 선택하고 '시작'을 누릅니다.",
                "매일 진행 단계를 모니터링합니다."
            ]
        },
        channel_manager: { // maps to channel-manager path
            image: "guide/channels.png",
            titleOverride: "채널 관리 (내 채널)",
            overview: "내가 운영 중인 모든 브랜드 채널의 성장을 한눈에 보고 관리하는 통합 경영실입니다.",
            features: [
                {
                    icon: ListVideo,
                    title: "채널 건강도 체크",
                    desc: "저작권 위반 경고 여부, 최근 실적 하락 등 채널의 건강 상태를 진단합니다."
                }
            ],
            steps: [
                "메뉴에서 '채널 관리'를 선택합니다.",
                "내 채널 목록에서 관리할 채널을 클릭하여 상세 설정으로 들어갑니다."
            ]
        }
    };

    const guideCategories = [
        {
            id: 'analytics',
            title: '분석 & 인사이트',
            icon: BarChart3,
            guides: [
                { id: 'dashboard', title: '통합 대시보드', difficulty: '초급', time: '5분', key: 'dashboard' },
                { id: 'captain', title: '캡틴 대시보드', difficulty: '중급', time: '10분', key: 'captain' },
                { id: 'keyword', title: '키워드 탐색기', difficulty: '초급', time: '5분', key: 'keyword' },
                { id: 'reports', title: '일일 리포트', difficulty: '초급', time: '3분', key: 'reports' }
            ]
        },
        {
            id: 'sourcing',
            title: '콘텐츠 소싱',
            icon: Download,
            guides: [
                { id: 'channels_ref', title: '레퍼런스 채널', difficulty: '초급', time: '3분', key: 'channels_ref' },
                { id: 'download', title: '영상 다운로드', difficulty: '초급', time: '5분', key: 'download' },
                { id: 'gallery', title: '갤러리', difficulty: '초급', time: '5분', key: 'gallery' },
                { id: 'script_lab', title: '자막 수집', difficulty: '초급', time: '5분', key: 'script_lab' }
            ]
        },
        {
            id: 'creation',
            title: '콘텐츠 제작',
            icon: Clapperboard,
            guides: [
                { id: 'studio', title: '스튜디오', difficulty: '중급', time: '20분', key: 'studio' },
                { id: 'cut_editor', title: '컷 편집', difficulty: '초급', time: '10분', key: 'cut_editor' },
                { id: 'remover', title: '리무버 편집', difficulty: '중급', time: '15분', key: 'remover' },
                { id: 'live_studio', title: '라이브 스튜디오', difficulty: '고급', time: '30분', key: 'live_studio' },
                { id: 'virtual_studio', title: '버추얼 스튜디오', difficulty: '고급', time: '25분', key: 'virtual_studio' }
            ]
        },
        {
            id: 'ai',
            title: 'AI 강화',
            icon: Sparkles,
            guides: [
                { id: 'insights', title: 'AI 콘텐츠 분석', difficulty: '중급', time: '15분', key: 'insights' },
                { id: 'script_writer', title: '대본 번역', difficulty: '초급', time: '5분', key: 'script_writer' },
                { id: 'subtitle_tool', title: '자막 변환', difficulty: '초급', time: '10분', key: 'subtitle_tool' },
                { id: 'multi_tts', title: '멀티 TTS', difficulty: '중급', time: '15분', key: 'multi_tts' },
                { id: 'silence_remover', title: '무음 제거', difficulty: '초급', time: '5분', key: 'silence_remover' },
                { id: 'remaster_lab', title: '리마스터 랩', difficulty: '중급', time: '20분', key: 'remaster_lab' }
            ]
        },
        {
            id: 'automation',
            title: '자동화 스튜디오',
            icon: Workflow,
            guides: [
                { id: 'workflows', title: '워크플로우 빌더', difficulty: '고급', time: '30분', key: 'workflows' },
                { id: 'work_queue', title: '작업 대기열', difficulty: '중급', time: '10분', key: 'work_queue' }
            ]
        },
        {
            id: 'distribution',
            title: '배포',
            icon: UploadCloud,
            guides: [
                { id: 'distribution', title: '배포 관리', difficulty: '중급', time: '15분', key: 'distribution' }
            ]
        },
        {
            id: 'account',
            title: '계정 & 채널',
            icon: Shield,
            guides: [
                { id: 'account_manager', title: '계정 관리', difficulty: '중급', time: '15분', key: 'account_manager' }, // Fixed ID match
                { id: 'incubator', title: '인큐베이터', difficulty: '고급', time: '20분', key: 'incubator' },
                { id: 'channel_manager', title: '채널 관리', difficulty: '중급', time: '10분', key: 'channel_manager' } // Fixed ID match
            ]
        }
    ];

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Functional Content Only */}

            {/* Content Layout */}
            <div className="grid lg:grid-cols-4 gap-8">

                {/* Left: Navigation Menu (Sticky) */}
                <div className="lg:col-span-1">
                    <div className="sticky top-8 space-y-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground" />
                            <Input
                                placeholder="궁금한 기능을 검색..."
                                className="pl-10 h-12 text-lg shadow-sm bg-background"
                            />
                        </div>

                        <ScrollArea className="h-[calc(100vh-200px)] pr-4">
                            <Accordion type="single" collapsible className="space-y-4" defaultValue="analytics">
                                {guideCategories.map((cat) => (
                                    <AccordionItem key={cat.id} value={cat.id} className="border rounded-xl px-4 bg-card shadow-sm hover:shadow-md transition-shadow">
                                        <AccordionTrigger className="hover:no-underline py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary/10 rounded-lg">
                                                    <cat.icon className="w-4 h-4 text-primary" />
                                                </div>
                                                <span className="font-bold text-base text-card-foreground">{cat.title}</span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div className="space-y-1 pt-1 pb-3">
                                                {cat.guides.map((guide) => (
                                                    <a
                                                        key={guide.id}
                                                        href={`#${guide.key}`}
                                                        className="block p-2.5 rounded-lg hover:bg-accent/50 border border-transparent hover:border-accent transition-all group"
                                                    >
                                                        <div className="flex justify-between items-center mb-0.5">
                                                            <span className="font-medium text-sm text-muted-foreground group-hover:text-primary transition-colors">
                                                                {guide.title}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-2 opacity-70">
                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                ⏱ {guide.time}
                                                            </span>
                                                        </div>
                                                    </a>
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </ScrollArea>
                    </div>
                </div>

                {/* Right: Detailed Content Area */}
                <div className="lg:col-span-3 space-y-16 pb-20">
                    {/* Render each documented section */}
                    {Object.entries(detailedGuides).map(([key, content]) => (
                        <div key={key} id={key} className="scroll-mt-24 group">
                            {/* Card Container */}
                            <Card className="overflow-hidden border-border/50 shadow-lg ring-1 ring-border/50">
                                {/* Hero Image Section (Conditional) */}
                                {content.image && (
                                    <div className="aspect-[21/9] w-full bg-muted relative overflow-hidden border-b border-border/50">
                                        <img
                                            src={content.image}
                                            alt={content.titleOverride || key}
                                            className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.02]"
                                            onError={(e) => {
                                                // Fallback if image fails
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent flex items-end p-6 md:p-8">
                                            <div className="text-foreground">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge className="bg-primary hover:bg-primary/90 border-0 text-primary-foreground">가이드</Badge>
                                                    <span className="text-sm font-medium text-primary-foreground/80 drop-shadow-sm">Step-by-Step</span>
                                                </div>
                                                <h2 className="text-2xl md:text-3xl font-bold shadow-sm drop-shadow-md">
                                                    {content.titleOverride ||
                                                        // Match title from categories if no override
                                                        guideCategories.flatMap(c => c.guides).find(g => g.key === key)?.title ||
                                                        key}
                                                </h2>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <CardContent className="p-6 md:p-8 space-y-8 bg-card">
                                    {/* Overview */}
                                    <div>
                                        <h3 className="text-lg font-bold flex items-center gap-2 mb-3 text-card-foreground">
                                            <Info className="w-5 h-5 text-blue-500" />
                                            개요 (Overview)
                                        </h3>
                                        <p className="text-base md:text-lg leading-relaxed text-muted-foreground bg-accent/30 p-4 rounded-xl border border-border/50">
                                            {content.overview}
                                        </p>
                                    </div>

                                    {/* Features Grid */}
                                    <div>
                                        <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-card-foreground">
                                            <Sparkles className="w-5 h-5 text-purple-500" />
                                            주요 기능 (Key Features)
                                        </h3>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            {content.features.map((feat, idx) => (
                                                <div key={idx} className="p-4 rounded-xl border border-border bg-background hover:border-primary/50 transition-colors">
                                                    <div className="flex items-start gap-4">
                                                        <div className="p-2.5 bg-primary/10 rounded-lg shrink-0">
                                                            <feat.icon className="w-5 h-5 text-primary" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-card-foreground mb-1">{feat.title}</h4>
                                                            <p className="text-sm text-muted-foreground leading-snug">{feat.desc}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Step-by-Step Guide */}
                                    <div>
                                        <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-card-foreground">
                                            <MousePointerClick className="w-5 h-5 text-green-600" />
                                            따라하기 (Step-by-Step)
                                        </h3>
                                        <div className="relative pl-4 space-y-6 border-l-2 border-border ml-2">
                                            {content.steps.map((step, idx) => (
                                                <div key={idx} className="relative pl-6">
                                                    <div className="absolute -left-[33px] top-0 w-8 h-8 rounded-full bg-background border-2 border-border flex items-center justify-center text-sm font-bold text-muted-foreground shadow-sm">
                                                        {idx + 1}
                                                    </div>
                                                    <p className="text-base text-foreground/90 font-medium pt-1">
                                                        {step}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ))}

                    {/* Placeholder for future sections */}
                    <div className="text-center py-12 bg-accent/30 rounded-2xl border border-dashed border-border/50">
                        <Clapperboard className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-muted-foreground">더 많은 가이드가 준비 중입니다</h3>
                        <p className="text-sm text-muted-foreground/70">지속적으로 업데이트됩니다.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
