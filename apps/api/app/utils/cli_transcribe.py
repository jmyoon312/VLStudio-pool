import sys
import os
import json
import argparse

# Ensure Backend is in PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.utils.transcriber import WhisperTranscriber

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video_path", required=True)
    parser.add_argument("--model_size", default="base")
    parser.add_argument("--model_path", default=None)
    parser.add_argument("--device", default="cuda")
    args = parser.parse_args()

    try:
        transcriber = WhisperTranscriber(
            model_size=args.model_size, 
            device=args.device,
            model_path=args.model_path if args.model_path and args.model_path != "None" else None
        )
        result = transcriber.transcribe(args.video_path)
        
        # We output a JSON block so the parent process can neatly parse the result
        print(f"---TRANSCRIPTION_JSON_START---")
        print(json.dumps(result))
        print(f"---TRANSCRIPTION_JSON_END---")
        sys.exit(0 if result.get("status") == "success" else 1)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"---TRANSCRIPTION_JSON_START---")
        print(json.dumps({"status": "error", "message": str(e)}))
        print(f"---TRANSCRIPTION_JSON_END---")
        sys.exit(1)

if __name__ == "__main__":
    main()
