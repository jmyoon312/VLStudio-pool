import asyncio
import sys
from pathlib import Path

# Add the app directory to sys.path so we can import from it
sys.path.append(str(Path(__file__).parent))

from app.routers.douyin_shorts_router import _search_douyin_via_cloakbrowser_sync, _download_one_sync
import traceback

def run_test():
    print("Testing Douyin Search via CloakBrowser...")
    try:
        results = _search_douyin_via_cloakbrowser_sync(
            keyword="母爱感人",
            count=2,
            min_dur=10,
            max_dur=600,
            date_after="20250101"
        )
        print(f"Found {len(results)} results.")
        for r in results:
            print(r)
            
        if results:
            print("\nTesting Download for the first result...")
            url = results[0]['url']
            folder = str(Path("C:/ViraLoopMedia/DouyinShorts/downloads/test_dir"))
            Path(folder).mkdir(parents=True, exist_ok=True)
            dl_res = _download_one_sync(url, folder, 0)
            print("Download Result:", dl_res)
        else:
            print("No results found, skipping download test.")
            
    except Exception as e:
        print("Error during test:")
        traceback.print_exc()

if __name__ == "__main__":
    run_test()
