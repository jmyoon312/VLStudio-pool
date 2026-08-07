import re
import urllib.parse
import json

def analyze():
    with open("douyin_dump.html", "r", encoding="utf-8") as f:
        html = f.read()
        
    print("HTML length:", len(html))
    
    match = re.search(r'<script id="RENDER_DATA" type="application/json">(.+?)</script>', html)
    if match:
        print("Found RENDER_DATA block!")
        raw = urllib.parse.unquote(match.group(1))
        
        # Save decoded json for inspection
        with open("douyin_render_data.json", "w", encoding="utf-8") as jf:
            jf.write(raw)
            
        data = json.loads(raw)
        
        # Try to find aweme_info
        awemes = []
        def search_dict(d):
            if isinstance(d, dict):
                if 'aweme_info' in d:
                    awemes.append(d)
                for k, v in d.items():
                    search_dict(v)
            elif isinstance(d, list):
                for v in d:
                    search_dict(v)
                    
        search_dict(data)
        print(f"Found {len(awemes)} aweme_info objects inside RENDER_DATA.")
    else:
        print("No RENDER_DATA found.")

if __name__ == "__main__":
    analyze()
