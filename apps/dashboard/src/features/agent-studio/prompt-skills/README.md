# ViraLoop Prompt Skills (Bento Box)

이 폴더는 Omni(ImageFX/Imagen 3) 및 Veo 비디오 생성기의 프롬프트 품질을 극대화하기 위한 **모듈형 프롬프트 스킬 카탈로그**입니다.

## 아키텍처 개요 (Bento Box Model)
대형언어모델(LLM)이 프롬프트 전체를 무작위로 창작하면 일관성이 무너집니다. 대신 깃허브나 커뮤니티에서 검증된 **'카메라 워킹', '조명', '스타일'** 키워드를 독립된 파츠(JSON)로 저장해두고 조립하여 사용합니다.

- **[Camera] + [LLM이 추출한 Subject & Action] + [Lighting] + [Style]**

## 새로운 스킬 추가 방법 (How to Contribute)
인터넷(예: `awesome-video-prompts` 레포지토리)에서 훌륭한 영상을 만드는 프롬프트를 발견하셨나요?
그 문장을 분석하여 각 파츠별로 분류한 뒤, 이 폴더의 JSON 파일(예: `cinematic.json`, `anime.json` 등)에 데이터를 추가하기만 하면 됩니다.
시스템이 구동될 때 자동으로 `index.js`를 통해 모든 스킬을 스캔하여 코파일럿 UI에 노출시킵니다.

### JSON 스키마 예시
```json
{
  "id": "cinematic_epic",
  "name": "시네마틱 에픽 (Cinematic Epic)",
  "category": "Cinematic",
  "camera": "Slow dynamic dolly in, tracking shot",
  "lighting": "Volumetric lighting, golden hour, moody shadows",
  "style": "8k resolution, photorealistic, 35mm lens, masterpiece"
}
```

## 자동화 팁
향후 크롤링 에이전트(OpenClaw 등)를 연동하여 인터넷의 최신 프롬프트를 자동으로 분석하고 위 JSON 양식에 맞추어 이 폴더에 `.json` 파일을 떨궈주기만 하면 끝없는 확장이 가능합니다.
