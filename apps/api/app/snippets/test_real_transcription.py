import os
import sys
import time

# Add backend to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

from app.utils.transcriber import WhisperTranscriber

def test_actual_transcription():
    print("[SEARCH] Testing actual Whisper transcription...")
    
    # Correct path found via find
    project_root = "/app"
    video_path = os.path.join(project_root, "backend/downloads/douyin_1776273129.mp4")
    
    if not os.path.exists(video_path):
         print(f"[FAIL] Video not found at {video_path}")
         return

    print(f"📁 Video found: {video_path}")
    
    try:
        # Load tiny model
        print("[FALLBACK] Loading model...")
        transcriber = WhisperTranscriber(model_size="small", device="cuda")
        
        print("[FALLBACK] Starting transcription...")
        start = time.time()
        result = transcriber.transcribe(video_path)
        end = time.time()
        
        if result['status'] == 'success':
            print(f"[OK] Success! Transcription took {end-start:.2f}s")
            print(f"   Language: {result['language']}")
            print(f"   SRT Path: {result['srt_path']}")
            
            if os.path.exists(result['srt_path']):
                print(f"   [OK] SRT file verified on disk: {result['srt_path']}")
                # Print first few lines
                with open(result['srt_path'], 'r') as f:
                    print("   --- Content Snippet ---")
                    for _ in range(5):
                        print(f"   {f.readline().strip()}")
            else:
                print("   [FAIL] SRT file NOT found on disk!")
        else:
            print(f"[FAIL] Transcription failed: {result['message']}")
            
    except Exception as e:
        print(f"[FAIL] Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_actual_transcription()
