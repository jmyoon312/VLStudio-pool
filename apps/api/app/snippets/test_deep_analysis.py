import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.intelligence.video_analyzer import VideoAnalyzer
from app.llm_manager import LLMClient
from app.config import settings

async def main():
    print("🚀 [Test] Starting Deep Analysis Test...")
    
    # Check for a sample video in agent temp
    sample_video = "/app/downloads/_agent_temp/beach_clip.mp4"
    
    if not os.path.exists(sample_video):
        # Fallback to any mp4 in downloads
        import glob
        files = glob.glob("/app/backend/downloads/**/*.mp4", recursive=True)
        if files:
            sample_video = files[0]
        else:
            print("❌ No mp4 files found for testing. Please download one first.")
            return

    print(f"📂 Analyzing: {sample_video}")
    
    llm = LLMClient(settings)
    analyzer = VideoAnalyzer(llm)
    
    try:
        report = await analyzer.deep_analyze(sample_video)
        print("\n✅ [Result] Analysis Completed Successfully!")
        print("-" * 50)
        print(f"Dimensions: {report.get('dimensions')}")
        print(f"Pacing Score: {report.get('pacing_score')}")
        print(f"Source Type: {report.get('source_type')}")
        
        if "ai_analysis" in report:
            print("\n🤖 [AI Insights]:")
            import json
            print(json.dumps(report["ai_analysis"], indent=2, ensure_ascii=False))
        else:
            print("\n⚠️ AI Stage was skipped or failed.")
            
    except Exception as e:
        print(f"❌ Analysis Failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
