# 🎬 ViraLoop Studio - React Frontend Dashboard (apps/dashboard)

이 디렉토리는 ViraLoop Studio의 최고급 크리에이터 웹 UI 제어판을 담당하는 **React 프론트엔드 워크스페이스**입니다.  
Vite 번들러와 프리미엄 Sovereign 테마 디자인 시스템을 기반으로 빌드되어, 데스크톱 사용자에게 최상의 룩앤필과 부드러운 micro-interactions를 선사합니다.

---

## 🎨 기술 스택 및 라이브러리 (Tech Stack)

*   **Core**: React 18, TypeScript, React Router DOM (Single Page App)
*   **Build & Asset Dev**: Vite v5, PostCSS, TailwindCSS
*   **State Management**: Zustand (전역 클라이언트 및 설정 상태 관리)
*   **Server Sync**: TanStack Query (React Query v5 - 캐싱 및 비동기 REST 상태 자동 동기화)
*   **Creative Engine**: Remotion (로컬 플레이어 동영상 프리뷰 및 동적 자막 타임라인 편집)
*   **UI Components**: Radix UI (Unstyled primitives), Lucide React (Unified icon system)

---

## 🏗️ 디렉토리 아키텍처 (Directory Architecture)

```
apps/dashboard/
 ├── 📂 src/
 │    ├── 📂 components/     # 재사용 가능한 UI 컴포넌트 (Sidebar, Layout, Gallery 등)
 │    ├── 📂 pages/          # 39개 이상의 최적화된 엔터프라이즈 모듈 페이지
 │    │    ├── 🎬 EliteCommandStudio.tsx    - AI 비디오 리믹싱 및 오케스트레이션 메인 스튜디오
 │    │    └── 🎨 Pixeling.tsx             - AI 픽셀 아트 비주얼 에디터
 │    ├── 📂 config/         # 글로벌 메뉴, 라우팅 스키마 등 정적 메타데이터 설정
 │    │    └── 📄 menu.ts                  - 6대 엔터프라이즈 기능 그룹 매핑 정의
 │    ├── 📂 lib/            # Axios API 인스턴스 및 공용 유틸리티 함수
 │    └── 📄 main.tsx        # 프론트엔드 SPA 진입 진입점
 ├── 📄 vite.config.ts       # 빌드 세팅 및 백엔드 포트 자동 프록시(Proxy) 규칙 정의
 └── 📄 package.json         # 독립 프론트엔드 의존성 및 스크립트 명세
```

---

## ⚡ 주요 실행 및 개발 명령어 (Scripts)

모노레포 루트 패키지 매니저 필터를 사용하거나, 본 폴더로 진입하여 명령을 구동할 수 있습니다.

```bash
# 1. 로컬 개발 서버 구동 (Vite Dev Server)
npm run dev

# 2. 독립 프로덕션 번들 빌드 (Vite Production Build)
# 빌드된 결과물은 프로젝트 루트의 dist/ 폴더로 복사되어 Electron이 로드합니다.
npm run build

# 3. 린트 및 코드 품질 검사
npm run lint
```

---

## 💡 개발 가이드라인 (Developer Guidelines)
1. **Sovereign 디자인 시스템 준수**:
   - 아드혹 스타일링을 지양하고 `index.css` 및 Sovereign 디자인 스타일 토큰에 명시된 curated 색상표(HSL), 미려한 그라데이션, glassmorphism 효과를 사용하여 통일성을 100% 보존해야 합니다.
2. **API 통신 일원화**:
   - 백엔드(`/api/*`)와의 모든 통신은 `src/lib/api.ts`에 주입된 글로벌 Axios 인스턴스를 통해 호출해야 하며, 로컬 데이터베이스 쿼리를 프론트엔드에 하드코딩해서는 안 됩니다.

---
*Developed by ViraLoop Media Corp. - Enterprise Monorepo Architecture Standards*
