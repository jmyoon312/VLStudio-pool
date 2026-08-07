import os
import json
import yt_dlp
from datetime import datetime
import re
import logging
from app import dependency_manager

logger = logging.getLogger(__name__)

# [NEW] Rate limiting imports (Feature Flag controlled)
try:
    from app.config.feature_flags import feature_flags
    from app.services.rate_limiting import get_rate_limiter, CircuitBreaker, CircuitBreakerOpenError
    RATE_LIMITING_AVAILABLE = True
except ImportError:
    RATE_LIMITING_AVAILABLE = False
    feature_flags = None

class StrategyFilteredLogger:
    def debug(self, msg): pass
    def warning(self, msg):
        # Suppress warnings including PO Token warnings
        ignore_patterns = [
            "No supported JavaScript runtime", 
            "web_safari client", 
            "web client https formats", 
            "YouTube is forcing SABR",
            "PO Token",  # Suppress all PO Token warnings
            "android client",  # Suppress android client warnings
            "ios client",  # Suppress ios client warnings
            "GVS PO Token",  # Explicit GVS PO Token suppression
            "require a GVS"  # Catch "require a GVS PO Token" messages
        ]
        if any(p in msg for p in ignore_patterns): return
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

class YTDLPDownloader:
    """Handles downloading via yt-dlp with Smart Subtitle Selection."""

    def _get_opts(self, url, additional_opts=None, force_hd=False, cookies_path=None):
        """
        Build yt-dlp options with conditional client selection and optimized headers.
        """
        opts = {
            'quiet': True,
            'no_warnings': True,
            'cookiefile': cookies_path if cookies_path and os.path.exists(cookies_path) else None,
            'http_headers': {
                'Referer': 'https://www.google.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            'nocheckcertificate': True,
            'ignoreerrors': True,
            'logger': StrategyFilteredLogger()
        }
        
        if additional_opts:
            # Merge headers if provided
            if 'http_headers' in additional_opts:
                opts['http_headers'].update(additional_opts.pop('http_headers'))
            opts.update(additional_opts)
        
        if 'extractor_args' not in opts:
            opts['extractor_args'] = {}
            
        # [OPTIMIZATION] Platform-specific extractor args
        if 'instagram.com' in url:
            # Use mobile client for Instagram to bypass some blocks
            opts['extractor_args']['instagram'] = {'client': 'android'}
        elif 'youtube.com' in url or 'youtu.be' in url:
            # YouTube smart defaults - force language to Korean
            opts['extractor_args']['youtube'] = ['lang=ko']
            
        # [FIX] Enable Node.js for n-challenge solving if available
        import shutil
        node_path = shutil.which('node')
        if node_path:
            opts['exec_cmd'] = {'node': node_path}
        
        return opts

    def _resolve_url(self, url):
        """Clean and validate URL"""
        if not url: return url
        url_match = re.search(r'(https?://[^\s]+)', url)
        if url_match:
            url = url_match.group(1).rstrip('.,;!?')
        return url

    def get_channel_info(self, url, cookies_path=None, timeout=40):
        """
        Get channel info with optional rate limiting
        """
        # [NEW] Check if rate limiting is enabled
        if RATE_LIMITING_AVAILABLE and feature_flags and feature_flags.is_enabled('ENABLE_RATE_LIMITER'):
            # Use synchronous rate limiting
            return self._get_channel_info_with_rate_limit_sync(url, cookies_path, timeout)
        else:
            # [LEGACY] Original implementation
            return self._get_channel_info_impl(url, cookies_path, timeout)
    
    def _get_channel_info_with_rate_limit_sync(self, url, cookies_path, timeout):
        """
        [NEW] Rate-limited version (synchronous)
        """
        import time
        import random
        
        rate_limiter = get_rate_limiter(feature_flags.get_mode())
        
        # Synchronous rate limiting
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
            result = self._get_channel_info_impl(url, cookies_path, timeout)
            rate_limiter.report_success()
            return result
        except Exception as e:
            if '429' in str(e) or 'rate limit' in str(e).lower():
                rate_limiter.report_429()
            raise
    
    def _get_channel_info_impl(self, url, cookies_path, timeout):
        """
        [CORE] Actual implementation (unchanged)
        """
        from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
        
        url = self._resolve_url(url)
        ydl_opts = self._get_opts(url, {'quiet': True, 'extract_flat': True, 'force_generic_extractor': False, 'playlistend': 1})
        
        ydl_opts.update({
            'nocheckcertificate': True, 
            'ignoreerrors': True,
            'no_warnings': True,
            'logger': StrategyFilteredLogger()
        })

        # [FIX] Don't pass cookies to android client (causes warnings)
        if cookies_path and os.path.exists(cookies_path): ydl_opts['cookiefile'] = cookies_path
        
        def _extract():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                try:
                    info = ydl.extract_info(url, download=False)
                    if not info: return None
                    
                    name = info.get('uploader') or info.get('channel') or info.get('title') or "Unknown"
                    
                    thumbnail = None
                    
                    if info.get('thumbnails'):
                        avatars = [
                            t for t in info['thumbnails'] 
                            if t.get('width') and t.get('height') and 
                            abs(t['width'] - t['height']) < 50
                        ]
                        if avatars:
                            avatars.sort(key=lambda x: x.get('width', 0), reverse=True)
                            thumbnail = avatars[0].get('url')
                    
                    if not thumbnail:
                        thumbnail = info.get('thumbnail')
                    
                    # [FIX] For YouTube, 'id' might be the handle (e.g. @KLAB). 
                    # We need the UC... ID for RSS and other API calls.
                    p_id = info.get('id')
                    if 'youtube' in info.get('extractor_key', '').lower():
                        p_id = info.get('channel_id') or info.get('id')
                        
                    return {
                        'platform': info.get('extractor_key'), 
                        'name': name, 
                        'id': p_id, 
                        'thumbnail': thumbnail,
                        'uploader': name,
                        'subscriber_count': info.get('channel_follower_count') or info.get('uploader_sub_count')
                    }
                except Exception as e:
                    print(f"YTDLP get_channel_info failed: {e}")
                    return None

        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_extract)
            try:
                return future.result(timeout=timeout)
            except FutureTimeoutError:
                print(f"[TIME] get_channel_info timeout after {timeout}s for {url}")
                return None
            except Exception as e:
                print(f"YTDLP get_channel_info error: {e}")
                return None
    
    
    def get_video_info(self, url, timeout=10, cookies_path=None):
        """
        Get video info with optional rate limiting
        """
        # [NEW] Check if rate limiting is enabled
        if RATE_LIMITING_AVAILABLE and feature_flags and feature_flags.is_enabled('ENABLE_RATE_LIMITER'):
            # Use synchronous rate limiting
            return self._get_video_info_with_rate_limit_sync(url, timeout, cookies_path)
        else:
            # [LEGACY] Original implementation
            return self._get_video_info_impl(url, timeout, cookies_path)
    
    def _get_video_info_with_rate_limit_sync(self, url, timeout, cookies_path=None):
        """
        [NEW] Rate-limited version (synchronous)
        """
        import time
        import random
        
        rate_limiter = get_rate_limiter(feature_flags.get_mode())
        
        # Synchronous rate limiting
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
            result = self._get_video_info_impl(url, timeout, cookies_path)
            rate_limiter.report_success()
            return result
        except Exception as e:
            if '429' in str(e) or 'rate limit' in str(e).lower():
                rate_limiter.report_429()
            raise
    
    def _get_video_info_impl(self, url, timeout, cookies_path=None):
        """
        [CORE] Actual implementation with cookie support
        """
        from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
        
        url = self._resolve_url(url)
        ydl_opts = self._get_opts(url, {'quiet': True, 'logger': StrategyFilteredLogger()})
        ydl_opts.update({
            'nocheckcertificate': True,
            'ignoreerrors': True,  # Skip videos with errors (e.g., "Only images available")
            'no_warnings': True,
            'compat_opts': ['no-javascript-extractor']
        })
        
        # [FIX] Don't use cookies with android client (causes warnings)
        if cookies_path and os.path.exists(cookies_path):
            ydl_opts['cookiefile'] = cookies_path
            logger.debug(f"[get_video_info] Using cookies: {os.path.basename(cookies_path)}")
        
        def _extract():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                try:
                    return ydl.extract_info(url, download=False)
                except Exception as e:
                    err_msg = str(e)
                    if '429' in err_msg or 'rate limit' in err_msg.lower():
                        raise
                    print(f"YTDLP get_video_info failed: {e}")
                    return None
        
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_extract)
            try:
                return future.result(timeout=timeout)
            except FutureTimeoutError:
                print(f"[TIME] get_video_info timeout after {timeout}s for {url}")
                return None
            except Exception as e:
                err_msg = str(e)
                if '429' in err_msg or 'rate limit' in err_msg.lower():
                     raise # Re-raise to trigger stop in channel_monitor
                print(f"YTDLP get_video_info error: {e}")
                return None

    def download(self, video_url, download_path, cookies_path=None, browser_headers=None, script_only=False, force_hd=False):
        video_url = self._resolve_url(video_url)

        # 1. Extract info first to DETECT LANGUAGE
        base_opts = {}
        if browser_headers: base_opts['http_headers'] = browser_headers
            
        ydl_opts_info = self._get_opts(video_url, {'quiet': True, 'extract_flat': False, **base_opts}, force_hd=force_hd)
        ydl_opts_info.update({
            'nocheckcertificate': True, 
            'ignoreerrors': True,
            'logger': StrategyFilteredLogger()  # [FIX] Apply warning filter to info extraction
        })
        
        # [FIX] Don't use cookies with android client
        if cookies_path and os.path.exists(cookies_path):
            ydl_opts_info['cookiefile'] = cookies_path
            logger.debug(f"Using cookies for authentication: {cookies_path}")
        
        info = None
        with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
            try: info = ydl.extract_info(video_url, download=False)
            except Exception as e: return {'status': 'failed', 'error': str(e)}

        if isinstance(info, dict) and info.get('status') == 'failed': return info
        if not info: return {'status': 'failed', 'error': 'Failed to extract video metadata'}
        
        # [FIX] Enhance Metadata for Shorts/Reels to prevent "0 views"
        # 1. View Count Fallbacks
        if not info.get('view_count'):
            info['view_count'] = info.get('approximate_view_count') or \
                                 info.get('statistics', {}).get('viewCount') or \
                                 0
        
        # 2. Channel Info Assurance
        if not info.get('channel_url'):
             info['channel_url'] = info.get('uploader_url') or \
                                   (f"https://www.youtube.com/channel/{info.get('channel_id')}" if info.get('channel_id') else None)
        
        video_id = info.get('id') # [FIX] Define video_id for later use
        if not video_id: 
            return {'status': 'failed', 'error': 'Could not extract video ID'}


        # --- SUBTITLE STRATEGY ---
        # User Requirement: Exactly 1 representative language file.
        print("DEBUG: Selecting single representative subtitle source.")
        
        # 1. Detect Language
        video_lang = info.get('language') or info.get('lang')
        subtitles = info.get('subtitles') or {}
        auto_subs = info.get('automatic_captions') or {}
        
        if not video_lang:
            all_langs = list(subtitles.keys()) + list(auto_subs.keys())
            if 'ko' in all_langs: video_lang = 'ko'
            elif 'en' in all_langs: video_lang = 'en'
            elif all_langs: video_lang = all_langs[0]
            else: video_lang = 'en'

        short_lang = video_lang.split('-')[0] if video_lang else 'en'
        target_sub_lang = f"{short_lang}.*"
        
        # 2. Prioritize Manual over Auto for the target language
        # We need to find if any key in subtitles matches short_lang
        has_manual = any(k.startswith(short_lang) for k in subtitles.keys())
        
        write_manual = False
        write_auto = False
        
        if has_manual:
            write_manual = True
            write_auto = False
            print(f"DEBUG: Found MANUAL subtitles for {short_lang}. Using it.")
        else:
            write_manual = False
            write_auto = True
            print(f"DEBUG: No manual subtitles for {short_lang}. Using AUTOMATIC captions.")

        print(f"DEBUG: Final Subtitle Config -> Lang: {target_sub_lang}, Manual: {write_manual}, Auto: {write_auto}")
        # --------------------------------

        # 2. Main Download
        # [DEFAULT HD] Always use HD quality (up to 1080p) for all downloads
        if not script_only:
            video_format = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
            if force_hd:
                video_format = 'bestvideo[height>=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height>=720]+bestaudio/bestvideo[height<=1080]+bestaudio/best'
                print("[VIDEO] [MANUAL HD] Using aggressive HD format selector")
            else:
                print("📹 [DEFAULT] Using HD format (1080p max, mp4 preferred)")
        else:
            video_format = None
            print("[FALLBACK] Script-Only Mode: Skipping video format selection.")
        
        # [FIX] Use centralized FFmpeg path from settings
        from app.config import settings
        ffmpeg_location = settings.FFMPEG_PATH
        
        # 3. Build DOWNLOAD OPTIONS
        filename_tpl = '%(upload_date)s_%(id)s.%(ext)s'
        outtmpl = os.path.join(download_path, filename_tpl).replace("\\", "/")
        
        dl_opts = {
            'outtmpl': outtmpl,
            'writesubtitles': write_manual,
            'writeautomaticsub': write_auto,
            'subtitleslangs': [target_sub_lang],
            'subtitlesformat': 'srt',
            'writeinfojson': True,
            'nocheckcertificate': True,
            'ignoreerrors': True,
            'no_warnings': True,
            'logger': StrategyFilteredLogger(),
            'ffmpeg_location': ffmpeg_location,
            'sleep_interval': 5,
            'max_sleep_interval': 15,
            'sleep_subtitles': 2,
            **base_opts
        }
        
        if script_only:
            dl_opts['skip_download'] = True
            dl_opts['format'] = 'null/best' # yt-dlp trick to skip video streams
            print(f"🛑 [SCRIPT-ONLY] Enforcing skip_download for {video_id}")
            dl_opts['postprocessors'] = [{
                'key': 'FFmpegSubtitlesConvertor',
                'format': 'srt',
            }]
        else:
            dl_opts['format'] = video_format
            dl_opts['postprocessors'] = [{
                'key': 'FFmpegSubtitlesConvertor',
                'format': 'srt',
            }]

        ydl_opts = self._get_opts(video_url, dl_opts)
        
        if browser_headers: 
            ydl_opts['http_headers'] = browser_headers
        
        # [FIX] Don't use cookies with android client (causes warnings)
        if cookies_path and os.path.exists(cookies_path): 
            ydl_opts['cookiefile'] = cookies_path
            logger.debug(f"Using cookies for authentication: {cookies_path}")
        else:
            logger.debug("No cookies found - may result in 360p quality restriction!")

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                 ydl.download([video_url])
            
            # [FIX] video_id is already correctly set from info.get('id') above (line 320).
            # DO NOT re-extract via regex - it can match wrong IDs from channel URLs.
            import re

            # [FIX] Robust File Finding using Glob
            # The upload_date might change during downloadRefinement, so we can't trust pre-dl info.
            # We search for *_{video_id}.*
            import glob
            final_video_path = None # [FIX] Initialize variable
            search_pattern = os.path.join(download_path, f"*{video_id}*.*")
            
            print(f"DEBUG: Search Pattern: {search_pattern}")
            found_files = glob.glob(search_pattern)
            print(f"DEBUG: Found Files: {found_files}")
            
            # Filter for video files (exclude .json, .part, .ytdl, etc, and also intermediate format-specific files like .f251.webm)
            video_files = [
                f for f in found_files 
                if not f.endswith(('.json', '.part', '.ytdl', '.vtt', '.srt', '.sbv')) 
                and not re.search(r'\.f\d+\.[^.]+$', f)
            ]
            print(f"DEBUG: Video Files after filter: {video_files}")
            
            if video_files:
                # Prioritize .mp4 over .webm to ensure best playback/preview compatibility in Chromium
                def video_sort_key(p):
                    ext = os.path.splitext(p)[1].lower()
                    if ext == '.mp4':
                        return 0
                    if ext == '.webm':
                        return 1
                    return 2
                video_files.sort(key=video_sort_key)
                final_video_path = video_files[0]
            else:
                # [FIX] Script-Only Mode Handling
                if script_only:
                    # In script-only mode, we EXPECT no video file.
                    # We return success if we have subtitles or just metadata.
                    # Try to find a subtitle file to set as 'file_path' for reference, though not strictly a video.
                    sub_files = [f for f in found_files if f.endswith(('.vtt', '.srt'))]
                    if sub_files:
                        # Prefer Korean > English > Other
                        def sub_sort(p):
                            base = os.path.basename(p).lower()
                            if '.ko.' in base: return 0
                            if '.en.' in base: return 1
                            return 2
                        sub_files.sort(key=sub_sort)
                        final_video_path = sub_files[0]
                        print(f"[OK] Script-Only: Found subtitle file: {os.path.basename(final_video_path)}")
                    else:
                        print(f"[FAIL] Script-Only: No subtitle file found for {video_id}. (Possible 429 error or no CC)")
                        final_video_path = None
                        return {'status': 'failed', 'error': 'No subtitle file found (Possible 429 error or no CC)'}
                else:
                     # Video Mode: Video file is required
                    pass
                
            # [FIX] Load metadata from .info.json (Ground Truth)
            # It shares the basename with the video file usually
            # But let's look specifically for the json file too
            json_files = [f for f in found_files if f.endswith('.info.json')]
            
            if json_files:
                info_json_path = json_files[0]
                try:
                    with open(info_json_path, 'r', encoding='utf-8') as f:
                        file_info = json.load(f)
                        # Merge critical fields
                        if file_info.get('view_count'):
                            info['view_count'] = int(file_info['view_count'])
                        if file_info.get('channel_url'):
                            info['channel_url'] = file_info['channel_url']
                        if file_info.get('uploader'):
                            info['uploader'] = file_info['uploader']
                        if file_info.get('upload_date'):
                            # crucial update for consistency
                            info['upload_date'] = file_info['upload_date'] 
                        # Ensure we get the best thumbnail
                        if file_info.get('thumbnail'):
                            info['thumbnail'] = file_info['thumbnail']
                except Exception as e:
                    print(f"Failed to read .info.json: {e}")
            else:
                 print(f"Warning: .info.json not found for {video_id}")

            # Ensure view_count is integer
            try:
                if info.get('view_count'):
                    info['view_count'] = int(info['view_count'])
                else: 
                     # Last resort: Try 'statistics' or similar if yt-dlp changes structure
                     info['view_count'] = 0
            except:
                info['view_count'] = 0

            # SUCCESS CONDITION
            # If script_only: Success if we have info (and preferably subs). final_video_path might be None or a sub file.
            # If video mode: Success only if final_video_path is a valid video file.
            if script_only:
                 return {'status': 'success', 'file_path': final_video_path, 'metadata': info}
            elif final_video_path:
                 return {'status': 'success', 'file_path': final_video_path, 'metadata': info}
            else:
                 return {'status': 'failed', 'error': 'Video file not found in download directory'}
        except Exception as e:
            return {'status': 'failed', 'error': f"Download Failed: {e}"}
