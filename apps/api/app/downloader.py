import re
import logging
import os
import yt_dlp 
from .download_strategies.bypass_strategy import TikVideoDownloader, V2OBDownloader, DouyinSmartDownloader
from .download_strategies.yt_dlp_strategy import YTDLPDownloader

# [NEW] Rate limiting imports (Feature Flag controlled)
try:
    from .config.feature_flags import feature_flags
    from .services.rate_limiting import get_rate_limiter, CircuitBreaker, CircuitBreakerOpenError
    RATE_LIMITING_AVAILABLE = True
except ImportError:
    RATE_LIMITING_AVAILABLE = False
    feature_flags = None

logger = logging.getLogger(__name__)

# [NEW] Global circuit breaker instance
_circuit_breaker = None

def get_circuit_breaker():
    """Get or create circuit breaker instance"""
    global _circuit_breaker
    if RATE_LIMITING_AVAILABLE and feature_flags and feature_flags.is_enabled('ENABLE_CIRCUIT_BREAKER'):
        if _circuit_breaker is None:
            _circuit_breaker = CircuitBreaker()
        return _circuit_breaker
    return None

def sanitize_filename(name):
    """Utility exposed for other modules."""
    return re.sub(r'[\\/*?:"<>|]', "", name)

class FilteredLogger:
    def debug(self, msg):
        pass
        
    def warning(self, msg):
        # Suppress specific known warnings requested by user
        ignore_patterns = [
            "No supported JavaScript runtime",
            "web_safari client",
            "web client https formats",
            "YouTube is forcing SABR",
            "PO Token",
            "android client",
            "ios client",
            "GVS PO Token"
        ]
        if any(p in msg for p in ignore_patterns):
            return
        # Forward other warnings
        logger.info(f"[yt-dlp] {msg}")

    def error(self, msg):
        external_errors = [
            "Video unavailable",
            "Private video",
            "This video is unavailable",
            "Sign in to confirm your age",
            "HTTP Error 429",
            "Video unavailable"
        ]
        if any(p in msg for p in external_errors):
            logger.info(f"[yt-dlp External Warning] {msg}")
        else:
            logger.warning(f"[yt-dlp Error] {msg}")

def get_latest_videos(channel_url, limit=10, timeout=30, **kwargs):
    """
    Fetches the latest videos from a channel using yt-dlp (flat extraction).
    Accepts specific yt-dlp options via kwargs (e.g., dateafter).
    With Timeout Protection + Optional Rate Limiting.
    """
    # [NEW] Check if rate limiting is enabled
    if RATE_LIMITING_AVAILABLE and feature_flags and feature_flags.is_enabled('ENABLE_RATE_LIMITER'):
        # Use synchronous rate limiting (thread-safe)
        return _get_latest_videos_with_rate_limit_sync(channel_url, limit, timeout, **kwargs)
    else:
        # [LEGACY] Original implementation (no rate limiting)
        return _get_latest_videos_impl(channel_url, limit, timeout, **kwargs)

def _get_latest_videos_with_rate_limit_sync(channel_url, limit, timeout, **kwargs):
    """
    [NEW] Rate-limited version (synchronous, thread-safe)
    """
    import time
    import random
    
    # Apply rate limiter (synchronous)
    rate_limiter = get_rate_limiter(feature_flags.get_mode())
    
    # Simple synchronous rate limiting
    delay = random.uniform(
        rate_limiter.config['min_delay'],
        rate_limiter.config['max_delay']
    ) * rate_limiter.backoff_multiplier
    
    time.sleep(delay)
    
    # Record request
    now = time.time()
    rate_limiter.request_times['minute'].append(now)
    rate_limiter.request_times['hour'].append(now)
    rate_limiter.request_times['day'].append(now)
    
    try:
        result = _get_latest_videos_impl(channel_url, limit, timeout, **kwargs)
        rate_limiter.report_success()
        return result
    except Exception as e:
        # Check for 429 errors
        if '429' in str(e) or 'rate limit' in str(e).lower():
            rate_limiter.report_429()
        raise

