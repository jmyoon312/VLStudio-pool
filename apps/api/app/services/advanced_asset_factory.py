import os
import requests
import urllib.request

class AdvancedAssetFactory:
    """
    `Visual_Master` 에이전트의 손발이 되어, 유료 AI 생성(Midjourney)을 최소화하고 
    저작권 없는 무료 고화질 스톡 영상(Pexels, Pixabay)들을 자동으로 긁어오는 백엔드 코어 스크래퍼 기능.
    """
    def __init__(self, api_key=None):
        # 환경변수 또는 DB에서 PEXELS_API_KEY 로드
        self.api_key = api_key or os.getenv("PEXELS_API_KEY", "DEMO_KEY")
        self.headers = {"Authorization": self.api_key}
        self.base_url = "https://api.pexels.com/videos/search"

    def fetch_free_b_roll(self, query, orientation="portrait", save_dir="_video/videos", filename_prefix="scene"):
        """
        주어진 쿼리명으로 쇼츠/릴스용 가로/세로 영상을 검색 후 다운로드
        """
        os.makedirs(save_dir, exist_ok=True)
        print(f"[Asset Factory] Pexels API Query: {query} (Orientation: {orientation})")
        
        params = {
            "query": query,
            "orientation": orientation,
            "per_page": 1  # 일단 첫 번째 결과를 가져옴
        }
        
        try:
            res = requests.get(self.base_url, headers=self.headers, params=params)
            res.raise_for_status()
            data = res.json()
            
            if data.get("videos"):
                # 최상급 화질 추출
                video_files = data["videos"][0]["video_files"]
                best_video = sorted(video_files, key=lambda x: x['width'], reverse=True)[0]
                video_url = best_video["link"]
                
                output_path = os.path.join(save_dir, f"{filename_prefix}.mp4")
                print(f"[Asset Factory] Downloading to {output_path}...")
                urllib.request.urlretrieve(video_url, output_path)
                return output_path
                
        except Exception as e:
            print(f"[Asset Factory] Failed to fetch B-Roll for '{query}': {e}")
            
        return None
