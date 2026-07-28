# 📁 ViraLoop Studio Workspaces Applications (apps)

이 디렉토리는 ViraLoop Studio 모노레포의 **핵심 워크스페이스 패키지(Core Applications)**들이 위치하는 공간입니다.  
엔터프라이즈 모노레포 설계 규격에 따라 각 애플리케이션은 철저히 격격되어 독립적인 패키지로 관리되며, 상호 의존 관계는 명확히 규정된 IPC 브릿지 및 HTTP 프로토콜로만 연결됩니다.

---

## 🏗️ 서브 패키지 토폴로지 (Sub-Package Topology)

```
apps/
 ├── 🎬 dashboard/   - React + Vite + Remotion (프론트엔드 UI 대시보드)
 ├── ⚙️ api/         - FastAPI + SQLite + Faster-Whisper (백엔드 코어 엔진)
 └── 🤖 swarm/       - Autonomous Agent Swarm (무인 인텔리전스 에이전트)
```

---

## 🎬 1. [dashboard](file:///c:/ViraLoopMedia/VLStudio/apps/dashboard) (UI & Creative Control Panel)
*   **역할**: 사용자가 ViraLoop Studio의 핵심 모듈을 조작하고 제어할 수 있는 프리미엄 크리에이터 대시보드입니다.
*   **기술 스택**: React 18, Vite, Zustand, TailwindCSS, Remotion Video Player, Lucide Icons
*   **소재지**: [apps/dashboard/](file:///c:/ViraLoopMedia/VLStudio/apps/dashboard)

## ⚙️ 2. [api](file:///c:/ViraLoopMedia/VLStudio/apps/api) (FastAPI RESTful Back-End Engine)
*   **역할**: 고속 미디어 다운로드, AI 이미지 및 비디오 생성, TTS 음성 합성 및 무음 구간 추출, 동적 자막 변환 및 비디오 병합 렌더링 등 모든 중량급 연산을 담당하는 백엔드 프로세스입니다.
*   **기술 스택**: FastAPI (Python), SQLite3 (local DB & WAL Mode), FFmpeg, Playwright/DrissionPage
*   **소재지**: [apps/api/](file:///c:/ViraLoopMedia/VLStudio/apps/api)

## 🤖 3. [swarm](file:///c:/ViraLoopMedia/VLStudio/apps/swarm) (Autonomous Swarm Agents)
*   **역할**: OpenClaude 및 멀티 에이전트 프레임워크를 기반으로, 백엔드 API를 자율 주행 도구로 사용하여 24/7 콘텐츠 소싱 및 트렌드 분석을 무인 수행하는 지능형 에이전트 그룹입니다.
*   **소재지**: [apps/swarm/](file:///c:/ViraLoopMedia/VLStudio/apps/swarm)

---

## 💡 개발 및 테스트 규칙 (Development Standards)
1. **상호 직접 참조 금지 (No Direct Cross-Referencing)**:
   - `dashboard`는 `api` 소스 내부를 직접 import하거나 참조해서는 안 되며, 오직 백엔드 API 명세에 따른 HTTP REST 통신으로만 통신해야 합니다.
2. **의존성 격리 보존**:
   - 프론트엔드 모듈 패키지와 백엔드 라이브러리는 각각의 폴더 내부 `package.json` 및 `requirements.txt`에 철저히 개별 관리되며, 루트로 호이스팅되어 빌드 번들이 무분별하게 꼬이는 현상을 원천 방지합니다.

---
*Developed by ViraLoop Media Corp. - Enterprise Monorepo Architecture Standards*
