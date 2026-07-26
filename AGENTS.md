# ViraLoop Studio (VLStudio Desktop)

Electron 데스크톱 앱 - Google Flow AI로 이미지/비디오 생성 후 CapCut 프로젝트로 내보내기

## 기반 프로젝트
- whisk2capcut-desktop를 fork하여 Flow API로 교체
- AutoFlow Chrome 확장 (10.7.58)에서 역공학한 API 사용

## AI 에이전트 전역 규칙
- 모든 새로운 기능 개발이나 리팩토링을 시작하기 전에, 반드시 `C:\Users\jmyoo\.gemini\antigravity\skills` 및 `C:\ViraLoopMedia\VLStudio\.agent\skills` 폴더에서 현재 작업과 관련된 키워드로 스킬을 검색하고, 가장 적합한 `SKILL.md`를 읽은 후 그 지침에 따라 코드를 작성할 것.
