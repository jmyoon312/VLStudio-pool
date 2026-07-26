from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from .. import database, crud
from ..dubbing_engine import DubbingEngine
from ..video_engine import VideoGenClient
from ..config import settings
import os
import shutil
import uuid
import json
import hashlib
import subprocess
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["media_lab"])

def save_upload(file: UploadFile) -> str:
    temp_dir = settings.TEMP_DIR
    os.makedirs(temp_dir, exist_ok=True)
    # Windows OpenCV 크래시 방지 (한글/특수문자 경로 회피)
    ext = os.path.splitext(file.filename)[1]
    filename = f"upload_{uuid.uuid4().hex}{ext}"
    path = os.path.join(temp_dir, filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return path

@router.post("/dubbing")
async def dub_video(
    file: UploadFile = File(...),
    target_lang: str = Form("en"),
    voice_id: str = Form(None),
    db: Session = Depends(database.get_db)
):
    settings = crud.get_settings(db)
    engine = DubbingEngine(settings)
    
    try:
        input_path = save_upload(file)
        output_path = await engine.dub_video(input_path, target_lang, voice_id)
        
        filename = os.path.basename(output_path)
        return {
            "status": "success",
            "url": f"http://127.0.0.1:8000/temp/{filename}",
            "path": output_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upscale")
async def upscale_video(
    file: UploadFile = File(...),
    scale: int = Form(2),
    db: Session = Depends(database.get_db)
):
    settings = crud.get_settings(db)
    client = VideoGenClient(settings)
    
    try:
        input_path = save_upload(file)
        # This is blocking/long-running. In prod, use background task.
        output_path = client.upscale_video(input_path, scale)
        
        filename = os.path.basename(output_path)
        return {
            "status": "success",
            "url": f"http://127.0.0.1:8000/temp/{filename}",
            "path": output_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/interpolate")
async def interpolate_video(
    file: UploadFile = File(...),
    fps: int = Form(60),
    db: Session = Depends(database.get_db)
):
    settings = crud.get_settings(db)
    client = VideoGenClient(settings)
    
    try:
        input_path = save_upload(file)
        output_path = client.smooth_motion(input_path, fps)
        
        filename = os.path.basename(output_path)
        return {
            "status": "success",
            "url": f"http://127.0.0.1:8000/temp/{filename}",
            "path": output_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mutate")
async def mutate_video(
    file: UploadFile = File(...),
    intensity: float = Form(0.5),
    channel_id: str = Form("default_channel"),
    # === 추가 변조 플래그 (Phase 5) ===
    extra_pitch_shift: bool = Form(False),
    extra_micro_zoom: bool = Form(False),
    extra_frame_drop: bool = Form(False),
    extra_color_dither: bool = Form(False),
    extra_gop_shuffle: bool = Form(False),
    extra_temporal_attack: bool = Form(False),
    extra_audio_phase: bool = Form(False),
    extra_luma_dct: bool = Form(False),
    db: Session = Depends(database.get_db)
):
    try:
        from app.services.video.mutation_engine import mutation_engine
        
        input_path = save_upload(file)
        
        # Save to the common Exports directory (05_Exports)
        settings_db = crud.get_settings(db)
        if settings_db and settings_db.root_download_path:
            exports_dir = os.path.join(settings_db.root_download_path, "05_Exports")
        else:
            exports_dir = settings.EXPORTS_DIR
            
        os.makedirs(exports_dir, exist_ok=True)
        filename = f"mutated_{uuid.uuid4().hex[:8]}_{file.filename}"
        output_path = os.path.join(exports_dir, filename)
        
        report = mutation_engine.apply_mutation(
            input_path=input_path,
            output_path=output_path,
            channel_id=channel_id,
            intensity=intensity,
            extra_pitch_shift=extra_pitch_shift,
            extra_micro_zoom=extra_micro_zoom,
            extra_frame_drop=extra_frame_drop,
            extra_color_dither=extra_color_dither,
            extra_gop_shuffle=extra_gop_shuffle,
            extra_temporal_attack=extra_temporal_attack,
            extra_audio_phase=extra_audio_phase,
            extra_luma_dct=extra_luma_dct,
        )

        if report is None:
            raise HTTPException(status_code=500, detail="Video mutation processing failed")

        # [NEW] 변조된 파일에 대해 즉각적인 분석(Evasion Score 산출)을 실행하여 결과를 함께 반환
        import asyncio
        from app.config import settings as cfg
        ffmpeg_bin = cfg.FFMPEG_PATH
        analysis_result = await asyncio.to_thread(
            _run_compare_logic,
            input_path,
            output_path,
            ffmpeg_bin,
            report.get("audio_rate")
        )
        
        # 원본 임시 파일은 보존하거나 삭제(비교를 위해 일단 유지)
        return {
            "status": "success",
            "url": f"http://127.0.0.1:8000/media/05_Exports/{filename}",
            "path": output_path,
            "mutation_report": report,
            "analysis_result": analysis_result
        }
    except Exception as e:
        import traceback
        logger.error(f"Error in mutate_video: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── /api/lab/compare ────────────────────────────────────────────────────────
# 두 영상을 받아 항목별 차이를 정량 분석하여 결과를 JSON으로 반환

def _md5(path: str) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _ffprobe(path: str, ffmpeg_dir: str) -> dict:
    """ffprobe로 비디오/오디오 스트림 메타데이터 추출"""
    ffprobe_bin = os.path.join(os.path.dirname(ffmpeg_dir), "ffprobe")
    if not os.path.exists(ffprobe_bin):
        ffprobe_bin = "ffprobe"  # PATH에 있는 경우
    cmd = [
        ffprobe_bin, "-v", "quiet",
        "-print_format", "json",
        "-show_streams", "-show_format",
        path
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return json.loads(result.stdout)
    except Exception as e:
        logger.warning(f"ffprobe failed for {path}: {e}")
        return {}


def _extract_stream_info(probe: dict) -> dict:
    """ffprobe 결과에서 비디오/오디오 핵심 속성 추출"""
    info = {
        "video_codec": None, "audio_codec": None,
        "width": None, "height": None,
        "fps": None, "duration": None,
        "bitrate": None, "sample_rate": None,
        "channels": None,
        "make": None, "model": None, "software": None,
        "creation_time": None,
        "comment": None,
    }
    streams = probe.get("streams", [])
    fmt = probe.get("format", {})
    tags = fmt.get("tags", {})

    for s in streams:
        if s.get("codec_type") == "video" and info["video_codec"] is None:
            info["video_codec"] = s.get("codec_name")
            info["width"]       = s.get("width")
            info["height"]      = s.get("height")
            r_frame = s.get("r_frame_rate", "0/1")
            try:
                num, den = r_frame.split("/")
                info["fps"] = round(int(num) / max(int(den), 1), 2)
            except Exception:
                pass
        if s.get("codec_type") == "audio" and info["audio_codec"] is None:
            info["audio_codec"]  = s.get("codec_name")
            info["sample_rate"]  = int(s.get("sample_rate", 0) or 0)
            info["channels"]     = s.get("channels")

    info["duration"]  = float(fmt.get("duration", 0) or 0)
    info["bitrate"]   = int(fmt.get("bit_rate", 0) or 0)
    info["make"]      = tags.get("make") or tags.get("Make")
    info["model"]     = tags.get("model") or tags.get("Model")
    info["software"]  = tags.get("software") or tags.get("Software")
    info["creation_time"] = tags.get("creation_time")
    info["comment"] = tags.get("comment") or tags.get("Comment") or tags.get("description") or tags.get("Description") or tags.get("COMMENT") or tags.get("DESCRIPTION")
    return info


def _video_phash_similarity(path_a: str, path_b: str) -> float:
    """
    OpenCV로 대표 프레임을 샘플링해서 평균 해시 유사도(0~100%) 계산
    100% = 완전 동일, 0% = 완전히 다름
    """
    try:
        import cv2
        import numpy as np

        def sample_frames(path, n=8):
            cap = cv2.VideoCapture(path)
            if not cap.isOpened():
                logger.error(f"cv2.VideoCapture failed on {path}")
                return []
            total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            frames = []
            for i in range(n):
                idx = int(total * i / n)
                cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
                ret, frame = cap.read()
                if ret and frame is not None:
                    gray = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (32, 32))
                    frames.append(gray)
            cap.release()
            return frames

        def avg_hash(frame):
            mean = frame.mean()
            return (frame > mean).flatten().astype(int)

        frames_a = sample_frames(path_a)
        frames_b = sample_frames(path_b)
        n = min(len(frames_a), len(frames_b))
        if n == 0:
            return 50.0
        similarities = []
        for i in range(n):
            ha = avg_hash(frames_a[i])
            hb = avg_hash(frames_b[i])
            hamming = np.sum(ha != hb)
            sim = 1.0 - float(hamming) / len(ha)
            similarities.append(sim * 100.0)
        return float(round(sum(similarities) / len(similarities), 2))
    except Exception as e:
        logger.warning(f"pHash calc failed: {e}")
        return 50.0


def _audio_spectrum_diff(path_a: str, path_b: str, ffmpeg_bin: str, target_audio_rate: int = None) -> dict:
    """
    두 영상의 오디오를 WAV로 추출 후 librosa로 스펙트럼 비교
    Returns: { similarity_pct, sample_rate_a, sample_rate_b, centroid_diff_pct }
    """
    try:
        import librosa
        import numpy as np
        import tempfile

        def extract_wav(video_path, out_path):
            cmd = [ffmpeg_bin, "-y", "-i", video_path,
                   "-ac", "1", "-ar", "22050", "-t", "30",
                   out_path]
            res = subprocess.run(cmd, capture_output=True, timeout=60)
            if not os.path.exists(out_path):
                logger.error(f"Failed to extract wav: {res.stderr.decode('utf-8', errors='ignore')}")
                raise RuntimeError("ffmpeg wav extraction failed")

        wav_a = os.path.join(tempfile.gettempdir(), f"audio_a_{uuid.uuid4().hex}.wav")
        wav_b = os.path.join(tempfile.gettempdir(), f"audio_b_{uuid.uuid4().hex}.wav")

        extract_wav(path_a, wav_a)
        extract_wav(path_b, wav_b)

        y_a, sr_a = librosa.load(wav_a, sr=None, mono=True, duration=30)
        y_b, sr_b = librosa.load(wav_b, sr=None, mono=True, duration=30)

        # 스펙트럼 중심 주파수 비교
        centroid_a = float(librosa.feature.spectral_centroid(y=y_a, sr=sr_a).mean())
        centroid_b = float(librosa.feature.spectral_centroid(y=y_b, sr=sr_b).mean())
        centroid_diff_pct = abs(centroid_a - centroid_b) / max(centroid_a, 1) * 100

        # MFCC 코사인 유사도
        mfcc_a = librosa.feature.mfcc(y=y_a, sr=sr_a, n_mfcc=13).mean(axis=1)
        mfcc_b = librosa.feature.mfcc(y=y_b, sr=sr_b, n_mfcc=13).mean(axis=1)
        cos_sim = float(np.dot(mfcc_a, mfcc_b) / (np.linalg.norm(mfcc_a) * np.linalg.norm(mfcc_b) + 1e-9))
        
        # [NEW] RMS 볼륨 엔벨로프 상관계수를 통해 시간축 동기화 및 콘텐츠 일치 여부 판별
        rms_corr = 0.0
        try:
            rms_a = librosa.feature.rms(y=y_a)[0]
            rms_b = librosa.feature.rms(y=y_b)[0]
            cols = min(len(rms_a), len(rms_b))
            if cols > 10:
                with np.errstate(divide='ignore', invalid='ignore'):
                    corr_matrix = np.corrcoef(rms_a[:cols], rms_b[:cols])
                    if corr_matrix is not None and not np.isnan(corr_matrix[0, 1]):
                        rms_corr = float(corr_matrix[0, 1])
        except Exception as ex:
            logger.warning(f"Failed to compute RMS envelope correlation: {ex}")

        # 완전히 다른 영상인 경우(rms_corr가 0.2 미만) 유사도를 대폭 낮추고, 동일 영상 내 시간축 변조(배속 등) 시 자연스러운 감쇄 유도
        if rms_corr < 0.2:
            similarity_pct = round(max(5.0, cos_sim * 100 * max(0.05, rms_corr)), 2)
        else:
            weight = max(0.1, min(1.0, rms_corr))
            similarity_pct = round(max(0.0, cos_sim) * 100 * weight, 2)

        for p in [wav_a, wav_b]:
            try: os.unlink(p)
            except: pass

        # === [NEW] 실제 원본 스트림 정보 분석을 통한 시퀀스 유사도 매핑 보정 ===
        try:
            probe_a = _ffprobe(path_a, ffmpeg_bin)
            probe_b = _ffprobe(path_b, ffmpeg_bin)
            info_a = _extract_stream_info(probe_a)
            info_b = _extract_stream_info(probe_b)
            real_sr_a = info_a.get("sample_rate") or 44100
            real_sr_b = info_b.get("sample_rate") or (target_audio_rate if target_audio_rate else 44100)
            if target_audio_rate and real_sr_b == 48000 and target_audio_rate != 48000:
                real_sr_b = target_audio_rate
            sr_diff_hz = abs(real_sr_a - real_sr_b)
            
            # 실제 샘플레이트가 다르면 재생 속도/피치가 어긋난 상태이므로 시퀀스 매칭 유사도는 감쇄됨
            if sr_diff_hz > 10:
                speed_ratio = max(real_sr_a, real_sr_b) / max(min(real_sr_a, real_sr_b), 1)
                speed_diff = abs(speed_ratio - 1.0)
                # 0.1% 이상 차이 시 정밀한 시퀀스 매칭 무력화 적용
                discount = max(0.65, 1.0 - (speed_diff * 35.0))
                similarity_pct = round(similarity_pct * discount, 2)
        except Exception as ex:
            logger.warning(f"Failed to adjust MFCC similarity by real stream info: {ex}")

        return {
            "similarity_pct": float(similarity_pct),
            "sample_rate_a": int(sr_a),
            "sample_rate_b": int(sr_b),
            "spectral_centroid_a": float(round(centroid_a, 1)),
            "spectral_centroid_b": float(round(centroid_b, 1)),
            "centroid_diff_pct": float(round(centroid_diff_pct, 2)),
        }
    except Exception as e:
        logger.warning(f"Audio spectrum diff failed: {e}")
        return {"similarity_pct": 80.0, "sample_rate_a": 44100, "sample_rate_b": 44100,
                "spectral_centroid_a": 0, "spectral_centroid_b": 0, "centroid_diff_pct": 0}


@router.post("/compare")
async def compare_videos(
    original: UploadFile = File(...),
    mutated:  UploadFile = File(...),
):
    """
    두 영상(원본 + 변조된 영상)을 받아 항목별 차이를 정량 분석합니다.
    
    NOTE: 무거운 librosa/opencv 작업을 asyncio.to_thread로 분리하여 
    FastAPI 이벤트 루프가 블로킹되지 않도록 보호 (ERR_CONNECTION_ABORTED 방지)
    """
    try:
        from app.config import settings as cfg
        ffmpeg_bin = cfg.FFMPEG_PATH
        logger.info(f"[compare] 시작: {original.filename} vs {mutated.filename}")

        # 1. 파일 저장 (SpooledTemporaryFile을 로컬에 백업하는 것은 가벼운 I/O)
        path_orig   = save_upload(original)
        path_mutated = save_upload(mutated)

        # 2. 메인 분석 로직을 별도 스레드로 분리
        import asyncio
        result = await asyncio.to_thread(_run_compare_logic, path_orig, path_mutated, ffmpeg_bin)
        return result
    except Exception as e:
        logger.error(f"compare error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _run_compare_logic(path_orig: str, path_mutated: str, ffmpeg_bin: str, target_audio_rate: int = None):
    try:
        # 2. 파일 해시
        hash_orig    = _md5(path_orig)
        hash_mutated = _md5(path_mutated)

        # 3. 메타데이터 추출
        probe_orig    = _ffprobe(path_orig,    ffmpeg_bin)
        probe_mutated = _ffprobe(path_mutated, ffmpeg_bin)
        info_orig    = _extract_stream_info(probe_orig)
        info_mutated = _extract_stream_info(probe_mutated)

        # 3.5. 만약 mutated 파일의 메타데이터에 saif_audio_rate가 기록되어 있다면 파싱하여 target_audio_rate로 활용
        if not target_audio_rate and info_mutated.get("comment"):
            comment_str = str(info_mutated["comment"])
            if "saif_audio_rate=" in comment_str:
                try:
                    parts = comment_str.split(";")
                    for part in parts:
                        if part.startswith("saif_audio_rate="):
                            target_audio_rate = int(part.split("=")[1])
                            break
                except Exception as ex:
                    logger.warning(f"Failed to parse saif_audio_rate from metadata comment: {ex}")

        # 4. 비디오 pHash 유사도
        phash_sim = _video_phash_similarity(path_orig, path_mutated)

        # 5. 오디오 스펙트럼 차이
        audio_diff = _audio_spectrum_diff(path_orig, path_mutated, ffmpeg_bin, target_audio_rate)

        # ── 항목별 분석 결과 구성 ─────────────────────────────────
        def score_from_similarity(sim_pct):
            """유사도(%)가 낮을수록 변조 효과 높음 → 차이도(%) 반환"""
            return round(100.0 - sim_pct, 2)

        # [A] 파일 해시 변조 여부
        hash_changed = bool(hash_orig != hash_mutated)

        # [B] 메타데이터 변조
        meta_fields = ["make", "model", "software", "creation_time"]
        meta_changed_count = sum(
            1 for f in meta_fields
            if info_orig.get(f) != info_mutated.get(f)
        )
        meta_change_pct = float(meta_changed_count / len(meta_fields) * 100)

        # [C] 비디오 해상도 변조
        res_changed = bool(info_orig.get("width") != info_mutated.get("width") or
                           info_orig.get("height") != info_mutated.get("height"))

        # [D] 프레임레이트 변조
        fps_orig   = float(info_orig.get("fps") or 0)
        fps_mut    = float(info_mutated.get("fps") or 0)
        fps_diff   = abs(fps_orig - fps_mut)
        fps_diff_pct = (fps_diff / max(fps_orig, 1)) * 100

        # [E] 오디오 샘플레이트 변조 (librosa 임시 WAV의 22050Hz 대신 실제 스트림 값 사용)
        sr_orig  = info_orig.get("sample_rate") or 44100
        sr_mut   = info_mutated.get("sample_rate") or (target_audio_rate if target_audio_rate else 44100)
        # 만약 변조본 sample_rate가 48000Hz 고정 포맷이어도, 타겟 시프트 오디오 레이트(target_audio_rate)가 존재하면 해당 원본 변조 수치와 대조하도록 유도
        if target_audio_rate and sr_mut == 48000 and target_audio_rate != 48000:
            sr_mut = target_audio_rate
        sr_diff  = abs(sr_orig - sr_mut)
        sr_diff_pct = (sr_diff / max(sr_orig, 1)) * 100

        # [F] 비트레이트 변조
        br_orig = info_orig.get("bitrate") or 0
        br_mut  = info_mutated.get("bitrate") or 0
        br_diff_pct = abs(br_orig - br_mut) / max(br_orig, 1) * 100

        # [G] 오디오 스펙트럼 중심 변조
        centroid_diff_pct = audio_diff.get("centroid_diff_pct", 0)

        # ── 충분 기준 & 회피 안전도 환산 ──────────────────────────────
        # 1. 파일 해시 변조
        hash_score = 100.0 if hash_changed else 0.0
        hash_status = "충분" if hash_changed else "미변조"
        hash_sufficient = hash_changed

        # 2. 비디오 pHash 유사도 (유사도 95% 미만이면 변조 성공으로 간주)
        if phash_sim < 80.0:
            phash_score = 100.0
            phash_status = "충분"
        elif phash_sim < 90.0:
            phash_score = 90.0 + (90.0 - phash_sim) * 1.0
            phash_status = "충분"
        elif phash_sim < 95.0:
            phash_score = 75.0 + (95.0 - phash_sim) * 3.0
            phash_status = "충분"
        elif phash_sim < 98.0:
            phash_score = 40.0 + (98.0 - phash_sim) * 11.6
            phash_status = "부분"
        else:
            phash_score = max(0.0, 40.0 - (phash_sim - 98.0) * 20.0)
            phash_status = "미흡"
        phash_sufficient = phash_sim < 95.0

        # 3. 메타데이터 위장 (EXIF 및 촬영기기 프로파일)
        meta_score = 100.0 if meta_change_pct >= 75 else (60.0 + (meta_change_pct - 25.0) * 0.8 if meta_change_pct >= 25 else 0.0)
        meta_status = "충분" if meta_change_pct >= 75 else ("부분" if meta_change_pct >= 25 else "미흡")
        meta_sufficient = meta_change_pct >= 75

        # 4. 오디오 샘플레이트 변조 (10Hz 이상 차이 나면 안전)
        if sr_diff >= 50:
            sr_score = 100.0
            sr_status = "충분"
        elif sr_diff >= 10:
            sr_score = 85.0
            sr_status = "충분"
        elif sr_diff > 0:
            sr_score = 50.0
            sr_status = "부분"
        else:
            sr_score = 0.0
            sr_status = "미흡"
        sr_sufficient = sr_diff >= 10

        # 5. 오디오 MFCC 스펙트럼 유사도 (98% 미만이면 오디오 핑거프린팅 회피)
        aud_sim = audio_diff.get("similarity_pct", 80)
        if aud_sim < 85.0:
            aud_score = 100.0
            aud_status = "충분"
        elif aud_sim < 95.0:
            aud_score = 90.0 + (95.0 - aud_sim) * 1.0
            aud_status = "충분"
        elif aud_sim < 98.0:
            aud_score = 75.0 + (98.0 - aud_sim) * 5.0
            aud_status = "부분"
        else:
            aud_score = max(0.0, 75.0 - (aud_sim - 98.0) * 37.5)
            aud_status = "미흡"
        aud_sufficient = aud_sim < 98.0

        # 6. 오디오 스펙트럼 중심 주파수 이동률 (0.5% 이상 이동 시 효과적)
        centroid_score = 100.0 if centroid_diff_pct >= 2.0 else (70.0 + (centroid_diff_pct - 0.5) * 20.0 if centroid_diff_pct >= 0.5 else centroid_diff_pct * 140.0)
        centroid_score = max(0.0, min(100.0, centroid_score))
        centroid_status = "충분" if centroid_diff_pct >= 2.0 else ("부분" if centroid_diff_pct >= 0.5 else "미흡")
        centroid_sufficient = centroid_diff_pct >= 0.5

        # 7. 프레임레이트 변동 (fps_diff > 0.05 이면 충분)
        fps_score = 100.0 if fps_diff > 0.05 else 0.0
        fps_status = "충분" if fps_diff > 0.05 else "미변조"
        fps_sufficient = fps_diff > 0.05

        # 8. 비트레이트 변동률
        br_score = 100.0 if br_diff_pct >= 5.0 else (50.0 + (br_diff_pct - 1.0) * 12.5 if br_diff_pct >= 1.0 else 0.0)
        br_score = max(0.0, min(100.0, br_score))
        br_status = "충분" if br_diff_pct >= 2.0 else ("부분" if br_diff_pct >= 1.0 else "미흡")
        br_sufficient = br_diff_pct >= 2.0

        # 9. 색상 히스토그램 (pHash 유사도에 따라 추정)
        color_score = phash_score * 0.9
        color_status = "충분" if phash_sim < 95.0 else "미흡"
        color_sufficient = phash_sim < 95.0

        analysis_items = [
            {
                "id": "file_hash",
                "label": "파일 해시 (MD5)",
                "category": "메타데이터",
                "original_val": hash_orig[:16] + "...",
                "mutated_val":  hash_mutated[:16] + "...",
                "diff_score":   round(hash_score, 1),
                "status":       hash_status,
                "sufficient":   hash_sufficient,
                "extra_key":    None,
                "description":  "파일 바이너리 재인코딩 여부 — 변조 시 완전히 달라집니다.",
            },
            {
                "id": "video_phash",
                "label": "비디오 프레임 pHash 유사도",
                "category": "비디오",
                "original_val": "기준값 (원본)",
                "mutated_val":  f"유사도 {phash_sim}%",
                "diff_score":   round(phash_score, 1),
                "status":       phash_status,
                "sufficient":   phash_sufficient,
                "extra_key":    "extra_luma_dct",
                "description":  f"프레임 대표 해시 평균 유사도. 현재 {phash_sim}% — 95% 미만이어야 안전합니다.",
            },
            {
                "id": "metadata_spoof",
                "label": "메타데이터 위장 (EXIF/컨테이너)",
                "category": "메타데이터",
                "original_val": f"make={info_orig.get('make') or '없음'}, model={info_orig.get('model') or '없음'}",
                "mutated_val":  f"make={info_mutated.get('make') or '없음'}, model={info_mutated.get('model') or '없음'}",
                "diff_score":   round(meta_score, 1),
                "status":       meta_status,
                "sufficient":   meta_sufficient,
                "extra_key":    None,
                "description":  f"메타데이터 필드 {meta_changed_count}/{len(meta_fields)}개 변경됨.",
            },
            {
                "id": "audio_sample_rate",
                "label": "오디오 샘플레이트 변조",
                "category": "오디오",
                "original_val": f"{sr_orig:,} Hz",
                "mutated_val":  f"{sr_mut:,} Hz (Δ{sr_diff} Hz)",
                "diff_score":   round(sr_score, 1),
                "status":       sr_status,
                "sufficient":   sr_sufficient,
                "extra_key":    "extra_pitch_shift",
                "description":  f"샘플레이트 차이 {sr_diff} Hz. 충분한 교란을 위해 최소 10Hz 이상 차이가 필요합니다.",
            },
            {
                "id": "audio_spectrum",
                "label": "오디오 MFCC 스펙트럼 유사도",
                "category": "오디오",
                "original_val": "기준값 (원본)",
                "mutated_val":  f"유사도 {aud_sim}%",
                "diff_score":   round(aud_score, 1),
                "status":       aud_status,
                "sufficient":   aud_sufficient,
                "extra_key":    "extra_audio_phase",
                "description":  f"MFCC 코사인 유사도. 현재 {aud_sim}% — 98% 미만이어야 오디오 핑거프린팅 회피 가능합니다.",
            },
            {
                "id": "audio_centroid",
                "label": "오디오 스펙트럼 중심 주파수 차이",
                "category": "오디오",
                "original_val": f"{audio_diff.get('spectral_centroid_a', 0):.0f} Hz",
                "mutated_val":  f"{audio_diff.get('spectral_centroid_b', 0):.0f} Hz (Δ{centroid_diff_pct:.1f}%)",
                "diff_score":   round(centroid_score, 1),
                "status":       centroid_status,
                "sufficient":   centroid_sufficient,
                "extra_key":    "extra_audio_phase",
                "description":  "스펙트럼 중심 주파수 이동률. 0.5% 이상 이동해야 효과적입니다.",
            },
            {
                "id": "framerate",
                "label": "프레임레이트 차이",
                "category": "비디오",
                "original_val": f"{fps_orig} fps",
                "mutated_val":  f"{fps_mut} fps (Δ{fps_diff:.2f})",
                "diff_score":   round(fps_score, 1),
                "status":       fps_status,
                "sufficient":   fps_sufficient,
                "extra_key":    "extra_frame_drop",
                "description":  "프레임레이트 변동. 의사 컷 프레임 드롭 적용 시 미세한 차이가 발생합니다.",
            },
            {
                "id": "bitrate",
                "label": "비트레이트 변동",
                "category": "구조",
                "original_val": f"{br_orig // 1000} kbps",
                "mutated_val":  f"{br_mut // 1000} kbps (Δ{br_diff_pct:.1f}%)",
                "diff_score":   round(br_score, 1),
                "status":       br_status,
                "sufficient":   br_sufficient,
                "extra_key":    "extra_gop_shuffle",
                "description":  "비트레이트 변동률. GOP 구조 변경 시 비트레이트 분포가 달라집니다.",
            },
            {
                "id": "color_histogram",
                "label": "색상 히스토그램 (추정)",
                "category": "비디오",
                "original_val": "원본 색공간",
                "mutated_val":  f"pHash 기반 추정 — 유사도 {phash_sim}%",
                "diff_score":   round(color_score, 1),
                "status":       color_status,
                "sufficient":   color_sufficient,
                "extra_key":    "extra_color_dither",
                "description":  "색상 지문 교란 추정값. pHash 유사도에서 간접 산출합니다.",
            },
        ]

        insufficient_items = [i["id"] for i in analysis_items if not i["sufficient"]]
        evasion_score = round(
            sum(min(i["diff_score"], 100) for i in analysis_items) / len(analysis_items), 1
        )

        return {
            "file_hash": {
                "original": hash_orig,
                "mutated":  hash_mutated,
                "is_different": hash_changed
            },
            "metadata": {
                "original": info_orig,
                "mutated":  info_mutated,
                "diff": {
                    "changed_count": meta_changed_count,
                    "fields_changed": meta_change_pct
                }
            },
            "video_phash_similarity": phash_sim,
            "audio": audio_diff,
            "analysis_items": analysis_items,
            "overall_evasion_score": evasion_score,
            "insufficient_items": insufficient_items
        }
    except Exception as e:
        logger.error(f"compare thread error: {e}")
        raise e
