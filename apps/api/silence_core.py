import os
import sys
import numpy as np
import noisereduce as nr
from pydub import AudioSegment
from pydub.silence import split_on_silence
from pydub.utils import make_chunks
import pydub.utils as utils
try:
    from app import dependency_manager
except ImportError:
    try:
        from .app import dependency_manager
    except ImportError:
        import dependency_manager

LARGE_FILE_THRESHOLD_MB = 500

class AudioProcessor:
    """Audio processing engine ported from SilenceRemover v4.3"""

    def __init__(self, logger=None):
        try:
            self.ffmpeg_path = dependency_manager.DependencyManager.get_ffmpeg_path()
        except AttributeError:
            # Fallback if dependency_manager is imported differently or structure changed
            self.ffmpeg_path = dependency_manager.get_ffmpeg_path() if hasattr(dependency_manager, 'get_ffmpeg_path') else None
        except Exception as e:
            print(f"Critical Error: {e}")
            self.ffmpeg_path = None
            
        self.logger = logger or (lambda msg, level="INFO": print(f"[{level}] {msg}"))
        self._setup_ffmpeg()

    def _setup_ffmpeg(self):
        if self.ffmpeg_path and os.path.exists(self.ffmpeg_path):
            # 1. Environment variables
            os.environ["FFMPEG_BINARY"] = self.ffmpeg_path
            bin_dir = os.path.dirname(self.ffmpeg_path)
            # Fix: Support both Linux (no ext) and Windows (.exe)
            ffprobe_name = "ffprobe" if sys.platform != "win32" else "ffprobe.exe"
            ffprobe_path = os.path.join(bin_dir, ffprobe_name)
            
            if os.path.exists(ffprobe_path):
                os.environ["FFPROBE_BINARY"] = ffprobe_path
            
            if bin_dir not in os.environ["PATH"]:
                os.environ["PATH"] += os.pathsep + bin_dir

            # 2. AudioSegment configuration
            AudioSegment.converter = self.ffmpeg_path
            if os.path.exists(ffprobe_path):
                AudioSegment.ffprobe = ffprobe_path

            # 3. Patch pydub.utils
            original_which = utils.which
            def patched_which(program):
                if program in ['ffprobe', 'avprobe'] and os.path.exists(ffprobe_path):
                    return ffprobe_path
                elif program in ['ffmpeg', 'avconv']:
                    return self.ffmpeg_path
                return original_which(program)
            
            utils.which = patched_which
            utils.get_encoder_name = lambda: self.ffmpeg_path
            utils.get_prober_name = lambda: ffprobe_path
            
            self.log(f"FFmpeg configured: {self.ffmpeg_path}", "INFO")
        else:
            self.log(f"FFmpeg path not found: {self.ffmpeg_path}", "ERR")

    def log(self, msg, level="INFO"):
        if self.logger:
            self.logger(msg, level)

    def process(self, audio: AudioSegment, opts: dict, path: str = None):
        try:
            # Check file size if path is provided and exists
            if path and os.path.exists(path):
                file_size_mb = os.path.getsize(path) / (1024 * 1024)
                if file_size_mb > LARGE_FILE_THRESHOLD_MB:
                    self.log(f"Large file ({file_size_mb:.0f}MB) detected. Switching to chunk processing.", "WARN")
                    processed = self._process_large_file(audio, opts)
                    return self._apply_studio_effects(processed, opts)
            
            processed = self._process_segment(audio, opts)
            return self._apply_studio_effects(processed, opts)
        except PermissionError:
            self.log("Permission denied. Check if the file is open or if the app needs Admin rights.", "ERR")
            return audio
        except Exception as e:
            self.log(f"Error during processing: {e}", "ERR")
            return audio

    def merge_files(self, file_paths: list, output_path: str, opts: dict = None):
        """
        Merges multiple audio files into a single MP3 file, optionally applying processing.
        """
        opts = opts or {}
        try:
            combined = AudioSegment.empty()
            for fp in file_paths:
                self.log(f"Merging: {os.path.basename(fp)}", "INFO")
                try:
                    seg = AudioSegment.from_file(fp)
                    combined += seg
                except Exception as e:
                    self.log(f"Failed to load {fp}: {e}", "WARN")
            
            # Apply silence removal and noise reduction to the combined audio if requested
            if opts.get("remove_silence") or opts.get("use_nr") or opts.get("normalize"):
                self.log("Applying processing to merged audio...", "INFO")
                combined = self._process_segment(combined, opts)
                
            # Apply studio effects
            combined = self._apply_studio_effects(combined, opts)
            
            # Export as MP3 (192k)
            combined.export(output_path, format="mp3", bitrate="192k")
            self.log(f"Merged and processed {len(file_paths)} files to {os.path.basename(output_path)}", "OK")
            return output_path
        except Exception as e:
            self.log(f"Merge failed: {e}", "ERR")
            raise

    def _apply_studio_effects(self, audio: AudioSegment, opts: dict) -> AudioSegment:
        import tempfile
        import subprocess
        import uuid
        
        filters = []
        
        # 1. Gate & Noise Reduction (Clean signal first)
        if opts.get("studio_gate"):
            # Smooth gate and gentle FFT denoiser to avoid artificial cutoffs
            filters.append("afftdn=nf=-25,agate=threshold=-35dB:ratio=4:attack=10:release=150:makeup=0")
            
        # 2. EQ: Broadcast / Podcast Vocal EQ (Rich, Crisp, In-your-face)
        if opts.get("studio_eq"):
            # Natural warmth and clarity without piercing highs or muddy lows
            filters.append("bass=g=4:f=100:w=0.5")
            filters.append("equalizer=f=300:width_type=h:width=150:g=-3")
            filters.append("equalizer=f=3000:width_type=h:width=2000:g=4")
            filters.append("treble=g=4:f=10000:w=0.5")
            
        # 3. Dynamic Compression (Punchy & Level)
        if opts.get("studio_compressor"):
            # Musical compression: controls peaks naturally without over-amplifying everything
            filters.append("acompressor=threshold=-18dB:ratio=3.5:attack=5:release=50:makeup=4:knee=3")
            
        # 4. Final Loudness Normalization (YouTube/Broadcast Standard)
        if opts.get("studio_loudnorm"):
            # LRA=9 makes it more tightly packed than the default 11
            filters.append("loudnorm=I=-14:TP=-1.0:LRA=9")
            
        if not filters:
            return audio
            
        filter_str = ",".join(filters)
        self.log(f"Applying Studio Effects: {filter_str}", "INFO")
        
        try:
            temp_dir = tempfile.gettempdir()
            temp_in = os.path.join(temp_dir, f"temp_in_{uuid.uuid4().hex}.wav")
            temp_out = os.path.join(temp_dir, f"temp_out_{uuid.uuid4().hex}.wav")
            
            audio.export(temp_in, format="wav")
            
            ffmpeg_cmd = [
                self.ffmpeg_path or "ffmpeg",
                "-y",
                "-i", temp_in,
                "-af", filter_str,
                temp_out
            ]
            
            subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            enhanced = AudioSegment.from_file(temp_out)
            
            if os.path.exists(temp_in): os.remove(temp_in)
            if os.path.exists(temp_out): os.remove(temp_out)
            
            self.log("Studio Effects applied successfully", "OK")
            return enhanced
        except Exception as e:
            self.log(f"Studio Effects failed: {e}", "ERR")
            return audio

    def _process_large_file(self, audio: AudioSegment, opts: dict):
        chunk_size_ms = 60 * 1000
        chunks = make_chunks(audio, chunk_size_ms)

        processed_chunks = []
        for i, chunk in enumerate(chunks):
            self.log(f"Processing chunk {i+1}/{len(chunks)}...", "INFO")
            try:
                processed_chunk = self._process_segment(chunk, opts)
                processed_chunks.append(processed_chunk)
            except Exception as e:
                self.log(f"Chunk {i+1} failed, using original: {e}", "WARN")
                processed_chunks.append(chunk)

        self.log("All chunks processed. Reassembling...", "OK")
        
        try:
            result = AudioSegment.empty()
            for chunk in processed_chunks:
                result += chunk
            return result
        except Exception as e:
            self.log(f"Reassembly failed: {e}", "ERR")
            return audio

    def _process_segment(self, audio: AudioSegment, opts: dict):
        original_ms = len(audio)

        # 1. Sensitivity 0: Merge only (Should be handled by merge_files, but keep as fallback)
        if opts.get("threshold", 0) == 0:
            self.log("Threshold 0 -> Skipping silence removal/NR/Norm", "INFO")
            return audio

        # 2. Noise Reduction
        if opts.get("use_nr"):
            try:
                audio_np = np.array(audio.get_array_of_samples(), dtype=np.float32)
                if audio.sample_width == 2:
                    audio_np /= 32767.0
                
                reduced = nr.reduce_noise(y=audio_np, sr=audio.frame_rate, prop_decrease=opts.get("nr_aggr", 0.15))
                
                if audio.sample_width == 2:
                    reduced = (np.clip(reduced, -1, 1) * 32767).astype(np.int16)
                    sample_width = 2
                else:
                    reduced = reduced.astype(np.int16)
                    sample_width = 2
                
                audio = AudioSegment(
                    reduced.tobytes(),
                    frame_rate=audio.frame_rate,
                    sample_width=sample_width,
                    channels=audio.channels
                )
                self.log(f"Noise reduction complete (Strength: {opts.get('nr_aggr', 0.15):.2f})", "OK")
            except Exception as e:
                self.log(f"Noise reduction failed: {e}", "WARN")

        # 3. Silence Removal
        if opts.get("remove_silence", True):
            try:
                silence_thresh = self._auto_silence_thresh(
                    opts["threshold"], audio.dBFS, opts.get("studio_mode", False)
                )
                
                # Use explicit min_silence_len if provided, otherwise fallback to auto logic
                if "min_silence_len" in opts:
                    min_sil_len = int(opts["min_silence_len"])
                else:
                    min_sil_len = self._shorts_min_silence_len(opts["threshold"])
                
                keep_ms = max(0, int(opts.get("keep_silence_ms", 50)))

                segs = split_on_silence(
                    audio,
                    min_silence_len=min_sil_len,
                    silence_thresh=silence_thresh,
                    keep_silence=keep_ms,
                    seek_step=5, # Increased precision as requested
                )

                if not segs:
                    trimmed = audio
                    sil_count = 0
                else:
                    trimmed = segs[0]
                    for seg in segs[1:]:
                        trimmed = trimmed.append(seg, crossfade=opts.get("crossfade_ms", 40))
                    sil_count = max(0, len(segs) - 1)

                ratio = (original_ms - len(trimmed)) / original_ms * 100 if original_ms > 0 else 0
                self.log(
                    f"Silence removed: {sil_count} segments · {ratio:.1f}% "
                    f"({original_ms/1000:.1f}s -> {len(trimmed)/1000:.1f}s) "
                    f"[MinSil: {min_sil_len}ms]", "OK"
                )
            except PermissionError:
                self.log("Permission denied during silence removal. Check file locks.", "ERR")
                trimmed = audio
            except Exception as e:
                trimmed = audio
                self.log(f"Silence removal failed: {e}", "WARN")
        else:
            trimmed = audio

        # 4. Normalization
        if opts.get("normalize", False):
            try:
                gain = -20.0 - trimmed.dBFS
                trimmed = trimmed.apply_gain(gain)
                self.log(f"Normalization complete (-20dBFS, Gain {gain:+.1f}dB)", "OK")
            except Exception as e:
                self.log(f"Normalization failed: {e}", "WARN")

        return trimmed

    def _auto_silence_thresh(self, user_db: int, dBFS: float, studio_mode: bool) -> int:
        user_db = max(-60, min(-20, user_db))

        if studio_mode:
            if dBFS < -35:
                adjusted = user_db - 5
            elif dBFS < -30:
                adjusted = user_db - 3
            else:
                adjusted = user_db
            final_thresh = max(-60, min(-25, adjusted))
            self.log(f"Studio Mode: Threshold {user_db}dB -> {final_thresh}dB (dBFS={dBFS:.1f})", "INFO")
            return int(final_thresh)

        bias = 0
        if dBFS < -35:
            bias = 5
        elif dBFS < -28:
            bias = 3
        elif dBFS > -20:
            bias = -2

        th = max(-60, min(-25, user_db + bias))
        return int(th)

    def _shorts_min_silence_len(self, user_th: int) -> int:
        abs_th = abs(user_th)
        if abs_th <= 30:
            return 250
        elif abs_th <= 35:
            return 350
        elif abs_th <= 40:
            return 450
        elif abs_th <= 45:
            return 600
        else:
            return 800