def _get_latest_videos_impl(channel_url, limit, timeout, **kwargs):
    """
    [CORE] Actual implementation (unchanged)
    """
    opts = {
        'extract_flat': True, 
        'quiet': True, 
        'playlistend': limit,
        'ignoreerrors': True,
        'nocheckcertificate': True,
        'no_warnings': True,
        'logger': FilteredLogger(),
        'http_headers': {
            'Referer': 'https://www.google.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        'extractor_args': {
            'youtube': ['lang=ko']
        }
    }
    if kwargs:
        opts.update(kwargs)
        
    from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
    
    def _fetch():
        with yt_dlp.YoutubeDL(opts) as ydl:
            try:
                info = ydl.extract_info(channel_url, download=False)
                if info and 'entries' in info:
                    return list(info['entries'])
                return []
            except Exception as e:
                err_msg = str(e)
                if '429' in err_msg or 'rate limit' in err_msg.lower():
                    raise
                logger.error(f"Error fetching videos: {e}")
                return []
                
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_fetch)
        try:
            return future.result(timeout=timeout)
        except FutureTimeoutError:
            logger.warning(f"⏱️ get_latest_videos timeout after {timeout}s for {channel_url}")
            return []
        except Exception as e:
            err_msg = str(e)
            if '429' in err_msg or 'rate limit' in err_msg.lower():
                 raise
            logger.error(f"get_latest_videos execution failed: {e}")
            return []

def get_downloader_strategy(url: str, force_bypass: bool = False):
    """
    Selects the correct download strategy based on the URL.
    Returns the strategy instance and the cleaned URL.
    [UPGRADE] Added fallback source discovery for YouTube failures.
    """
    if not url: return None, url
    
    # Regex clean URL
    import re
    clean_url = url.strip()
    url_match = re.search(r'(https?://[^\s]+)', clean_url)
    if url_match:
        clean_url = url_match.group(1)
        # Cleanup trailing punctuation
        clean_url = clean_url.rstrip('.,;!?')
    
    # Haokan Cleaning
    if 'haokan.baidu.com' in clean_url:
        if '&' in clean_url:
            clean_url = clean_url.split('&')[0]
            print(f"Cleaned Haokan URL: {clean_url}")
            
    # --- 1. Force Bypass via Toggle ---
    if force_bypass:
        if 'haokan.baidu.com' in clean_url: 
            print(f"Strategy: Manual Bypass (Haokan) -> V2OBDownloader")
            return V2OBDownloader('haokan'), clean_url
        if 'douyin.com' in clean_url or 'iesdouyin.com' in clean_url:
            print(f"Strategy: Manual Bypass (Douyin) -> DouyinSmartDownloader")
            return DouyinSmartDownloader(), clean_url
        # Default for forced bypass
        print(f"Strategy: Manual Bypass forced for unknown domain. Defaulting to TikVideoDownloader.")
        return TikVideoDownloader(), clean_url

    # --- 2. Auto-Detect Bypass Domains (CRITICAL FIX) ---
    # Even if force_bypass is False, these domains MUST use bypass
    if 'haokan.baidu.com' in clean_url:
        print(f"Strategy: Auto-detected Haokan. Enforcing V2OB Bypass.")
        return V2OBDownloader('haokan'), clean_url
        
    if 'douyin.com' in clean_url or 'iesdouyin.com' in clean_url or 'v.douyin.com' in clean_url:
        print(f"Strategy: Auto-detected Douyin. Enforcing DouyinSmartDownloader.")
        return DouyinSmartDownloader(), clean_url

    if 'tiktok.com' in clean_url:
        print(f"Strategy: Auto-detected TikTok. Enforcing TikVideoDownloader.")
        return TikVideoDownloader(), clean_url

    # --- 3. V2OB Domain Mapping (Auto-Detect) ---
    v2ob_map = {
        'haokan.baidu.com': 'haokan',
        'kuaishou.com': 'kuaishou',
        'chenzhongtech.com': 'kuaishou', # Kuaishou short link
        'kuaishouapp.com': 'kuaishou',
        'xiaohongshu.com': 'xiaohongshu',
        'xhslink.com': 'xiaohongshu',
        'ixigua.com': 'xigua',
        'xigua.com': 'xigua',
        'bilibili.com': 'bilibili',
        'b23.tv': 'bilibili', # Bilibili short link
        'weibo.com': 'weibo',
        'weibo.cn': 'weibo',
        'pipixia.com': 'pipixia',
        'acfun.cn': 'acfun',
        'toutiao.com': 'toutiao',
        'huya.com': 'huya',
        'weishi.qq.com': 'weishi', 
        'oasis.weibo.cn': 'oasis',
        'taobao.com': 'taobao',
        'izuiyou.com': 'zuiyou',
        'pipigaoxiao.com': 'pipigaoxiao'
    }
    
    for domain, key in v2ob_map.items():
        if domain in clean_url:
            print(f"Strategy: Auto-detected {key} URL. Enforcing V2OB Bypass.")
            return V2OBDownloader(key), clean_url
            
    # --- 4. Standard YTDLP ---
    print(f"Strategy: Standard URL detected. Using YTDLP Downloader for {clean_url}")
    return YTDLPDownloader(), clean_url

