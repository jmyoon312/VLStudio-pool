# ⚙️ ViraLoop Studio - FastAPI Back-End Engine (apps/api)

이 디렉토리는 ViraLoop Studio의 무인 자동화 연산, AI 생성 및 미디어 프로세싱을 총괄하는 **FastAPI 백엔드 엔진 워크스페이스**입니다.  
고속 미디어 수집 다운로더, 동적 자막 타임라인 변환, 비주얼 스튜디오, TTS 오디오 합성 및 SQLite 로컬 DB 통합 등 핵심 비즈니스 로직 연산을 안전하고 강력하게 구동합니다.

---

## 🛠️ 기술 스택 및 의존성 (Tech Stack)

*   **API Framework**: FastAPI, Uvicorn (로컬 호스트 REST API 서빙)
*   **Database ORM**: SQLAlchemy + SQLite3 (WAL 모드로 다중 프로세스 동시 쓰기 극대화)
*   **Media Processing**: FFmpeg (오디오/비디오 병합, 컷편집, 인코딩)
*   **Browser Control & Scraping**: DrissionPage & Playwright (Google Flow CDP 우회 및 고속 다운로드)
*   **AI Models Integration**: Faster-Whisper (고속 자막 추출), PyTorch, Google Flow Generative API

---

## 🏗️ 백엔드 디렉토리 아키텍처 (Backend Architecture)

과거 파편화되었던 `apps/swarm`의 Node.js 에이전트 로직을 완전히 흡수하여, **LangGraph 기반의 플러그인형 두뇌(Pluggable Brain) 아키텍처**와 **Root MCP 바인딩**을 통해 ViraLoop Studio의 궁극적인 코어로 재구조화되었습니다.

apps/api/
 ├── 📂 app/                 # 백엔드 코어 소스코드 디렉토리
 │    ├── 📂 config/         # 시스템 전역 설정 및 런타임 경로 주입
 │    ├── 📂 routers/        # 각 기능별 RESTful API 및 스웜 파이프라인 엔드포인트
 │    ├── 📂 services/       # 비즈니스 로직 (AI 렌더링, 오디오 합성, Scraper 등)
 │    ├── 📂 state_management/ # [신설] LangGraph 기반 상태(State) 보존 및 HITL 제어
 │    ├── 📂 agent/          # [신설] LiteLLM 기반 플러그인 두뇌(Pluggable Brains) 라우팅
 │    ├── 📂 models.py       # SQLAlchemy SQLite 데이터베이스 스키마 정의
 │    └── 📄 main.py         # FastAPI 애플리케이션 진입점 및 미들웨어
 ├── 📂 dev_utils/           # 개발자/엔지니어용 전용 내부 유틸리티 스크립트 모음
 │    ├── 📄 migrate_postgres_to_sqlite.py - 포스트그레스 DB 마이그레이션 도구
 │    └── 📄 audit_db.py, queue_management.py 등
 ├── 📂 subtitle_core/       # 고성능 자막 자동 렌더링 및 음향 처리 전용 서브엔진
 ├── 📂 tests/               # [신설] 테스트 및 헬스 체크용 전용 통합 스크립트 디렉토리
 │
 ├── 📄 .env.example         # 로컬 환경 정의용 예시 템플릿
 ├── 📄 requirements.txt     # [통합] 가상환경 라이브러리 가동을 위한 단 하나의 표준 의존성 명세
 ├── 📄 README.md            # 본 아키텍처 설명 가이드 문서
 │
 ├── 🐳 Dockerfile.api       # 백엔드 API 서비스 도커 이미지 정의서 (Sovereign 배포 필수)
 ├── 🐳 Dockerfile.worker    # 분산 AI 연산 워크프로세스 도커 이미지 정의서 (Sovereign 배포 필수)
 ├── 🐳 entrypoint.sh        # 도커 컨테이너 구동 시 실행되는 초기 진입점 셸 스크립트
 └── ⚙️ api_server.spec       # PyInstaller 데스크톱 로컬 패키징 실행파일 빌드 설정서
```

---

## 🧠 차세대 AI 코어 아키텍처 (Hermes & Root MCP)

1. **플러그인형 두뇌 (Pluggable Brains)**:
   LiteLLM 프록시 레이어를 통해, 특정 모델에 종속되지 않고 환경과 난이도에 따라 `OpenClaude 3.5`, `Hermes-V3`, `OpenHands` 등 다양한 최상위 AI 모델을 시스템의 뇌(Core Brain)로 즉각 교체할 수 있습니다.
2. **LangGraph 기반 상태 머신**:
   다형성 워크플로우(Type A: 리믹스, Type B: 생성형)를 LangGraph 상태 트리로 관리합니다. 인간의 승인이 필요한 구간(HITL)에서 프로세스를 안전하게 일시정지(Suspend)하고 UI 컨펌 후 재개(Resume)합니다.
3. **Root MCP 완벽 통제**:
   루트 폴더(`mcp-server`)에 위치한 고성능 Node.js MCP 서버를 `routers/mcp_registry.py`를 통해 FastAPI의 Native Tool로 완벽 바인딩하여 시스템의 딜레이 없는 제어를 보장합니다.

---

## ⚡ 로컬 실행 및 물리 저장소 분리 규칙 (Operational Standards)

### 1. 무정적 무결성 레포지토리 (Pristine Repository)
*   프로젝트 소스 코드 내부에 임시 캐시나 동적 데이터가 쌓여 깃허브 변경 상태를 어지럽히지 않도록, `downloads`, `media`, `temp_storage`, `temp_media` 등의 폴더는 레포지토리에 미리 생성·포함하지 않습니다.
*   백엔드 엔진은 가동 시점에 해당 임시 폴더의 부재를 감지하고, **실시간 다이나믹하게 자동 생성(Dynamic Directory Creation)**하여 무중단 연산을 보증합니다.

### 2. 구글 OAuth 비밀 정보 및 보안 키 통합 격리 (`credentials`)
*   사용자의 로그인 상태를 암호화하기 위한 핵심 키(`fernet_key.key`) 및 구글 로그인 인증 정보(`client_secret.json`)는 깃에 노출되거나 로컬 레포지토리 폴더를 오염시키지 않도록 **프로젝트 영역 밖의 외부 보안 디렉토리로 완전 디커플링(Decoupling)**되었습니다.
*   **보안 물리 경로**: **`C:\ViraLoopMedia\credentials\`**
*   *안전 마이그레이션*: 레포지토리 내의 구형 로컬 폴더에 보안 파일이 존재하는 경우, 백엔드가 기동될 때 암호 해독 유실 없이 안전하게 외부 보안 디렉토리로 **자동 감지 및 복사 이관**되므로 기존 채널 연동 정보가 완벽하게 유지됩니다.

### 3. 데이터베이스 및 물리 저장소 연계 (`C:\ViraLoopMedia`)
*   백엔드 엔진은 깃허브 소스 코드의 무결성을 완벽하게 지키기 위해, 모든 대용량 런타임 파일(다운로드 비디오, 임시 오디오, SQLite DB, 캐시 DB, 크롬 프로필)을 프로젝트 폴더 외부인 **`C:\ViraLoopMedia`** 경로로 자동 격리하여 적재합니다.
*   해당 경로 연계 구조는 `app/config/__init__.py`에 매핑되어 있으며, 환경변수 `VIRALOOP_MEDIA_ROOT` 및 `VIRALOOP_STORAGE_DIR`을 통해 커스텀 오버라이드할 수 있습니다.

---
*Developed by ViraLoop Media Corp. - Enterprise Monorepo Architecture Standards*
