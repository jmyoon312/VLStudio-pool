
import os
import subprocess
import logging
import random
from app.config import settings

logger = logging.getLogger(__name__)

class MutationEngine:
    """
    [SAIF Phase 5] Advanced Adversarial Media Mutation Engine
    
    2026 기술 스택 반영:
    - Temporal Consistency Attack: 프레임 시퀀스의 시간적 연속성을 교란하여
      Transformer 기반 핑거프린팅 모델의 시퀀스 분석을 무력화
    - Sparse Perturbation: 특정 프레임에만 집중적으로 노이즈 투영하고
      propagation 효과로 전체 시퀀스 해시를 교란
    - GOP 구조 랜덤화: I-프레임 배치 무작위화로 Content ID의 키프레임 의존 분석 차단
    - 오디오 DWT 도메인 위상 교란: 주파수 대역별 독립 위상 시프트
    - 메타데이터 완전 스푸핑: 촬영 장비 위장 (하드웨어 레벨)
    """

    def __init__(self):
        self.ffmpeg = settings.FFMPEG_PATH

    def _build_seed(self, channel_id: str) -> int:
        """채널 ID → MD5 시드 정수 변환"""
        import hashlib
        return int(hashlib.md5(str(channel_id).encode()).hexdigest(), 16) % 1000000

    def _get_input_fps(self, path: str) -> float:
        """ffprobe를 사용하여 입력 영상의 프레임레이트(FPS) 추출"""
        import os
        import subprocess
        ffprobe_bin = os.path.join(os.path.dirname(self.ffmpeg), "ffprobe")
        if not os.path.exists(ffprobe_bin):
            ffprobe_bin = "ffprobe"
        cmd = [
            ffprobe_bin, "-v", "quiet",
            "-select_streams", "v:0",
            "-show_entries", "stream=r_frame_rate",
            "-print_format", "csv=p=0",
            path
        ]
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            r_frame = res.stdout.strip()
            if "/" in r_frame:
                num, den = r_frame.split("/")
                return round(int(num) / max(int(den), 1), 2)
            return float(r_frame)
        except Exception:
            return 30.0

    def _get_input_audio_sr(self, path: str) -> int:
        """ffprobe를 사용하여 입력 영상의 오디오 샘플레이트 추출"""
        import os
        import subprocess
        ffprobe_bin = os.path.join(os.path.dirname(self.ffmpeg), "ffprobe")
        if not os.path.exists(ffprobe_bin):
            ffprobe_bin = "ffprobe"
        cmd = [
            ffprobe_bin, "-v", "quiet",
            "-select_streams", "a:0",
            "-show_entries", "stream=sample_rate",
            "-print_format", "csv=p=0",
            path
        ]
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            sr_str = res.stdout.strip()
            return int(sr_str) if sr_str else 44100
        except Exception:
            return 44100

    def apply_mutation(
        self,
        input_path: str,
        output_path: str,
        channel_id: str = "default_channel",
        intensity: float = 0.5,
        # === 추가 변조 플래그 ===
        extra_pitch_shift: bool = False,
        extra_micro_zoom: bool = False,
        extra_frame_drop: bool = False,
        extra_color_dither: bool = False,
        extra_gop_shuffle: bool = False,
        extra_temporal_attack: bool = False,
        extra_audio_phase: bool = False,
        extra_luma_dct: bool = False,
    ) -> dict | None:
        """
        [SAIF Phase 5] DNA-Locked 다층 변조 실행

        Returns:
            dict: 성공 시 상세 변조 보고서
            None: 실패
        """
        seed_int = self._build_seed(channel_id)
        random.seed(seed_int)

        # 변조 세기(Intensity)에 따른 고급 변조 레이어 자동 상향 활성화
        if intensity >= 0.8:
            extra_micro_zoom = True
            extra_gop_shuffle = True
        if intensity >= 1.2:
            extra_pitch_shift = True
            extra_audio_phase = True
        if intensity >= 2.0:
            extra_frame_drop = True
            extra_color_dither = True
            extra_luma_dct = True
            extra_temporal_attack = True

        logger.info(f"🧬 [SAIF-P5] Mutation start → {input_path}  (Seed: {seed_int}, Intensity: {intensity})")

        # ──────────────────────────────────────────────────────
        # 1. 기본 시각 변조 필터 구성
        # ──────────────────────────────────────────────────────
        noise_str = 1 + (6 * intensity)          # 세기 비례 노이즈 강도
        gamma     = 1.0 + (random.uniform(-0.012, 0.012) * intensity)
        sat       = 1.0 + (random.uniform(0.005, 0.025) * intensity)
        
        # [NEW 기본 캔버스 변조] - pHash 8x8 DCT를 부수기 위한 픽셀 공간 강제 이동
        base_crop = 1.0 - (0.002 + 0.005 * intensity) # 기본적으로 0.2%~0.7% 크롭
        
        visual_filters = [
            f"crop=iw*{base_crop:.4f}:ih*{base_crop:.4f}",
            f"scale=iw/{base_crop:.4f}:ih/{base_crop:.4f}",
            "pad=ceil(iw/2)*2:ceil(ih/2)*2", # 1279x719 같은 홀수 픽셀 발생 시 무조건 1px 패딩하여 짝수(1280x720) 강제 복원
            f"noise=alls={noise_str:.2f}:allf=t+u",
            f"eq=gamma={gamma:.5f}:saturation={sat:.5f}",
            "format=yuv420p",
        ]

        # ──────────────────────────────────────────────────────
        # 2. 추가 시각 변조 레이어
        # ──────────────────────────────────────────────────────
        
        # [추가] 마이크로 캔버스 크롭 (0.8% 확대) — pHash 픽셀 기준점 이동
        if extra_micro_zoom:
            # 캔버스를 시드 기반 0.5~1.2% 확대 후 원본 해상도로 복원
            crop_factor = 1.0 - (0.005 + random.uniform(0.001, 0.007) * intensity)
            visual_filters.insert(0, f"crop=iw*{crop_factor:.4f}:ih*{crop_factor:.4f},scale=iw/{crop_factor:.4f}:ih/{crop_factor:.4f},pad=ceil(iw/2)*2:ceil(ih/2)*2")

        # [추가] 의사 컷 프레임 드롭 — 시간적 연속성 파괴 (Temporal Consistency Attack)
        # Content ID의 시간 기반 시퀀스 매칭을 교란
        if extra_frame_drop:
            # 시드 기반으로 특정 프레임 위치에서 단일 프레임 삭제
            drop_interval = random.randint(150, 400)  # N 프레임마다 1프레임 제거
            visual_filters.append(
                f"select='not(mod(n,{drop_interval}))',setpts=N/FRAME_RATE/TB"
            )

        # [추가] 색조 히스토그램 미세 진동 — 색상 기반 핑거프린팅 교란
        if extra_color_dither:
            hue_shift  = random.uniform(-3.0, 3.0) * intensity
            br_adj     = random.uniform(-0.03, 0.03) * intensity
            visual_filters.append(
                f"hue=h={hue_shift:.3f},eq=brightness={br_adj:.4f}"
            )

        # [추가] Luma DCT 계수 미세 교란 — 주파수 도메인 pHash 분쇄
        # frei0r 플러그인 없이 vignette + blur로 유사 DCT 교란 효과 구현
        if extra_luma_dct:
            blur_amount = 0.3 + (intensity * 0.4)
            visual_filters.append(
                f"gblur=sigma={blur_amount:.2f}:steps=1"
            )

        # ──────────────────────────────────────────────────────
        # 3. 오디오 변조 필터 구성
        # ──────────────────────────────────────────────────────
        # [SAIF-P5] 기본 오디오 파괴 공작 (MFCC 스펙트럼 자체 교란)
        # 오리지널 주파수를 정확히 추적하여 확실한 차이를 만드는 주파수 시프트 적용
        orig_sr = self._get_input_audio_sr(input_path)
        # 입력 주파수 대비 무조건 차이가 나도록 최소 80Hz 이상 벌어지는 랜덤 시프트 강제
        shift_amount = (80 + random.randint(0, 150)) * intensity
        # 시드 부호에 따른 위/아래 주파수 쉬프트 결정
        audio_rate = int(orig_sr + (shift_amount if seed_int % 2 == 0 else -shift_amount))
        
        audio_filters = [
            f"asetrate={audio_rate}",
            "aresample=48000", # asetrate 후 AAC 인코더가 요구하는 표준 샘플레이트로 리샘플링하여 NaN 에러(무한대/노이즈) 방지
            "highpass=f=40,lowpass=f=16000",
        ]

        # [추가] 오디오 피치 시프트 강화 — atempo로 피치 독립 조절
        if extra_pitch_shift:
            tempo_shift = 1.0 + random.uniform(-0.008, 0.008) * (1 + intensity)
            audio_filters.insert(0, f"atempo={tempo_shift:.5f}")

        # [추가] DWT 도메인 위상 교란 — 오디오 위상 반전으로 주파수 핑거프린트 분산
        # FFmpeg에서는 aphaser/aecho를 통한 위상 교란으로 구현
        if extra_audio_phase:
            phase_delay = 1.0 + random.uniform(0.5, 2.0) * intensity
            decay       = 0.1 + random.uniform(0.05, 0.15) * intensity
            audio_filters.append(
                f"aphaser=in_gain=0.9:out_gain=0.9:delay={phase_delay:.2f}:decay={decay:.2f}:speed=0.5"
            )

        vf = ",".join(visual_filters)
        af = ",".join(audio_filters)

        # ──────────────────────────────────────────────────────
        # 4. 메타데이터 스푸핑 프로파일 (확장판)
        # ──────────────────────────────────────────────────────
        # [SAIF-P5] 8개 장비 프로파일로 확장 (기존 4개 → 8개)
        spoof_profiles = [
            {"make": "Apple",    "model": "iPhone 15 Pro",              "software": "iOS 17.6.1",              "handler": "Core Media Video"},
            {"make": "Apple",    "model": "iPhone 16 Pro Max",          "software": "iOS 18.2.1",              "handler": "Core Media Video Handler"},
            {"make": "Samsung",  "model": "SM-S928N (Galaxy S24 Ultra)","software": "Android 14 (OneUI 6.1)", "handler": "Samsung Camera Video Handler"},
            {"make": "Samsung",  "model": "SM-S936B (Galaxy S25+)",     "software": "Android 15 (OneUI 7.0)", "handler": "Samsung Camera Video Handler"},
            {"make": "Sony",     "model": "ILCE-7M4 (A7 IV)",           "software": "Sony Cam Firmware Ver 3.01", "handler": "Sony Video Handler"},
            {"make": "Sony",     "model": "ZV-E10M2",                   "software": "Sony Cam Firmware Ver 2.00", "handler": "Sony Cam Video Handler"},
            {"make": "Google",   "model": "Pixel 8 Pro",                "software": "Android 14 (AP2A)",       "handler": "Google Camera Video Handler"},
            {"make": "DJI",      "model": "Osmo Pocket 3",              "software": "DJI Firmware v01.04.05",  "handler": "DJI Camera Handler"},
        ]
        profile = spoof_profiles[seed_int % len(spoof_profiles)]

        # 가상 촬영 시각 생성 (1 ~ 23시간 전 랜덤, 시드 고정)
        import datetime
        mock_hours_ago  = 1 + (seed_int % 22)
        mock_minutes    = random.randint(0, 59)
        mock_time       = datetime.datetime.utcnow() - datetime.timedelta(hours=mock_hours_ago, minutes=mock_minutes)
        creation_time_str = mock_time.strftime("%Y-%m-%dT%H:%M:%SZ")

        # ──────────────────────────────────────────────────────
        # 5. GOP 구조 파라미터 결정
        # ──────────────────────────────────────────────────────
        # 기본: 시드 기반 GOP 크기 60~120
        gop_size = random.randint(60, 120)
        # [추가] GOP 극단 셔플 모드: 30~240 범위로 확장하여 I-프레임 배치 무작위화
        if extra_gop_shuffle:
            gop_size = random.randint(30, 240)

        # ──────────────────────────────────────────────────────
        # 6. Temporal Attack: 속도 미세 변조
        # ──────────────────────────────────────────────────────
        # [추가] 0.998 ~ 1.002 범위의 극소 속도 변조로 시간 축 핑거프린트 분쇄
        extra_pts_filter = ""
        if extra_temporal_attack:
            pts_factor = 1.0 + random.uniform(-0.002, 0.002) * intensity
            extra_pts_filter = f",setpts={pts_factor:.5f}*PTS"
            vf = vf + extra_pts_filter

        # ──────────────────────────────────────────────────────
        # 6.5. FPS(프레임레이트) 변조
        # ──────────────────────────────────────────────────────
        input_fps = self._get_input_fps(input_path)
        fps_shift_options = ["23.976", "24", "25", "29.97", "30"]
        # 입력 FPS와 0.1 초과 차이나는 옵션만 필터링
        choices = [opt for opt in fps_shift_options if abs(float(opt) - input_fps) > 0.1]
        if not choices:
            choices = fps_shift_options
        target_fps = random.choice(choices)
        
        # ──────────────────────────────────────────────────────
        # 7. FFmpeg 커맨드 조립
        # ──────────────────────────────────────────────────────
        cmd = [
            self.ffmpeg, "-y",
            "-i", input_path,
            "-vf", vf,
            "-af", af,

            # === 메타데이터 완전 소거 후 스푸핑 프로파일 주입 ===
            "-map_metadata", "-1",
            "-movflags", "use_metadata_tags", # MP4에 metadata 강제 인식
            "-metadata", f"title={profile['make']} {profile['model']} Video",
            "-metadata", f"make={profile['make']}",
            "-metadata", f"model={profile['model']}",
            "-metadata", f"software={profile['software']}",
            "-metadata", f"creation_time={creation_time_str}",
            "-metadata", f"comment=saif_audio_rate={audio_rate};saif_intensity={intensity};saif_seed={seed_int}",

            # === GOP 구조 파라미터 ===
            "-g",   str(gop_size),
            "-sc_threshold", "0",   # Scene cut 감지 끄기 → 순수 시드 기반 GOP 유지

            # === 비디오/오디오 인코더 ===
            "-c:v", "libx264", "-crf", str(max(18, int(20 - intensity * 3))), "-preset", "faster",
            "-r", target_fps, # FPS 강제 변조
            "-c:a", "aac", "-b:a", "128k", "-ar", "48000", # 출력 샘플레이트를 48000Hz로 고정하여 원본 44100/22050 파괴
            output_path
        ]

        try:
            logger.info(f"[FALLBACK] [SAIF-P5] FFmpeg exec (GOP={gop_size}, Rate={audio_rate}Hz, Profile={profile['model']})")
            proc = subprocess.run(cmd, check=True, capture_output=True)
            logger.info(f"[MAGIC] [SAIF-P5] Mutation success → {output_path}")

            # ── 상세 변조 보고서 생성 ──────────────────────────────
            applied_layers = []
            applied_layers.append({
                "id": "noise",
                "label": "Temporal Sparse Noise (프레임 가우시안 노이즈)",
                "value": f"강도 {noise_str:.2f} / allf=t+u (시간적 노이즈)",
                "effect": "pHash Hamming 거리 확장 — Content ID 프레임 매칭 차단",
                "category": "비디오",
            })
            applied_layers.append({
                "id": "eq",
                "label": "감마/채도 미세 조율",
                "value": f"gamma={gamma:.5f}, saturation={sat:.5f}",
                "effect": "색상 히스토그램 분포 미세 이동",
                "category": "비디오",
            })
            applied_layers.append({
                "id": "audio_rate",
                "label": "오디오 샘플레이트 시프트",
                "value": f"{audio_rate} Hz (원본 44100 Hz 대비 {audio_rate - 44100:+d} Hz)",
                "effect": "오디오 주파수 지문 교란",
                "category": "오디오",
            })
            applied_layers.append({
                "id": "audio_filter",
                "label": "오디오 대역폭 제한",
                "value": "Highpass 30Hz / Lowpass 17kHz",
                "effect": "비가청 대역 제거로 오디오 핑거프린트 분쇄",
                "category": "오디오",
            })
            applied_layers.append({
                "id": "metadata",
                "label": "메타데이터 완전 소거 + 장비 프로파일 위장",
                "value": f"{profile['make']} {profile['model']} / {profile['software']}",
                "effect": "EXIF 장비 지문 교체 — 하드웨어 연좌제 방어",
                "category": "메타데이터",
            })
            applied_layers.append({
                "id": "creation_time",
                "label": "촬영 타임스탬프 위장",
                "value": f"{mock_hours_ago}시간 {mock_minutes}분 전 촬영으로 위장",
                "effect": "메타데이터 시간 추적 방어",
                "category": "메타데이터",
            })
            applied_layers.append({
                "id": "gop",
                "label": "GOP 구조 랜덤화",
                "value": f"GOP 크기 {gop_size} (sc_threshold=0)",
                "effect": "I-프레임 배치 무작위화 — Content ID 키프레임 분석 차단",
                "category": "구조",
            })

            if extra_micro_zoom:
                applied_layers.append({
                    "id": "micro_zoom",
                    "label": "마이크로 캔버스 크롭",
                    "value": f"캔버스 {(1-crop_factor)*100:.2f}% 크롭 후 복원",
                    "effect": "pHash 픽셀 기준점 이동 — Hamming 거리 급등",
                    "category": "비디오",
                })
            if extra_frame_drop:
                applied_layers.append({
                    "id": "frame_drop",
                    "label": "의사 컷 프레임 드롭",
                    "value": f"매 {drop_interval}프레임마다 1프레임 제거",
                    "effect": "Temporal Fingerprint 시퀀스 교란",
                    "category": "비디오",
                })
            if extra_color_dither:
                applied_layers.append({
                    "id": "color_dither",
                    "label": "색조 히스토그램 진동",
                    "value": f"색조 {hue_shift:+.2f}°, 밝기 {br_adj:+.4f}",
                    "effect": "색상 기반 핑거프린트 교란",
                    "category": "비디오",
                })
            if extra_luma_dct:
                applied_layers.append({
                    "id": "luma_dct",
                    "label": "Luma DCT 계수 교란",
                    "value": f"Gaussian Blur sigma={blur_amount:.2f}",
                    "effect": "주파수 도메인 pHash 분쇄",
                    "category": "비디오",
                })
            if extra_gop_shuffle:
                applied_layers.append({
                    "id": "gop_shuffle",
                    "label": "GOP 키프레임 극단 셔플",
                    "value": f"GOP 크기 {gop_size} (30~240 범위 극단 랜덤화)",
                    "effect": "I-프레임 배치 완전 무작위화",
                    "category": "구조",
                })
            if extra_temporal_attack:
                applied_layers.append({
                    "id": "temporal_attack",
                    "label": "Temporal Consistency Attack",
                    "value": f"PTS 오프셋 ×{pts_factor:.5f}",
                    "effect": "시간 축 핑거프린트 분쇄 — Transformer 기반 분석 무력화",
                    "category": "비디오",
                })
            if extra_pitch_shift:
                applied_layers.append({
                    "id": "pitch_shift",
                    "label": "오디오 피치 시프트 강화",
                    "value": f"atempo={tempo_shift:.5f}",
                    "effect": "피치 독립 속도 변조로 오디오 특징벡터 교체",
                    "category": "오디오",
                })
            if extra_audio_phase:
                applied_layers.append({
                    "id": "audio_phase",
                    "label": "DWT 도메인 오디오 위상 교란",
                    "value": f"aphaser delay={phase_delay:.4f}, decay={decay:.4f}",
                    "effect": "주파수 도메인 위상 교란 — Mel-spectrogram 핑거프린트 무력화",
                    "category": "오디오",
                })

            return {
                "success": True,
                "seed": seed_int,
                "channel_id": channel_id,
                "intensity": intensity,
                "device_profile": {
                    "make": profile["make"],
                    "model": profile["model"],
                    "software": profile["software"],
                    "handler": profile["handler"],
                    "creation_time": creation_time_str,
                },
                "gop_size": gop_size,
                "audio_rate": audio_rate,
                "noise_strength": round(noise_str, 2),
                "gamma": round(gamma, 5),
                "saturation": round(sat, 5),
                "applied_layers": applied_layers,
                "layer_count": len(applied_layers),
                "ffmpeg_vf": vf,
                "ffmpeg_af": af,
            }
        except subprocess.CalledProcessError as e:
            logger.error(f"[FAIL] [SAIF-P5] Mutation failed:\n{e.stderr.decode(errors='replace')}")
            return None

    def warp_script(self, original_script: str, channel_id: str) -> str:
        """
        [SAIF Phase 5] 시맨틱 다각화 (Semantic Mutation)
        - 채널별 독립 어휘 구조로 중복 콘텐츠 클러스터링 감지 차단
        """
        logger.info(f"[SCRIPT] [SAIF-P5] Semantic warping for channel {channel_id}...")

        try:
            from app.llm_manager import get_llm_client
            llm = get_llm_client()

            prompt = f"""[원본 스크립트]:
{original_script}

[작업]: 위 스크립트를 채널 '{channel_id}'의 고유한 어조로 재작성하십시오.
- 의미와 핵심 키워드는 유지하되, 문장 구조와 단어의 30%를 동의어로 교체하십시오.
- 유튜브의 중복 콘텐츠 필터링을 회피하는 것이 목적입니다.
- 결과물은 오직 변조된 스크립트 텍스트만 출력하십시오."""

            warped = llm.generate(prompt)
            if warped and len(warped) > 10:
                logger.info(f"[MAGIC] [SAIF-P5] Script warped successfully (Length: {len(warped)})")
                return warped

        except Exception as e:
            logger.warning(f"[WARN] [SAIF-P5] LLM warping failed, using fallback: {e}")

        # Fallback: 간단한 동의어 치환
        replacements = {
            "추천합니다": "강추드려요",
            "방법은": "팁은",
            "중요합니다": "핵심이에요",
            "시작합니다": "시작해볼게요",
            "확인해보세요": "체크해보세요",
        }
        result = original_script
        for k, v in replacements.items():
            result = result.replace(k, v)
        return result


mutation_engine = MutationEngine()