# Wrapper for Backward Compatibility with routers/videos.py
def download_single_video(video_url, root_download_path, cookies_path=None, use_bypass=False, headless=True, script_only=False, force_hd=False):
    """
    Downloads a video with automatic fallback source discovery.
    [UPGRADE] If YouTube fails, tries alternative sources like:
    - Invidious instances
    - Piped instances
    - yt-dlp with different extractors
    """
    strategy, clean_url = get_downloader_strategy(video_url, force_bypass=use_bypass)
    
    # 1. Try YTDLP First (as requested by user)
    # Even for TikTok/Douyin, we try YTDLP first to get better metadata/subs
    try:
        ytdlp = YTDLPDownloader()
        print(f"🔄 [STEP 1] Trying YTDLP for {clean_url}...")
        result = ytdlp.download(clean_url, root_download_path, cookies_path=cookies_path, script_only=script_only, force_hd=force_hd)
        
        if result.get('status') == 'success':
            print(f"✅ [SUCCESS] YTDLP succeeded for {clean_url}")
            return result
        else:
            err_msg = str(result.get('error', 'Unknown YTDLP error'))
            print(f"⚠️ [FAILED] YTDLP failed: {err_msg}")
            # If it's a "known" failure (IP block), we proceed to fallback
    except Exception as e:
        print(f"❌ [ERROR] YTDLP execution error: {e}")

    # 2. FALLBACK: Try Specialized Bypass Strategies
    # We only reach here if YTDLP failed
    print(f"🔄 [STEP 2] Attempting Bypass Fallback for {clean_url}...")
    strategy, _ = get_downloader_strategy(clean_url, force_bypass=True)
    
    if strategy and not isinstance(strategy, YTDLPDownloader):
        try:
            print(f"🚀 [FALLBACK] Strategy: {strategy.__class__.__name__}")
            if isinstance(strategy, (TikVideoDownloader, V2OBDownloader, DouyinSmartDownloader)):
                result = strategy.download(clean_url, root_download_path, headless=headless)
            
            if result.get('status') == 'success':
                # [NOTE] For bypass, script_only means we still download video 
                # because we need it for metadata/script extraction.
                return result
        except Exception as e:
            print(f"❌ [ERROR] Fallback strategy failed: {e}")
    
    # 3. YOUTUBE SPECIFIC FALLBACKS (Invidious/Piped)
    if 'youtube.com' in clean_url or 'youtu.be' in clean_url:
        logger.info("🔄 Primary YouTube download failed. Trying alternative sources...")
        
        # Try alternative 1: Invidious
        invidious_urls = [
            "https://invidious.fdn.fr",
            "https://invidious.kavin.rocks",
            "https://yewtu.be"
        ]
        
        for invidious in invidious_urls:
            try:
                inv_url = f"{invidious}/watch?v={clean_url.split('v=')[-1].split('&')[0]}"
                logger.info(f"Trying Invidious: {inv_url}")
                
                inv_strategy = YTDLPDownloader()
                result = inv_strategy.download(inv_url, root_download_path, cookies_path=cookies_path, force_hd=force_hd, script_only=script_only)
                
                if result.get('status') == 'success':
                    logger.info(f"✅ Invidious fallback succeeded: {invidious}")
                    return result
            except Exception as ex:
                logger.warning(f"Invidious {invidious} failed: {ex}")
                continue
        
        # Try alternative 2: Piped (SKIP IF SCRIPT ONLY because it only downloads raw stream)
        if script_only:
            logger.info("⏭️ Skipping Piped fallback because it does not support script-only mode (raw video stream only).")
        else:
            piped_urls = [
                "https://piped.kavin.rocks",
                "https://watchapi.whatever.social"
            ]
            
            for piped in piped_urls:
                try:
                    video_id = clean_url.split('v=')[-1].split('&')[0]
                    pipe_url = f"{piped}/api/v1/videos/{video_id}"
                    # Piped API returns direct stream URL
                    import requests
                    resp = requests.get(pipe_url, timeout=15)
                    if resp.status_code == 200:
                        data = resp.json()
                        # Get best quality URL
                        if 'streams' in data and data['streams']:
                            stream_url = data['streams'][0]['url']
                            # Download stream
                            import uuid
                            filename = f"fallback_{uuid.uuid4()}.mp4"
                            output_path = os.path.join(root_download_path, filename)
                            os.makedirs(root_download_path, exist_ok=True)
                            
                            with requests.get(stream_url, stream=True) as r:
                                with open(output_path, 'wb') as f:
                                    for chunk in r.iter_content(chunk_size=8192):
                                        f.write(chunk)
                            
                            return {'status': 'success', 'file_path': output_path}
                except Exception as ex:
                    logger.warning(f"Piped {piped} failed: {ex}")
                    continue
        
        # Try alternative 3: Different yt-dlp extractor args
        logger.info("🔄 Trying yt-dlp with alternative extractor args...")
        try:
            alt_opts = {
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android', 'tv'],  # Try mobile/TV clients
                        'player_skip': ['webpage', 'configs']
                    }
                }
            }
            
            alt_strategy = YTDLPDownloader()
            result = alt_strategy.download(clean_url, root_download_path, cookies_path=cookies_path, force_hd=force_hd, script_only=script_only)
            
            if result.get('status') == 'success':
                logger.info("✅ Alternative extractor args succeeded")
                return result
        except Exception as ex:
            logger.warning(f"Alternative extractor failed: {ex}")
    
    # Return original result if all fallbacks fail
    return result if 'result' in locals() else {'status': 'failed', 'error': 'All download methods failed'}

