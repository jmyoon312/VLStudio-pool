import sys
from duckduckgo_search import DDGS
import json

def test_ddg(keyword):
    print(f"Testing DDGS for: {keyword}")
    results = []
    try:
        with DDGS() as ddgs:
            # Search site:douyin.com/video/ <keyword>
            for r in ddgs.text(f'site:douyin.com/video/ "{keyword}"', max_results=20):
                results.append(r)
        
        print(f"Found {len(results)} results:")
        for r in results:
            print(r['title'])
            print(r['href'])
            print("---")
            
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_ddg("母爱感人")
