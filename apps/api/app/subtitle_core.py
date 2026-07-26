import os
# Set OMP_NUM_THREADS=1 to prevent Whisper hang on CPU
os.environ["OMP_NUM_THREADS"] = "1"

import re
import shutil
import tempfile
import subprocess
from difflib import SequenceMatcher
from datetime import timedelta
from pydub import AudioSegment

# ====================================================
# SECTION 1: Utility Functions & Core Logic
# ====================================================

def _format_time(seconds):
    """Time format conversion (SRT format)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def _to_ms(t: str) -> int:
    try:
        h, m, s_ms = t.split(":")
        s, ms = s_ms.split(",")
        return (int(h) * 3600 + int(m) * 60 + int(s)) * 1000 + int(ms)
    except ValueError: return 0

def _from_ms(ms: int) -> str:
    """Convert milliseconds to SRT standard format"""
    s = ms // 1000; ms %= 1000
    m = s // 60; s %= 60
    h = m // 60; m %= 60
    return f"{h:02}:{m:02}:{s:02},{ms:03}"

def _norm(s: str) -> str:
    return re.sub(r"[^0-9A-Za-z가-힣]", "", s or "")

def _plain_len(s):
    return len(s.replace(' ', ''))

def split_korean_sentences_strict(text):
    """Strict sentence splitting - split only where punctuation exists"""
    if not text:
        return []
    
    # Punctuation pattern clearly indicating end of sentence
    pattern = r'[^.!?。？！]*[.!?。？！]+[\'\"”』】〕〉》」』】〕〉》】〕〉》】〕〉》】〕〉》]*(?=\s|$)'
    
    sentences = re.findall(pattern, text)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    # If there is remaining text not found by pattern
    remaining = re.sub(pattern, '', text).strip()
    if remaining:
        # If remaining is short (<= 10 chars), merge to last sentence
        if sentences and len(remaining) <= 10:
            sentences[-1] = sentences[-1] + " " + remaining
        elif remaining:
            # If remaining is long, add as separate sentence (no punctuation)
            sentences.append(remaining)
    
    return sentences

def process_faster_whisper_result(segments, progress_callback=None):
    """Convert Faster Whisper results to SRT format (Optimized sentence splitting)"""
    if progress_callback:
        progress_callback("Generating subtitles...")
    
    # Settings
    # Settings
    MAX_CHARS = 40          # Max characters (Reduced for vertical video)
    MAX_DURATION = 3.0      # Max duration (seconds)
    MIN_DURATION = 0.5      # Min duration
    MAX_GAP = 0.5           # Max gap between segments (seconds)
    
    # 1. Split segments into sentences
    all_subtitles = []
    
    for segment in segments:
        text = segment.text.strip()
        if not text or len(text) < 2:
            continue
        
        # Split sentences by punctuation
        # Pattern: . ! ? 。 ！ ？ followed by whitespace
        sentences = re.split(r'([.!?。！？]+)\s+', text)
        
        # Recombine split parts (include punctuation)
        combined_sentences = []
        i = 0
        while i < len(sentences):
            if i + 1 < len(sentences) and re.match(r'[.!?。！？]+$', sentences[i + 1]):
                # With punctuation
                combined_sentences.append(sentences[i] + sentences[i + 1])
                i += 2
            else:
                combined_sentences.append(sentences[i])
                i += 1
        
        # Remove empty strings
        combined_sentences = [s.strip() for s in combined_sentences if s.strip()]
        
        if not combined_sentences:
            combined_sentences = [text]
        
        # Allocate time to each sentence
        segment_duration = segment.end - segment.start
        total_chars = sum(len(s) for s in combined_sentences)
        
        if total_chars == 0:
            continue
        
        current_time = segment.start
        
        for sent in combined_sentences:
            # Time allocation proportional to length
            sent_ratio = len(sent) / total_chars
            sent_duration = segment_duration * sent_ratio
            sent_duration = max(sent_duration, MIN_DURATION)
            
            sent_end = min(current_time + sent_duration, segment.end)
            
            all_subtitles.append({
                'text': sent,
                'start': current_time,
                'end': sent_end
            })
            
            current_time = sent_end
    
    # 2. Force split if subtitle is too long
    final_subtitles = []
    
    for subtitle in all_subtitles:
        text = subtitle['text']
        duration = subtitle['end'] - subtitle['start']
        
        # Split if length or time exceeded
        if len(text) > MAX_CHARS or duration > MAX_DURATION:
            # Split by words
            words = text.split()
            
            if len(words) <= 1:
                final_subtitles.append(subtitle)
                continue
            
            # Split at midpoint
            mid_point = len(words) // 2
            first_half = ' '.join(words[:mid_point])
            second_half = ' '.join(words[mid_point:])
            
            # Time proportional split
            char_ratio = len(first_half) / len(text)
            split_time = subtitle['start'] + (duration * char_ratio)
            
            final_subtitles.append({
                'text': first_half,
                'start': subtitle['start'],
                'end': split_time
            })
            
            final_subtitles.append({
                'text': second_half,
                'start': split_time,
                'end': subtitle['end']
            })
        else:
            final_subtitles.append(subtitle)
    
    # 3. Merge adjacent subtitles if too short
    merged_subtitles = []
    i = 0
    
    while i < len(final_subtitles):
        current = final_subtitles[i]
        
        # Check if mergeable with next subtitle
        if (i < len(final_subtitles) - 1 and
            len(current['text']) < 20 and
            (current['end'] - current['start']) < 1.5):
            
            next_sub = final_subtitles[i + 1]
            gap = next_sub['start'] - current['end']
            
            # Merge if gap is small and combined length is appropriate
            if (gap < MAX_GAP and 
                len(current['text'] + ' ' + next_sub['text']) <= MAX_CHARS):
                
                merged_subtitles.append({
                    'text': current['text'] + ' ' + next_sub['text'],
                    'start': current['start'],
                    'end': next_sub['end']
                })
                i += 2
                continue
        
        merged_subtitles.append(current)
        i += 1
    
    # 4. Generate SRT (CapCut standard format)
    srt_content = ""
    
    for idx, sub in enumerate(merged_subtitles, 1):
        text = sub['text'].strip()
        if not text:
            continue
        
        duration = sub['end'] - sub['start']
        if duration < 0.5:
            continue
        
        # CapCut compatible SRT format
        srt_content += f"{idx}\n"
        srt_content += f"{_format_time(sub['start'])} --> {_format_time(sub['end'])}\n"
        srt_content += f"{text}\n\n"
    
    if not srt_content:
        return None, "Subtitle generation failed"
    
    return srt_content, None

def parse_srt(srt_text: str) -> list[dict]:
    """SRT parsing function - supports various formats"""
    # Normalize empty lines
    normalized_text = re.sub(r'\r\n', '\n', srt_text)
    normalized_text = re.sub(r'\n{3,}', '\n\n', normalized_text)
    
    pattern = re.compile(
        r'(\d+)\s*\n'
        r'(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})\s*\n'
        r'(.*?)(?=\n\n|\n\d+\n|\Z)',
        re.DOTALL
    )
    
    blocks = []
    for m in pattern.findall(normalized_text):
        # Text normalization: multiple lines to single line, clean whitespace
        text = m[3].strip()
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'\n+', ' ', text)
        
        blocks.append({
            "index": int(m[0]),
            "start": m[1].strip(),
            "end": m[2].strip(), 
            "text": text
        })
    
    return blocks

def align_sentences(original_text: str, srt_text: str) -> str:
    """N:M Matching Algorithm - Handles all cases"""
    # 1. Parse input
    sentences = [s.strip() for s in original_text.strip().split('\n') if s.strip()]
    blocks = parse_srt(srt_text)
    
    if not blocks or not sentences:
        return ""
    
    # 2. Sort SRT blocks by time
    blocks_by_time = sorted(blocks, key=lambda b: _to_ms(b["start"]))
    final_end_ms = _to_ms(blocks_by_time[-1]["end"])
    
    # 3. N:M Match Candidate Generation Function
    def generate_match_candidates(sent_start_idx, block_start_idx, sentences, blocks):
        candidates = []
        max_sent = 3
        max_block = 3
        
        for num_sents in range(1, min(max_sent + 1, len(sentences) - sent_start_idx + 1)):
            for num_blocks in range(1, min(max_block + 1, len(blocks) - block_start_idx + 1)):
                selected_sents = sentences[sent_start_idx:sent_start_idx + num_sents]
                combined_sent_text = " ".join(selected_sents)
                
                selected_blocks = blocks[block_start_idx:block_start_idx + num_blocks]
                combined_block_text = " ".join([b["text"] for b in selected_blocks])
                
                time_start = selected_blocks[0]["start"]
                time_end = selected_blocks[-1]["end"]
                
                similarity = SequenceMatcher(
                    None, 
                    _norm(combined_sent_text), 
                    _norm(combined_block_text)
                ).ratio()
                
                candidates.append({
                    'num_sents': num_sents,
                    'num_blocks': num_blocks,
                    'sentences': selected_sents,
                    'blocks': selected_blocks,
                    'time_start': time_start,
                    'time_end': time_end,
                    'similarity': similarity,
                    'combined_sent_text': combined_sent_text,
                    'combined_block_text': combined_block_text
                })
        
        return candidates
    
    # 4. Greedy Matching
    result_pairs = []
    sent_idx = 0
    block_idx = 0
    
    while sent_idx < len(sentences):
        candidates = generate_match_candidates(
            sent_idx, block_idx, sentences, blocks_by_time
        )
        
        if not candidates:
            if result_pairs:
                last_end = result_pairs[-1][2]
                est_start = last_end + 100
                est_end = est_start + 2000
            else:
                est_start = 0
                est_end = 2000
            
            result_pairs.append((sentences[sent_idx], est_start, est_end))
            sent_idx += 1
            continue
        
        best_candidate = max(candidates, key=lambda c: c['similarity'])
        
        if best_candidate['similarity'] < 0.3:
            one_to_one = [c for c in candidates if c['num_sents'] == 1 and c['num_blocks'] == 1]
            if one_to_one:
                best_candidate = one_to_one[0]
        
        total_start_ms = _to_ms(best_candidate['time_start'])
        total_end_ms = _to_ms(best_candidate['time_end'])
        total_duration = total_end_ms - total_start_ms
        
        selected_sents = best_candidate['sentences']
        num_sents = len(selected_sents)
        
        # 5. Time Splitting
        if num_sents == 1:
            result_pairs.append((selected_sents[0], total_start_ms, total_end_ms))
        else:
            total_chars = sum(_plain_len(s) for s in selected_sents)
            current_time = total_start_ms
            
            for i, sent in enumerate(selected_sents):
                sent_chars = _plain_len(sent)
                
                if i == num_sents - 1:
                    sent_end = total_end_ms
                else:
                    char_ratio = sent_chars / max(total_chars, 1)
                    sent_duration = int(total_duration * char_ratio)
                    sent_duration = max(sent_duration, 500)
                    sent_end = current_time + sent_duration
                
                result_pairs.append((sent, current_time, sent_end))
                current_time = sent_end
        
        sent_idx += best_candidate['num_sents']
        block_idx += best_candidate['num_blocks']
    
    # 6. Prevent Time Conflicts
    adjusted_pairs = []
    MIN_GAP = 50
    
    for i, (text, s_ms, e_ms) in enumerate(result_pairs):
        if adjusted_pairs:
            prev_end = adjusted_pairs[-1][2]
            if s_ms < prev_end:
                s_ms = prev_end + MIN_GAP
        
        if i < len(result_pairs) - 1:
            next_s_ms = result_pairs[i + 1][1]
            if e_ms + MIN_GAP > next_s_ms:
                e_ms = max(s_ms + 500, next_s_ms - MIN_GAP)
        
        if e_ms <= s_ms:
            e_ms = s_ms + 1000
        
        if e_ms > final_end_ms:
            e_ms = final_end_ms
        
        adjusted_pairs.append((text, s_ms, e_ms))
    
    # 7. SRT Output
    result = []
    for i, (text, s_ms, e_ms) in enumerate(adjusted_pairs):
        start_str = _from_ms(s_ms)
        end_str = _from_ms(e_ms)
        result.append(f"{i+1}\n{start_str} --> {end_str}\n{text}")
    
    return "\n\n".join(result) + "\n"

def _fix_min_words(lines, min_words):
    i = 0
    while i < len(lines) - 1:
        if len(lines[i].split()) < min_words:
            lines[i+1] = f"{lines[i]} {lines[i+1]}".strip()
            del lines[i]
            continue
        i += 1
    
    if len(lines) > 1 and len(lines[-1].split()) < min_words:
        lines[-2] = f"{lines[-2]} {lines[-1]}".strip()
        lines.pop()
    
    return [l for l in lines if l.strip()]

def balanced_split_kor(text, limit=10, min_words=2, min_chars=5):
    # [SYNC] Reference Code Implementation
    text = re.sub(r"[.,\"'""''、·]", '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    
    if not text:
        return []
    
    words = text.split()
    lines, cur = [], []
    
    for w in words:
        tent = (' '.join(cur + [w])).strip()
        if _plain_len(tent) <= limit or not cur:
            cur = tent.split()
        else:
            lines.append(' '.join(cur))
            cur = [w]
    
    if cur:
        lines.append(' '.join(cur))
    
    lines = _fix_min_words(lines, min_words)
    
    i = 0
    while i < len(lines) - 1:
        if _plain_len(lines[i]) < min_chars:
            lines[i+1] = f"{lines[i]} {lines[i+1]}".strip()
            del lines[i]
            continue
        i += 1
    
    changed = True
    max_iterations = 50
    iteration = 0
    
    while changed and iteration < max_iterations:
        changed = False
        iteration += 1
        
        for i, l in enumerate(lines):
            if _plain_len(l) > limit:
                parts = l.split()
                if len(parts) > 1:
                    if i < len(lines) - 1:
                        move = parts.pop()
                        lines[i] = ' '.join(parts)
                        lines[i+1] = (move + ' ' + lines[i+1]).strip()
                        lines = _fix_min_words(lines, min_words)
                        changed = True
                        break
                    else:
                        split_point = len(parts) - 1
                        while split_point > 0:
                            first_part = ' '.join(parts[:split_point])
                            second_part = ' '.join(parts[split_point:])
                            
                            if _plain_len(first_part) <= limit and _plain_len(second_part) <= limit:
                                lines[i] = first_part
                                lines.append(second_part)
                                changed = True
                                break
                            split_point -= 1
                        
                        if not changed:
                            mid = len(parts) // 2
                            lines[i] = ' '.join(parts[:mid])
                            lines.append(' '.join(parts[mid:]))
                            changed = True
                            break
    
    return [l for l in lines if l.strip()]

def normalize_subtitle_gaps(blocks: list, target_gap_ms: int = 50, max_bridge_gap_ms: int = 1000):
    """
    Step 3: Global Gap Filling (Post-Processing)
    - Extend current block's END time to fill small gaps.
    - Do NOT touch Next Start (Start-Lock).
    """
    for i in range(len(blocks) - 1):
        current_block = blocks[i]
        next_block = blocks[i+1]
        
        # Calculate Gap
        gap = next_block['start'] - current_block['end']
        
        # Fill Gap ONLY if it's small (e.g., < 1.0s) to avoid filling scene changes
        if 0 < gap < max_bridge_gap_ms:
            # EXTEND CURRENT END. Do NOT touch Next Start.
            # Leave a tiny 50ms buffer to prevent flickering
            new_end = next_block['start'] - target_gap_ms
            
            # Safety: Ensure we don't shrink the block below start
            if new_end > current_block['start']:
                current_block['end'] = new_end

    return blocks

def refine_within_sentence_blocks(step1_srt: str, limit: int, use_marker_segmentation: bool = False, language: str = "ko") -> str:

    """
    Step 2: Intra-Sentence Split (Reference Implementation)
    """
    blocks = parse_srt(step1_srt)
    out_blocks = []
    
    MIN_DURATION = 300
    TARGET_GAP = 50
    MIN_SAFE_GAP = 10
    
    # 1. Basic Block Generation
    for b in blocks:
        s_ms = _to_ms(b['start'])
        e_ms = _to_ms(b['end'])
        text = b['text']
        
        if e_ms - s_ms <= 0:
            continue
            
        parts = balanced_split_kor(text, limit=limit, min_words=2, min_chars=5)
        if not parts:
            parts = [text]
        
        total_duration = e_ms - s_ms
        # [SYNC] Reference uses equal division logic
        part_duration = max(total_duration // len(parts), MIN_DURATION)
        
        for i, part in enumerate(parts):
            part_start = s_ms + i * part_duration
            part_end = s_ms + (i + 1) * part_duration
            
            if i == len(parts) - 1:
                part_end = e_ms
            
            if part_end - part_start < MIN_DURATION:
                part_end = part_start + MIN_DURATION
            
            clean_text = part.strip()
            if clean_text:
                out_blocks.append({
                    'start': part_start,
                    'end': part_end,
                    'text': clean_text
                })
    
    if not out_blocks:
        return ""

    # Step 4: Zero-Start Rule
    # If the first block starts very early (e.g. < 0.5s), force it to 0.0s
    if out_blocks[0]['start'] < 500:
        out_blocks[0]['start'] = 0

    # Step 3: Global Gap Filling
    out_blocks = normalize_subtitle_gaps(out_blocks, target_gap_ms=50, max_bridge_gap_ms=1000)
    
    # Generate SRT
    result = []
    for i, block in enumerate(out_blocks):
        start_ms = block['start']
        end_ms = block['end']
        
        # Final sanity check
        if end_ms <= start_ms:
            end_ms = start_ms + 100
            
        start_str = _from_ms(start_ms)
        end_str = _from_ms(end_ms)
        result.append(f"{i+1}\n{start_str} --> {end_str}\n{block['text']}")
    
    return "\n\n".join(result) + "\n"

# ====================================================
# SECTION 2: Classes
# ====================================================

class LanguageManager:
    """Language Management Class"""
    
    def __init__(self):
        self.supported_languages = {
            "auto": "Auto Detect",
            "ko": "Korean",
            "en": "English", 
            "ja": "Japanese",
            "zh": "Chinese",
            "es": "Spanish",
            "fr": "French",
            "de": "German",
            "ru": "Russian"
        }
        self.default_language = "ko"
    
    def get_language_name(self, code):
        """Return name by language code"""
        return self.supported_languages.get(code, "Unknown")
    
    def get_language_codes(self):
        """Return list of supported language codes"""
        return list(self.supported_languages.keys())

# [MODERNIZED] Integrated with app.utils.transcriber
from app.utils.transcriber import WhisperTranscriber

class SubtitleEngine:
    """
    Main orchestration class for subtitle processing.
    Handles FFmpeg setup, model loading, and subtitle extraction/refinement.
    """
    
    def __init__(self, ffmpeg_path: str, model_path: str = None):
        """
        Initialize SubtitleEngine with dependency injection.
        """
        self.ffmpeg_path = ffmpeg_path
        self.model_path = model_path
        
        # Setup FFmpeg for Pydub
        self._setup_ffmpeg()
        
        # Initialize Managers
        self.language_manager = LanguageManager()
        # [NEW] Persistent Transcriber
        self.transcriber = None

    def _setup_ffmpeg(self):
        """Configure FFmpeg paths for Pydub and system PATH"""
        # [FIX] Handle both file path (from DependencyManager) and directory path
        if os.path.isfile(self.ffmpeg_path):
             ffmpeg_exe = self.ffmpeg_path
             ffprobe_exe = os.path.join(os.path.dirname(self.ffmpeg_path), "ffprobe.exe" if os.name == 'nt' else "ffprobe")
             ffmpeg_dir = os.path.dirname(self.ffmpeg_path)
             
        else:
            ffmpeg_exe = os.path.join(self.ffmpeg_path, "ffmpeg.exe")
            ffprobe_exe = os.path.join(self.ffmpeg_path, "ffprobe.exe")
            ffmpeg_dir = self.ffmpeg_path
        
        if os.path.exists(ffmpeg_exe):
            AudioSegment.converter = ffmpeg_exe
            AudioSegment.ffmpeg = ffmpeg_exe
            AudioSegment.ffprobe = ffprobe_exe
            
            # Add to PATH if not present
            if ffmpeg_dir not in os.environ.get('PATH', ''):
                os.environ['PATH'] = ffmpeg_dir + os.pathsep + os.environ.get('PATH', '')
        else:
            print(f"Warning: FFmpeg not found at {ffmpeg_exe}")

    def extract_subtitle(self, file_path: str, model_name: str = "base", language: str = "ko"):
        """
        Extract subtitles using the modernized WhisperTranscriber.
        """
        try:
            if not os.path.exists(file_path):
                return None, "File not found."
            
            # Initialize Transcriber if needed or model changed
            if not self.transcriber or self.transcriber.model_size != model_name:
                self.transcriber = WhisperTranscriber(
                    model_size=model_name,
                    device="cuda", # Auto-fallback to cpu is handled inside WhisperTranscriber
                    compute_type="auto",
                    model_path=self.model_path
                )
            
            # Transcribe
            result = self.transcriber.transcribe(
                video_path=file_path,
                language=language if language != "auto" else None
            )
            
            if not result or not result.get("srt_path"):
                return None, "Transcription returned no results"
                
            srt_path = result.get('srt_path')
            if not srt_path or not os.path.exists(srt_path):
                return None, "SRT file was not generated successfully."
                
            # Read the generated SRT content
            with open(srt_path, 'r', encoding='utf-8') as f:
                srt_content = f.read()
                
            return srt_content, None

        except Exception as e:
            return None, f"Modernized Extraction failed: {str(e)}"

    def extract_subtitle_json(self, file_path: str, model_name: str = "base", language: str = "ko"):
        """
        Extract subtitles and return as list of segments (JSON friendly).
        Used for Remotion (Word-level animation).
        """
        try:
            if not os.path.exists(file_path):
                return None, "File not found."
            
            model, error = self.model_manager.load_model(model_name)
            if error: return None, error
            
            transcribe_params = {
                'beam_size': 3,
                'vad_filter': True,
                'language': language if language != "auto" else None,
                'word_timestamps': True,
            }
            
            segments, info = model.transcribe(file_path, **transcribe_params)
            segments_list = list(segments)
            
            # Convert to serializable format
            json_output = []
            for seg in segments_list:
                words_data = []
                if hasattr(seg, 'words') and seg.words:
                    for w in seg.words:
                        words_data.append({
                            "word": w.word,
                            "start": w.start,
                            "end": w.end,
                            "probability": w.probability
                        })
                
                json_output.append({
                    "id": seg.id,
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text,
                    "words": words_data
                })
                
            return json_output, None
            
        except Exception as e:
            return None, f"Transcription JSON failed: {str(e)}"

    def align_and_refine(self, original_text: str, srt_text: str, limit: int = 10, use_marker_segmentation: bool = False, language: str = "ko"):
        """
        Align original text with SRT and refine the output.
        
        Args:
            original_text: The original script/transcript
            srt_text: The raw SRT content
            limit: Character limit for splitting
            
        Returns:
            tuple: (step1_aligned_srt, step2_refined_srt, error_message)
        """
        if not original_text or not srt_text:
            return None, None, "Original text and SRT are required."
        
        try:
            # Step 1: Align
            # If using markers, we must align with CLEAN text (no markers) to match Whisper output
            clean_text = original_text.replace("//", "") if use_marker_segmentation else original_text
            
            # However, we need to preserve the markers for Step 2.
            # align_sentences returns the matched text from original_text.
            # If we pass clean_text, we lose markers.
            # If we pass original_text with markers, alignment might be slightly off if markers are frequent,
            # but SequenceMatcher is fuzzy, so it might handle it.
            # BUT, the user requirement says: "Always create clean_text = original_script.replace('//', '') for the Forced Alignment step".
            # This implies we align using clean text, BUT we need to map back to the text with markers?
            # Wait, align_sentences returns "result_pairs" which contains the text from "sentences" input.
            # If we pass clean_text to align_sentences, the output step1 will contain clean text.
            # Then Step 2 receives clean text and cannot split by markers.
            
            # Solution: 
            # 1. Align using clean text to get timestamps.
            # 2. But we need the text with markers for Step 2.
            # 3. `align_sentences` is complex N:M matching.
            
            # Alternative: Pass original_text (with markers) to align_sentences. 
            # Since markers are just characters, they might lower similarity slightly, but usually ignored by normalization?
            # _norm function removes punctuation: re.sub(r"[^0-9A-Za-z가-힣]", "", s)
            # // will be removed by _norm! So alignment logic ALREADY ignores markers during comparison.
            # So we can safely pass original_text (with markers) to align_sentences.
            # The output step1 will contain the text WITH markers.
            
            step1 = align_sentences(original_text, srt_text)
            if not step1:
                return None, None, "Step 1 Failed: Could not match sentences."
            
            # Step 2: Refine
            step2 = refine_within_sentence_blocks(step1, int(limit), use_marker_segmentation, language)
            if not step2:
                return step1, None, "Step 2 Failed: Refinement failed."
            
            return step1, step2, None
        
        except Exception as e:
            import traceback
            return None, None, f"Error: {str(e)}\n{traceback.format_exc()}"

    def refine_only(self, srt_text: str, limit: int = 10, language: str = "ko"):
        """
        Refine SRT without original text alignment.
        
        Args:
            srt_text: The raw SRT content
            limit: Character limit for splitting
            
        Returns:
            tuple: (refined_srt, error_message)
        """
        try:
            blocks = parse_srt(srt_text)
            if not blocks:
                return None, "No valid SRT content found."
            
            result = refine_within_sentence_blocks(srt_text, limit, use_marker_segmentation=False, language=language)
            
            if not result:
                return None, "SRT processing failed: No result generated."
            
            return result, None
            
        except Exception as e:
            return None, f"SRT processing error: {str(e)}"

    def transcribe_raw(self, file_path: str, model_name: str = "base", language: str = "ko"):
        """Raw transcription returning segments using modernized transcriber"""
        if not self.transcriber or self.transcriber.model_size != model_name:
            self.transcriber = WhisperTranscriber(
                model_size=model_name,
                device="cuda",
                compute_type="auto",
                model_path=self.model_path
            )
        
        result = self.transcriber.transcribe(
            video_path=file_path,
            language=language if language != "auto" else None
        )
        return result.get("segments", [])

    def generate_precision_srt(self, audio_path: str, script: str, api_keys: list, language: str = "ko", model_name: str = None):
        """
        Generate high-precision SRT using AI for segmentation.
        """
        from .gemini_manager import GeminiManager
        
        # Determine model
        target_model = model_name or "gemini-2.0-flash-exp" # Fallback if absolutely nothing provided
        
        # 1. Raw Transcription (Whisper)
        segments = self.transcribe_raw(audio_path, language=language)
        
        # 2. Macro Alignment (Script <-> Segments)
        # Convert segments to dict format for align_sentences
        whisper_srt_blocks = []
        for s in segments:
            whisper_srt_blocks.append({
                "start": _format_time(s.start),
                "end": _format_time(s.end),
                "text": s.text.strip()
            })
        
        # Create a temporary SRT string for the existing aligner
        temp_srt = ""
        for i, b in enumerate(whisper_srt_blocks):
            temp_srt += f"{i+1}\n{b['start']} --> {b['end']}\n{b['text']}\n\n"
            
        # Use existing alignment logic
        aligned_srt = align_sentences(script, temp_srt)
        aligned_blocks = parse_srt(aligned_srt)
        
        # 3. AI Segmentation (Gemini)
        gemini = GeminiManager(api_keys)
        final_blocks = []
        
        for block in aligned_blocks:
            text = block['text']
            start_ms = _to_ms(block['start'])
            end_ms = _to_ms(block['end'])
            
            # Skip short/empty blocks
            if not text.strip() or (end_ms - start_ms) < 100:
                continue

            # Prompt for Gemini
            prompt = (
                f"Split the following text into natural subtitles for a 9:16 vertical video.\n"
                f"Insert '//' where a line break should occur.\n"
                f"Rules:\n"
                f"1. Keep the text EXACTLY as is. Do not change words.\n"
                f"2. Each part should be short (10-20 chars) for readability.\n"
                f"3. Break at natural pauses or grammatical boundaries.\n"
                f"Text: {text}\n"
                f"Output:"
            )
            
            try:
                # Use GeminiManager.generate_content with a fast model
                segmented_text = gemini.generate_content(prompt, model_name=target_model)
                # Fallback if Gemini fails or returns garbage
                if not segmented_text or len(segmented_text) < len(text) * 0.5:
                    segmented_text = text
            except Exception as e:
                print(f"Gemini Error: {e}")
                segmented_text = text
            
            # 4. Time Interpolation
            parts = [p.strip() for p in segmented_text.split('//') if p.strip()]
            if not parts:
                parts = [text]
                
            total_duration = end_ms - start_ms
            total_chars = sum(len(p) for p in parts)
            current_time = start_ms
            
            for i, part in enumerate(parts):
                if total_chars > 0:
                    part_duration = (len(part) / total_chars) * total_duration
                else:
                    part_duration = total_duration / len(parts)
                
                # Minimum duration constraint
                part_duration = max(part_duration, 500) 
                
                part_end = min(current_time + part_duration, end_ms)
                if i == len(parts) - 1:
                    part_end = end_ms
                
                final_blocks.append({
                    "start": current_time,
                    "end": part_end,
                    "text": part
                })
                current_time = part_end
                
        # 5. Generate Final SRT
        result = []
        for i, b in enumerate(final_blocks):
            start_str = _from_ms(int(b['start']))
            end_str = _from_ms(int(b['end']))
            result.append(f"{i+1}\n{start_str} --> {end_str}\n{b['text']}")
            
        return "\n\n".join(result)