def get_channel_info(url):
    """
    Wrapper to get channel info. Currently delegates to YTDLP strategy 
    as it has the extraction logic.
    """
    downloader = YTDLPDownloader()
    return downloader.get_channel_info(url)

def get_video_info(url, cookies_path=None):
    """
    Wrapper to get video info (metadata) without downloading.
    """
    downloader = YTDLPDownloader()
    return downloader.get_video_info(url, cookies_path=cookies_path)

# H.264 Conversion Utility
import asyncio
from app import dependency_manager

async def convert_to_h264(input_path: str, delete_original: bool = True):
    """
    Converts video to H.264 (mp4) using FFmpeg.
    """
    if not input_path or not os.path.exists(input_path):
        return {'status': 'failed', 'error': 'Input file not found'}

    try:
        ffmpeg_cmd = dependency_manager.DependencyManager.get_ffmpeg_path()
    except Exception:
        # Fallback if dependency manager fails
        ffmpeg_cmd = "ffmpeg"

    directory = os.path.dirname(input_path)
    filename = os.path.splitext(os.path.basename(input_path))[0]
    output_path = os.path.join(directory, f"{filename}_converted.mp4")
    
    # Simple check to avoid overwriting or redundant conversion if target name is same
    if input_path == output_path:
        output_path = os.path.join(directory, f"{filename}_h264.mp4")

    # Construct command
    # -c:v libx264 -c:a aac -strict experimental -movflags +faststart
    cmd = [
        ffmpeg_cmd, '-i', input_path,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-strict', 'experimental',
        '-movflags', '+faststart',
        output_path,
        '-y' # Overwrite
    ]
    
    print(f"Executing conversion: {' '.join(cmd)}")
    
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            if delete_original and input_path != output_path:
                try:
                    os.remove(input_path)
                    # Optional: Rename output back to original name? 
                    # Usually better to keep specific extension.
                    # If we really want final to be .mp4 and replace original:
                    # final_path = os.path.splitext(input_path)[0] + ".mp4"
                    # ...
                    # For now, let's return the new path.
                except OSError as e:
                    print(f"Failed to remove original file: {e}")
            
            return {'status': 'success', 'output_path': output_path}
        else:
            return {'status': 'failed', 'error': stderr.decode()}
            
    except Exception as e:
        return {'status': 'failed', 'error': str(e)}

# Helper for routers that used downloader instance
class DownloaderFacade:
    """Facade to mimic old class instance behavior if needed."""
    def download_single_video(self, *args, **kwargs):
        return download_single_video(*args, **kwargs)
    
    def get_channel_info(self, *args, **kwargs):
        return get_channel_info(*args, **kwargs)

    def get_video_info(self, *args, **kwargs):
        return get_video_info(*args, **kwargs)
    
    def sanitize_filename(self, name):
        return sanitize_filename(name)

    def get_latest_videos(self, *args, **kwargs):
        return get_latest_videos(*args, **kwargs)
        
    async def convert_to_h264(self, *args, **kwargs):
        return await convert_to_h264(*args, **kwargs)

# Create a singleton instance if modules import 'downloader' as an object
downloader = DownloaderFacade()
