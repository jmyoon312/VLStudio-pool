import os
import time
from faster_whisper import WhisperModel
from datetime import timedelta

class WhisperTranscriber:
    def __init__(self, model_size="base", device="cuda", compute_type="auto", model_path=None):
        self.model_size = model_size
        self.model_path = model_path
        self.device = device
        self.compute_type = compute_type
        
        print(f"[Whisper] Initializing Transcriber with model={model_size}, device={device}")

        try:
            import torch
            if device == "cuda":
                if not torch.cuda.is_available():
                    print("[Whisper] Device is 'cuda' but CUDA not available. Falling back to CPU...")
                    device = "cpu"
                    compute_type = "int8"
                else:
                    cap = torch.cuda.get_device_capability()
                    if cap[0] < 7 and compute_type == "auto":
                        print(f"[Whisper] Detected GPU Compute {cap[0]}.{cap[1]} (< 7.0). Forcing compute_type='int8'.")
                        compute_type = "int8"
        except ImportError:
            # torch가 설치되지 않았으므로 CTranslate2 기반 CPU 모드로 강제 전환
            print("[Whisper] torch not installed → forcing CPU / int8 mode for faster-whisper (CTranslate2 backend).")
            device = "cpu"
            compute_type = "int8"
        except Exception as e:
            print(f"[Whisper] Warning during CUDA pre-check: {e}")
            print("[Whisper] Falling back to CPU to be safe.")
            device = "cpu"
            compute_type = "int8"

        self.device = device
        self.compute_type = compute_type

        # 로컬 캐시된 snapshot 폴더가 있으면 직접 지정 → HuggingFace 네트워크 요청 0건
        resolved_path, is_local = self._resolve_local_model_path(model_size, model_path)

        def _load_model(model_ref, dev, ctype, local_only):
            kwargs = {"device": dev, "compute_type": ctype}
            if local_only:
                # HF_HUB_OFFLINE=1 : huggingface_hub 의 모든 네트워크 요청(revision 체크 포함) 완전 차단
                os.environ["HF_HUB_OFFLINE"] = "1"
                kwargs["local_files_only"] = True
            else:
                os.environ.pop("HF_HUB_OFFLINE", None)
                kwargs["download_root"] = model_path
            return WhisperModel(model_ref, **kwargs)


        try:
            print(f"[Whisper] Initializing model '{model_size}' on '{device}' (compute: {compute_type}, local={is_local})...")
            self.model = _load_model(resolved_path, device, compute_type, is_local)
            print(f"✅ [Whisper] Model '{model_size}' loaded successfully on '{device}'.")
        except Exception as e:
            print(f"⚠️ [Whisper] Failed to initialize on '{device}': {e}")
            if device == "cuda":
                print("[Whisper] Retrying on CPU with 'int8'...")
                self.device = "cpu"
                self.compute_type = "int8"
                try:
                    self.model = _load_model(resolved_path, "cpu", "int8", is_local)
                    print(f"✅ [Whisper] Model '{model_size}' loaded successfully on CPU.")
                except Exception as e2:
                    print(f"❌ [Whisper] CRITICAL: CPU fallback also failed: {e2}")
                    raise e2
            else:
                raise e

    @staticmethod
    def _resolve_local_model_path(model_size: str, download_root: str | None) -> tuple[str, bool]:
        """
        download_root 아래에 이미 다운로드된 snapshot 폴더가 있으면
        그 절대경로를 반환하고 local_only=True 플래그를 함께 반환.
        없으면 (model_size 이름, False) 반환 → 자동 다운로드.
        """
        import glob

        # 1. download_root 가 지정된 경우 먼저 거기서 탐색
        search_roots = []
        if download_root:
            search_roots.append(download_root)

        # 2. 스크립트 위치(apps/api/) 기준 로컬 캐시도 탐색
        api_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        search_roots.append(api_dir)

        # 3. HuggingFace 기본 캐시
        search_roots.append(os.path.join(os.path.expanduser("~"), ".cache", "huggingface", "hub"))

        for root in search_roots:
            if not root or not os.path.isdir(root):
                continue
            # HuggingFace cache 구조: {root}/models--Systran--faster-whisper-{size}/snapshots/{hash}/
            pattern = os.path.join(root, f"models--Systran--faster-whisper-{model_size}", "snapshots", "*", "model.bin")
            matches = glob.glob(pattern)
            if matches:
                snapshot_dir = os.path.dirname(matches[0])
                print(f"[Whisper] [OK] Local model found at: {snapshot_dir}")
                return snapshot_dir, True

        print(f"[Whisper] No local cache found for model '{model_size}'. Will download from HuggingFace.")
        return model_size, False

    def format_timestamp(self, seconds: float):
        td = timedelta(seconds=seconds)
        total_seconds = int(td.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        secs = total_seconds % 60
        millis = int((td.total_seconds() - total_seconds) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


    def transcribe(self, video_path, output_srt_path=None, language=None):
        if not os.path.exists(video_path):
            print(f"[Whisper] ERROR: File not found for transcription: {video_path}")
            return {"status": "error", "message": f"File not found: {video_path}"}

        try:
            print(f"[Whisper] Starting actual transcription call for: {video_path}")
            start_time = time.time()
            
            current_beam = 5 if self.device == "cuda" else 2
            transcribe_kwargs = {"beam_size": current_beam}
            if language:
                transcribe_kwargs["language"] = language
                
            print(f"[Whisper] Calling self.model.transcribe(language={language or 'auto'}, beam_size={current_beam})...")
            try:
                segments, info = self.model.transcribe(video_path, **transcribe_kwargs)
            except Exception as e:
                error_str = str(e).lower()
                # cublas64_12.dll, libcublas, cuBLAS, ARCH_MISMATCH 등 GPU 관련 런타임 오류 전부 커버
                is_gpu_error = any(kw in error_str for kw in [
                    "arch_mismatch", "libcublas", "cublas64", "cublas", 
                    "cudnn", "cuda", "dll is not found", "cannot be loaded"
                ])
                if is_gpu_error:
                    print(f"⚠️ [Whisper] GPU execution failed: {str(e).splitlines()[-1]}")
                    print(f"🔄 [Whisper] Emergency Fallback: Reloading model onto CPU...")
                    self.model = None
                    import gc; gc.collect()
                    try:
                        import torch; torch.cuda.empty_cache()
                    except:
                        pass
                    from faster_whisper import WhisperModel
                    self.device = "cpu"
                    self.compute_type = "int8"
                    self.model = WhisperModel(self.model_size, device="cpu", compute_type="int8", download_root=self.model_path)
                    print("✅ [Whisper] CPU Model reloaded. Retrying transcription...")
                    transcribe_kwargs["beam_size"] = 2
                    segments, info = self.model.transcribe(video_path, **transcribe_kwargs)
                else:
                    raise e
            
            detected_lang = info.language
            print(f"[Whisper] Detected language: {detected_lang} (probability: {info.language_probability:.2f})")

            if not output_srt_path:
                base_name = os.path.splitext(video_path)[0]
                output_srt_path = f"{base_name}.{detected_lang}.srt"

            # 3. Generate SRT content
            with open(output_srt_path, "w", encoding="utf-8") as f:
                for i, segment in enumerate(segments, start=1):
                    start_val = segment.start
                    end_val = segment.end
                    
                    if i % 5 == 0 or i == 1:
                        print(f"[Whisper] Progress: {end_val:.1f}s / {info.duration:.1f}s (Segment #{i})")
                        
                    start = self.format_timestamp(start_val)
                    end = self.format_timestamp(end_val)
                    text = segment.text.strip()
                    
                    f.write(f"{i}\n")
                    f.write(f"{start} --> {end}\n")
                    f.write(f"{text}\n\n")

            elapsed = time.time() - start_time
            print(f"[Whisper] Transcription completed in {elapsed:.2f}s -> {output_srt_path}")
            
            return {
                "status": "success",
                "language": detected_lang,
                "srt_path": output_srt_path,
                "duration": info.duration,
                "processing_time": elapsed
            }

        except Exception as e:
            print(f"[Whisper] Error during transcription: {e}")
            import traceback
            traceback.print_exc()
            return {"status": "error", "message": str(e)}

_transcriber_instances = {}

def get_transcriber(model_size="base", model_path=None):
    key = f"{model_size}_{model_path}"
    if key not in _transcriber_instances:
        _transcriber_instances[key] = WhisperTranscriber(model_size=model_size, model_path=model_path)
    return _transcriber_instances[key]
