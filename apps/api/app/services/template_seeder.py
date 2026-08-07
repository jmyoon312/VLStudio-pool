from sqlalchemy.orm import Session
from .. import models
import json

def seed_templates(db: Session):
    """
    Seeds the database with 30+ Advanced Master Scenarios for ViraLoop.
    Mimics n8n/Make style detailed workflows.
    Forces refresh (deletes existing) to ensure clean slate.
    """
    # Force Clear to Apply Updates
    db.query(models.WorkflowTemplate).delete()
    db.commit()

    templates = [
        # ==================================================================================
        # [뉴스/정보] (News & Info) - 5 Templates
        # ==================================================================================
        {
            "category": "뉴스",
            "title": "📰 매일 아침 뉴스 브리핑 (AI 앵커)",
            "description": "주요 뉴스 헤드라인을 수집하여 AI 앵커가 진행하는 데일리 뉴스 영상 자동 생성.",
            "icon": "Newspaper",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "webScraperNode", "position": {"x": 0, "y": 0}, "data": {"label": "네이버 뉴스 헤드라인", "url": "https://news.naver.com", "selector": ".news_tit"}},
                    {"id": "2", "type": "aiAgentNode", "position": {"x": 400, "y": 0}, "data": {"label": "뉴스 대본 작성", "role": "Journalist", "prompt": "다음 뉴스들을 1분 브리핑 대본으로 요약해줘: {input}"}},
                    {"id": "3", "type": "videoGenNode", "position": {"x": 800, "y": 0}, "data": {"label": "AI 앵커 생성 (Avatar)", "style_preset": "news_anchor_female"}},
                    {"id": "4", "type": "ttsNode", "position": {"x": 800, "y": 200}, "data": {"label": "아나운서 보이스", "engine": "elevenlabs", "voice_id": "news_anchor"}},
                    {"id": "5", "type": "syncVideoNode", "position": {"x": 1200, "y": 100}, "data": {"label": "립싱크 및 합성"}},
                    {"id": "6", "type": "channelNode", "position": {"x": 1600, "y": 100}, "data": {"label": "유튜브 업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e2-4", "source": "2", "target": "4"},
                    {"id": "e3-5", "source": "3", "target": "5"},
                    {"id": "e4-5", "source": "4", "target": "5"},
                    {"id": "e5-6", "source": "5", "target": "6"}
                ]
            }
        },
        {
            "category": "뉴스",
            "title": "🌤️ 내일의 날씨 예보",
            "description": "기상청 데이터를 기반으로 내일의 날씨와 옷차림 추천 정보를 담은 인포그래픽 영상.",
            "icon": "CloudSun",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "webScraperNode", "position": {"x": 0, "y": 0}, "data": {"label": "기상청 API 연동", "url": "https://api.weather.go.kr..."}},
                    {"id": "2", "type": "aiAgentNode", "position": {"x": 400, "y": 0}, "data": {"label": "옷차림 추천 코멘트", "prompt": "내일 기온 {temp}도에 맞는 옷차림과 주의사항을 알려줘."}},
                    {"id": "3", "type": "cropTemplateNode", "position": {"x": 800, "y": 0}, "data": {"label": "날씨 위젯 오버레이", "template": "weather_widget_modern"}},
                    {"id": "4", "type": "ttsNode", "position": {"x": 800, "y": 200}, "data": {"label": "기상 캐스터 보이스"}},
                    {"id": "5", "type": "channelNode", "position": {"x": 1200, "y": 100}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e1-3", "source": "1", "target": "3"},
                    {"id": "e2-4", "source": "2", "target": "4"},
                    {"id": "e3-5", "source": "3", "target": "5"},
                    {"id": "e4-5", "source": "4", "target": "5"}
                ]
            }
        },
        {
            "category": "뉴스",
            "title": "[TREND] 실시간 증시/코인 리포트",
            "description": "실시간 주가 지수와 주요 종목 등락률을 시각화한 금융 리포트.",
            "icon": "TrendingUp",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "webScraperNode", "position": {"x": 0, "y": 0}, "data": {"label": "증시 데이터 수집", "preset": "finance_api"}},
                    {"id": "2", "type": "videoGenNode", "position": {"x": 400, "y": 0}, "data": {"label": "동적 차트 생성 (Race Bar)", "style_preset": "chart_animation"}},
                    {"id": "3", "type": "textOverlayNode", "position": {"x": 800, "y": 0}, "data": {"label": "주요 지수 자막 (KOSPI/NASDAQ)"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 1200, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },
        {
            "category": "뉴스",
            "title": "📅 이번 주말 행사/축제 정보",
            "description": "지역별 주말 축제 및 행사 정보를 지도와 함께 소개.",
            "icon": "Calendar",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "webScraperNode", "position": {"x": 0, "y": 0}, "data": {"label": "행사 정보 검색", "keyword": "주말 축제"}},
                    {"id": "2", "type": "stockAssetNode", "position": {"x": 400, "y": 0}, "data": {"label": "관련 자료화면 검색", "media_type": "image"}},
                    {"id": "3", "type": "cropTemplateNode", "position": {"x": 800, "y": 0}, "data": {"label": "카드뉴스 스타일 템플릿"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 1200, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-3", "source": "1", "target": "3"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },
        {
            "category": "뉴스",
            "title": "[FALLBACK] 테크 트렌드 위클리",
            "description": "한 주간의 IT/Tech 주요 소식을 요약하여 전달.",
            "icon": "Cpu",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "webScraperNode", "position": {"x": 0, "y": 0}, "data": {"label": "TechCrunch/TheVerge 수집"}},
                    {"id": "2", "type": "aiAgentNode", "position": {"x": 400, "y": 0}, "data": {"label": "요약 및 번역", "role": "Tech Editor"}},
                    {"id": "3", "type": "stockAssetNode", "position": {"x": 400, "y": 200}, "data": {"label": "기기/로고 이미지 검색"}},
                    {"id": "4", "type": "productionNode", "position": {"x": 800, "y": 100}, "data": {"label": "영상 편집/합성"}},
                    {"id": "5", "type": "channelNode", "position": {"x": 1200, "y": 100}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-4", "source": "2", "target": "4"},
                    {"id": "e3-4", "source": "3", "target": "4"},
                    {"id": "e4-5", "source": "4", "target": "5"}
                ]
            }
        },

        # ==================================================================================
        # [시니어/건강] (Senior & Health) - 4 Templates
        # ==================================================================================
        {
            "category": "시니어",
            "title": "💊 1분 건강 상식 (큰 글씨)",
            "description": "어르신들을 위한 큰 자막과 느린 템포의 건강 정보 영상.",
            "icon": "HeartPulse",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "aiAgentNode", "position": {"x": 0, "y": 0}, "data": {"label": "건강 팁 생성", "prompt": "고혈압에 좋은 음식 3가지..."}},
                    {"id": "2", "type": "stockAssetNode", "position": {"x": 400, "y": 0}, "data": {"label": "건강 관련 영상 소스"}},
                    {"id": "3", "type": "studioSubtitleNode", "position": {"x": 800, "y": 0}, "data": {"label": "초대형 자막 (가독성)", "font_size": 80, "color": "#FFFFFF", "bg_color": "#000000"}},
                    {"id": "4", "type": "ttsNode", "position": {"x": 800, "y": 200}, "data": {"label": "차분하고 또렷한 목소리", "speed": 0.9}},
                    {"id": "5", "type": "channelNode", "position": {"x": 1200, "y": 100}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-3", "source": "1", "target": "3"},
                    {"id": "e1-4", "source": "1", "target": "4"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-5", "source": "3", "target": "5"},
                    {"id": "e4-5", "source": "4", "target": "5"}
                ]
            }
        },
        {
            "category": "시니어",
            "title": "🎵 추억의 트로트 메들리",
            "description": "인기 트로트 음악과 화려한 배경 영상을 결합한 메들리 영상.",
            "icon": "Music",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "assetLoaderNode", "position": {"x": 0, "y": 0}, "data": {"label": "트로트 MP3 파일들"}},
                    {"id": "2", "type": "stockAssetNode", "position": {"x": 0, "y": 200}, "data": {"label": "자연/꽃 배경 영상 Loop"}},
                    {"id": "3", "type": "audioMixNode", "position": {"x": 400, "y": 0}, "data": {"label": "크로스페이드 믹싱"}},
                    {"id": "4", "type": "textAnimNode", "position": {"x": 800, "y": 100}, "data": {"label": "현재 재생곡 제목 표시"}},
                    {"id": "5", "type": "channelNode", "position": {"x": 1200, "y": 100}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-3", "source": "1", "target": "3"},
                    {"id": "e2-4", "source": "2", "target": "4"},
                    {"id": "e3-4", "source": "3", "target": "4"},
                    {"id": "e4-5", "source": "4", "target": "5"}
                ]
            }
        },
        {
            "category": "시니어",
            "title": "📱 스마트폰 기초 강좌",
            "description": "화면 녹화 영상에 손가락 터치 포인터와 설명을 추가한 IT 강좌.",
            "icon": "Smartphone",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "assetLoaderNode", "position": {"x": 0, "y": 0}, "data": {"label": "스마트폰 화면 녹화 파일"}},
                    {"id": "2", "type": "videoTransformNode", "position": {"x": 400, "y": 0}, "data": {"label": "터치 포인터 강조 효과"}},
                    {"id": "3", "type": "ttsNode", "position": {"x": 400, "y": 200}, "data": {"label": "친절한 설명 내레이션"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 800, "y": 100}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-4", "source": "2", "target": "4"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },
        {
            "category": "시니어",
            "title": "🙏 아침 기도/명상",
            "description": "평온한 배경음악과 함께 기도문이나 명언을 읽어주는 영상.",
            "icon": "Sun",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "aiAgentNode", "position": {"x": 0, "y": 0}, "data": {"label": "기도문/명언 생성"}},
                    {"id": "2", "type": "stockAssetNode", "position": {"x": 400, "y": 0}, "data": {"label": "일출/자연 영상"}},
                    {"id": "3", "type": "audioMixNode", "position": {"x": 800, "y": 0}, "data": {"label": "잔잔한 배경음악 (CCM/명상)"}},
                    {"id": "4", "type": "ttsNode", "position": {"x": 800, "y": 200}, "data": {"label": "낭독 보이스"}},
                    {"id": "5", "type": "channelNode", "position": {"x": 1200, "y": 100}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-4", "source": "1", "target": "4"},
                    {"id": "e2-5", "source": "2", "target": "5"},
                    {"id": "e3-5", "source": "3", "target": "5"},
                    {"id": "e4-5", "source": "4", "target": "5"}
                ]
            }
        },

        # ==================================================================================
        # [리뷰/커머스] (Review & Commerce) - 4 Templates
        # ==================================================================================
        {
            "category": "리뷰",
            "title": "[BOX] 언박싱 & 제품 리뷰 (IT/가전)",
            "description": "웹에서 제품 스펙을 긁어와 AI가 장단점을 분석하고 비교하는 영상.",
            "icon": "PackageOpen",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "webScraperNode", "position": {"x": 0, "y": 0}, "data": {"label": "제품 상세페이지 수집"}},
                    {"id": "2", "type": "aiAgentNode", "position": {"x": 400, "y": 0}, "data": {"label": "장단점 요약 분석", "prompt": "이 제품의 장점 3가지, 단점 1가지를 요약해줘."}},
                    {"id": "3", "type": "cropTemplateNode", "position": {"x": 800, "y": 0}, "data": {"label": "스펙 비교 레이아웃"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 1200, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },
        {
            "category": "리뷰",
            "title": "🏠 부동산 매물 브리핑 (임장)",
            "description": "네이버/직방 매물 정보를 바탕으로 지도와 내부 사진을 엮은 부동산 영상.",
            "icon": "Home",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "webScraperNode", "position": {"x": 0, "y": 0}, "data": {"label": "매물 정보 수집", "url": "https://land.naver.com..."}},
                    {"id": "2", "type": "stockAssetNode", "position": {"x": 400, "y": 150}, "data": {"label": "지도/위치 이미지 검색"}},
                    {"id": "3", "type": "textOverlayNode", "position": {"x": 800, "y": 0}, "data": {"label": "가격/평수 필수 정보 자막"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 1200, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-3", "source": "1", "target": "3"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },
        {
            "category": "리뷰",
            "title": "👗 패션 룩북 (Lookbook)",
            "description": "쇼핑몰 이미지들을 슬라이드 쇼 형태로 전환하며 코디 제안.",
            "icon": "Shirt",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "webScraperNode", "position": {"x": 0, "y": 0}, "data": {"label": "쇼핑몰 이미지 수집"}},
                    {"id": "2", "type": "videoGenNode", "position": {"x": 400, "y": 0}, "data": {"label": "슬라이드 쇼 생성", "effect": "zoom_in"}},
                    {"id": "3", "type": "audioMixNode", "position": {"x": 800, "y": 0}, "data": {"label": "트렌디한 BGM"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 1200, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },
        {
            "category": "리뷰",
            "title": "[FIRE] 핫딜 정보 알리미",
            "description": "뽐뿌/클리앙 등 커뮤니티 핫딜 정보를 빠르게 영상화.",
            "icon": "Tag",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "webScraperNode", "position": {"x": 0, "y": 0}, "data": {"label": "커뮤니티 핫딜 게시판 수집"}},
                    {"id": "2", "type": "textAnimNode", "position": {"x": 400, "y": 0}, "data": {"label": "할인율/가격 강조 효과"}},
                    {"id": "3", "type": "channelNode", "position": {"x": 800, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"}
                ]
            }
        },

        # ==================================================================================
        # [스토리/예능] (Story & Fun) - 5 Templates
        # ==================================================================================
        {
            "category": "스토리",
            "title": "🗣️ 네이트판/레딧 썰방",
            "description": "인기 커뮤니티 썰을 성우 목소리로 읽어주는 라디오 스타일 영상.",
            "icon": "MessageCircle",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "webScraperNode", "position": {"x": 0, "y": 0}, "data": {"label": "커뮤니티 베스트 글 수집"}},
                    {"id": "2", "type": "aiAgentNode", "position": {"x": 400, "y": 0}, "data": {"label": "구어체 대본 각색"}},
                    {"id": "3", "type": "ttsNode", "position": {"x": 800, "y": 0}, "data": {"label": "리얼한 성우 목소리"}},
                    {"id": "4", "type": "stockAssetNode", "position": {"x": 800, "y": 200}, "data": {"label": "마인크래프트/게임 플레이 영상"}},
                    {"id": "5", "type": "channelNode", "position": {"x": 1200, "y": 100}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-5", "source": "3", "target": "5"},
                    {"id": "e4-5", "source": "4", "target": "5"}
                ]
            }
        },
        {
            "category": "스토리",
            "title": "👻 AI 미스터리/괴담",
            "description": "AI가 생성한 공포 이야기를 으스스한 효과음과 함께 제작.",
            "icon": "Ghost",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "aiAgentNode", "position": {"x": 0, "y": 0}, "data": {"label": "창작 괴담 생성", "prompt": "무서운 학교 괴담 이야기..."}},
                    {"id": "2", "type": "stockAssetNode", "position": {"x": 400, "y": 0}, "data": {"label": "공포 분위기 영상 소스", "keyword": "horror dark"}},
                    {"id": "3", "type": "audioMixNode", "position": {"x": 800, "y": 0}, "data": {"label": "공포 효과음/BGM"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 1200, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },
        {
            "category": "예능",
            "title": "⚖️ 밸런스 게임 (VS)",
            "description": "짜장 vs 짬뽕 등 선택 장애를 유발하는 밸런스 게임 숏폼.",
            "icon": "Scale",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "aiAgentNode", "position": {"x": 0, "y": 0}, "data": {"label": "밸런스 주제 생성"}},
                    {"id": "2", "type": "cropTemplateNode", "position": {"x": 400, "y": 0}, "data": {"label": "좌우 분할 레이아웃 (VS)", "template": "split_vs"}},
                    {"id": "3", "type": "textAnimNode", "position": {"x": 800, "y": 0}, "data": {"label": "타이머 애니메이션"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 1200, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },
        {
            "category": "예능",
            "title": "🔮 오늘의 운세 (타로)",
            "description": "랜덤으로 타로 카드를 뽑고 오늘의 운세를 알려주는 영상.",
            "icon": "Sparkles",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "stockAssetNode", "position": {"x": 0, "y": 0}, "data": {"label": "타로 카드 이미지 랜덤 선택"}},
                    {"id": "2", "type": "aiAgentNode", "position": {"x": 400, "y": 0}, "data": {"label": "카드 해석 생성 (운세)"}},
                    {"id": "3", "type": "ttsNode", "position": {"x": 800, "y": 0}, "data": {"label": "신비로운 목소리"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 1200, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },
        {
            "category": "예능",
            "title": "🧩 퀴즈/수수께끼 쇼츠",
            "description": "질문 -> 카운트다운 -> 정답 공개 패턴의 퀴즈 영상.",
            "icon": "Puzzle",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "aiAgentNode", "position": {"x": 0, "y": 0}, "data": {"label": "퀴즈 문제 생성"}},
                    {"id": "2", "type": "textOverlayNode", "position": {"x": 400, "y": 0}, "data": {"label": "질문 텍스트 (Q)"}},
                    {"id": "3", "type": "manualTaskNode", "position": {"x": 800, "y": 0}, "data": {"label": "5초 대기 (Wait)"}},
                    {"id": "4", "type": "textOverlayNode", "position": {"x": 1200, "y": 0}, "data": {"label": "정답 공개 (A)"}},
                    {"id": "5", "type": "channelNode", "position": {"x": 1600, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"},
                    {"id": "e4-5", "source": "4", "target": "5"}
                ]
            }
        },

        # ==================================================================================
        # [유틸/교육] (Utility & Edu) - 5 Templates
        # ==================================================================================
        {
            "category": "유틸",
            "title": "🍳 1분 요리 레시피",
            "description": "블로그의 긴 레시피 텍스트를 짧은 요리 영상으로 변환.",
            "icon": "Utensils",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "webScraperNode", "position": {"x": 0, "y": 0}, "data": {"label": "레시피 블로그 텍스트 추출"}},
                    {"id": "2", "type": "stockAssetNode", "position": {"x": 400, "y": 0}, "data": {"label": "요리 재료/과정 영상 검색"}},
                    {"id": "3", "type": "textOverlayNode", "position": {"x": 800, "y": 0}, "data": {"label": "순서별 자막 (Step by Step)"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 1200, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },
        {
            "category": "유틸",
            "title": "🗣️ 외국어 쉐도잉 (미드)",
            "description": "영어 문장을 3번 반복하고 한글 뜻을 보여주는 학습 영상.",
            "icon": "Languages",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "aiAgentNode", "position": {"x": 0, "y": 0}, "data": {"label": "실생활 영어 표현 5개 생성"}},
                    {"id": "2", "type": "ttsNode", "position": {"x": 400, "y": 0}, "data": {"label": "원어민 발음 생성"}},
                    {"id": "3", "type": "videoTransformNode", "position": {"x": 800, "y": 0}, "data": {"label": "3회 반복 재생 루프"}},
                    {"id": "4", "type": "subtitleNode", "position": {"x": 1200, "y": 0}, "data": {"label": "한/영 통합 자막"}},
                    {"id": "5", "type": "channelNode", "position": {"x": 1600, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"},
                    {"id": "e4-5", "source": "4", "target": "5"}
                ]
            }
        },
        {
            "category": "유틸",
            "title": "[INFO] 생활 꿀팁 모음 (Life Hacks)",
            "description": "청소, 정리, 수납 등 유용한 생활 팁을 빠르게 보여주는 정보성 영상.",
            "icon": "Lightbulb",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "webScraperNode", "position": {"x": 0, "y": 0}, "data": {"label": "꿀팁 정보 검색"}},
                    {"id": "2", "type": "stockAssetNode", "position": {"x": 400, "y": 0}, "data": {"label": "시연 영상 클립 검색"}},
                    {"id": "3", "type": "textAnimNode", "position": {"x": 800, "y": 0}, "data": {"label": "핵심 키워드 강조"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 1200, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },
        {
            "category": "유틸",
            "title": "✂️ 팟캐스트/긴 영상 하이라이트 (Shorts)",
            "description": "1시간짜리 영상에서 인물이 말하는 구간을 찾아 1분 쇼츠로 자동 편집.",
            "icon": "Scissors",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "assetLoaderNode", "position": {"x": 0, "y": 0}, "data": {"label": "긴 영상 파일 로드"}},
                    {"id": "2", "type": "smartCropNode", "position": {"x": 400, "y": 0}, "data": {"label": "화자 얼굴 트래킹 (Face Tracking)"}},
                    {"id": "3", "type": "smartCutNode", "position": {"x": 800, "y": 0}, "data": {"label": "사일런스 컷 (무음 제거)"}},
                    {"id": "4", "type": "subtitleNode", "position": {"x": 1200, "y": 0}, "data": {"label": "자동 자막 생성 (STT)"}},
                    {"id": "5", "type": "channelNode", "position": {"x": 1600, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"},
                    {"id": "e4-5", "source": "4", "target": "5"}
                ]
            }
        },
        {
            "category": "유틸",
            "title": "📚 오디오북 제작",
            "description": "텍스트 소설을 AI 성우가 읽어주는 오디오북 영상 제작.",
            "icon": "BookOpen",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "assetLoaderNode", "position": {"x": 0, "y": 0}, "data": {"label": "소설 텍스트 파일 (.txt)"}},
                    {"id": "2", "type": "ttsNode", "position": {"x": 400, "y": 0}, "data": {"label": "장편 낭독용 보이스"}},
                    {"id": "3", "type": "stockAssetNode", "position": {"x": 400, "y": 200}, "data": {"label": "감성적인 배경 이미지 (정지화면)"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 800, "y": 100}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-4", "source": "2", "target": "4"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },

        # ==================================================================================
        # [힐링/감성] (Healing) - 4 Templates
        # ==================================================================================
        {
            "category": "힐링",
            "title": "🌿 명언 & 동기부여",
            "description": "아름다운 자연 영상 배경에 인생 명언이 천천히 나타나는 감성 영상.",
            "icon": "Quote",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "aiAgentNode", "position": {"x": 0, "y": 0}, "data": {"label": "명언 수집/생성"}},
                    {"id": "2", "type": "stockAssetNode", "position": {"x": 400, "y": 0}, "data": {"label": "시네마틱 자연 영상", "keyword": "nature landscape"}},
                    {"id": "3", "type": "textAnimNode", "position": {"x": 800, "y": 0}, "data": {"label": "서서히 밝아지는 텍스트 (Fade In)"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 1200, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-3", "source": "1", "target": "3"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },
        {
            "category": "힐링",
            "title": "[AUDIO] ASMR / 백색소음",
            "description": "빗소리, 모닥불 소리 등을 고음질로 믹싱한 1시간 수면 유도 영상.",
            "icon": "Headphones",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "stockAssetNode", "position": {"x": 0, "y": 0}, "data": {"label": "비 내리는 창가 영상 Loop"}},
                    {"id": "2", "type": "audioMixNode", "position": {"x": 400, "y": 0}, "data": {"label": "빗소리 + 피아노 믹싱"}},
                    {"id": "3", "type": "videoTransformNode", "position": {"x": 800, "y": 0}, "data": {"label": "영상 길이 연장 (Loop 1시간)"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 1200, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },
        {
            "category": "힐링",
            "title": "🎨 AI 아트 갤러리 (Deforum)",
            "description": "음악 비트에 맞춰 변화하는 몽환적인 AI 생성 예술 영상.",
            "icon": "Palette",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "aiAgentNode", "position": {"x": 0, "y": 0}, "data": {"label": "예술적 프롬프트 생성"}},
                    {"id": "2", "type": "videoGenNode", "position": {"x": 400, "y": 0}, "data": {"label": "Deforum 영상 생성 (Beat Sync)"}},
                    {"id": "3", "type": "assetLoaderNode", "position": {"x": 400, "y": 200}, "data": {"label": "비트가 강한 배경음악"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 800, "y": 100}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e3-2", "source": "3", "target": "2"},
                    {"id": "e2-4", "source": "2", "target": "4"}
                ]
            }
        },
        {
            "category": "힐링",
            "title": "✈️ 여행 브이로그 (몽타주)",
            "description": "여행 사진과 짧은 영상들을 감성적인 Lo-Fi 음악과 편집.",
            "icon": "Plane",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "assetLoaderNode", "position": {"x": 0, "y": 0}, "data": {"label": "여행 사진/영상 폴더 로드"}},
                    {"id": "2", "type": "videoGenNode", "position": {"x": 400, "y": 0}, "data": {"label": "필름 룩 필터 적용 (Vintage)"}},
                    {"id": "3", "type": "audioMixNode", "position": {"x": 800, "y": 0}, "data": {"label": "Lo-Fi 배경음악"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 1200, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },

        # ==================================================================================
        # [뮤직/엔터] (Music & Ent) - 3 Templates
        # ==================================================================================
        {
            "category": "음악",
            "title": "🎤 노래 가사 비디오 (Lyric Video)",
            "description": "키네틱 타이포그래피 기술로 가사가 음악에 맞춰 춤추는 영상.",
            "icon": "Music",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "assetLoaderNode", "position": {"x": 0, "y": 0}, "data": {"label": "MP3 음원 파일"}},
                    {"id": "2", "type": "assetLoaderNode", "position": {"x": 0, "y": 200}, "data": {"label": "가사 텍스트 파일 (.lrc)"}},
                    {"id": "3", "type": "textAnimNode", "position": {"x": 400, "y": 100}, "data": {"label": "키네틱 타이포그래피 생성", "effect": "kinetic_typography"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 800, "y": 100}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-3", "source": "1", "target": "3"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },
        {
            "category": "음악",
            "title": "🎹 피아노 커버 시각화 (MIDI)",
            "description": "MIDI 파일을 입력받아 건반이 눌리는 시각 효과 영상 생성.",
            "icon": "Music4",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "assetLoaderNode", "position": {"x": 0, "y": 0}, "data": {"label": "MIDI 파일 로드"}},
                    {"id": "2", "type": "videoGenNode", "position": {"x": 400, "y": 0}, "data": {"label": "건반 시각화 (Synthesia Style)", "style_preset": "piano_roll"}},
                    {"id": "3", "type": "channelNode", "position": {"x": 800, "y": 0}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3", "source": "2", "target": "3"}
                ]
            }
        },
        {
            "category": "음악",
            "title": "[AUDIO] Lo-Fi 공부용 플레이리스트",
            "description": "움직이는 일러스트 배경에 저작권 없는 Lo-Fi 음악을 연속 재생.",
            "icon": "Coffee",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "stockAssetNode", "position": {"x": 0, "y": 0}, "data": {"label": "감성 일러스트 (GIF/Video) Loop"}},
                    {"id": "2", "type": "assetLoaderNode", "position": {"x": 0, "y": 200}, "data": {"label": "Lo-Fi 음악 폴더"}},
                    {"id": "3", "type": "audioMixNode", "position": {"x": 400, "y": 100}, "data": {"label": "무한 재생 믹싱"}},
                    {"id": "4", "type": "channelNode", "position": {"x": 800, "y": 100}, "data": {"label": "업로드"}}
                ],
                "edges": [
                    {"id": "e1-3", "source": "1", "target": "3"},
                    {"id": "e2-3", "source": "2", "target": "3"},
                    {"id": "e3-4", "source": "3", "target": "4"}
                ]
            }
        },

        # ==================================================================================
        # [글로벌/확장] (Global) - 1 Advanced Template
        # ==================================================================================
        {
            "category": "글로벌",
            "title": "🌏 글로벌 OSMU (One Source Multi Use)",
            "description": "한국어 영상을 KR, EN, JP, ES 4개 국어 채널로 동시 배포.",
            "icon": "Globe",
            "graph_json": {
                "nodes": [
                    {"id": "1", "type": "assetLoaderNode", "position": {"x": 0, "y": 300}, "data": {"label": "메인 영상 (Main)"}},
                    {"id": "2", "type": "localizerNode", "position": {"x": 400, "y": 300}, "data": {"label": "다국어 번역/더빙 (KR/EN/JP/ES)"}},
                    # Distribution Nodes
                    {"id": "3a", "type": "channelNode", "position": {"x": 800, "y": 0}, "data": {"label": "한국 채널 업로드"}},
                    {"id": "3b", "type": "channelNode", "position": {"x": 800, "y": 200}, "data": {"label": "미국 채널 업로드"}},
                    {"id": "3c", "type": "channelNode", "position": {"x": 800, "y": 400}, "data": {"label": "일본 채널 업로드"}},
                    {"id": "3d", "type": "channelNode", "position": {"x": 800, "y": 600}, "data": {"label": "스페인 채널 업로드"}}
                ],
                "edges": [
                    {"id": "e1-2", "source": "1", "target": "2"},
                    {"id": "e2-3a", "source": "2", "target": "3a"},
                    {"id": "e2-3b", "source": "2", "target": "3b"},
                    {"id": "e2-3c", "source": "2", "target": "3c"},
                    {"id": "e2-3d", "source": "2", "target": "3d"}
                ]
            }
        }
    ]

    for t_data in templates:
        t = models.WorkflowTemplate(
            category=t_data["category"],
            title=t_data["title"],
            description=t_data["description"],
            icon=t_data.get("icon", "Layout"),
            graph_json=t_data["graph_json"]
        )
        db.add(t)
    
    db.commit()
