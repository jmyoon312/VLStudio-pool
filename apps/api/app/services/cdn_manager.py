"""
CDN Manager - Content Delivery Network Integration

Manages:
1. CDN configuration (Cloudflare, Bunny, etc.)
2. Cache invalidation
3. URL signing
4. Bandwidth optimization
5. Geographic routing

Usage:
    cdn = CDNManager()
    
    # Configure CDN
    await cdn.configure("cloudflare", api_key="...", zone_id="...")
    
    # Purge cache
    await cdn.purge_cache("/videos/*")
    
    # Generate signed URL
    signed_url = cdn.sign_url("https://cdn.example.com/video.mp4", expires=3600)
"""

import os
import hmac
import hashlib
import time
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class CDNProvider(Enum):
    """CDN providers"""
    NONE = "none"
    CLOUDFLARE = "cloudflare"
    Bunny = "bunny"
    AWS_CLOUDFRONT = "aws_cloudfront"
    SELF_HOSTED = "self_hosted"


@dataclass
class CDNConfig:
    """CDN configuration"""
    provider: CDNProvider
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    zone_id: Optional[str] = None
    domain: Optional[str] = None
    enabled: bool = False


@dataclass
class CacheRule:
    """Cache rule"""
    pattern: str
    ttl: int = 86400  # 24 hours default
    browser_ttl: int = 3600
    headers: Dict[str, str] = field(default_factory=dict)


class CDNManager:
    """
    CDN Manager
    
    Features:
    - Multi-provider support
    - Cache management
    - URL signing
    - Cache invalidation
    - Bandwidth monitoring
    """
    
    def __init__(self):
        self._config: Optional[CDNConfig] = None
        self._cache_rules: List[CacheRule] = []
        self._stats: Dict[str, Any] = {
            "requests": 0,
            "bytes_sent": 0,
            "bytes_received": 0,
            "cache_hits": 0,
            "cache_misses": 0
        }
        
        # Default cache rules
        self._init_default_rules()
        
        logger.info("CDNManager initialized")
    
    def _init_default_rules(self):
        """Initialize default cache rules"""
        self._cache_rules = [
            CacheRule(pattern="/videos/*.mp4", ttl=604800, browser_ttl=86400),  # 7 days
            CacheRule(pattern="/images/*", ttl=259200, browser_ttl=43200),       # 3 days
            CacheRule(pattern="/audio/*", ttl=259200, browser_ttl=43200),        # 3 days
            CacheRule(pattern="/assets/*", ttl=86400, browser_ttl=3600),         # 1 day
            CacheRule(pattern="/*.css", ttl=86400, browser_ttl=3600),
            CacheRule(pattern="/*.js", ttl=86400, browser_ttl=3600),
            CacheRule(pattern="/*", ttl=3600, browser_ttl=600)                   # 1 hour default
        ]
    
    async def configure(
        self,
        provider: str,
        api_key: str = None,
        api_secret: str = None,
        zone_id: str = None,
        domain: str = None
    ) -> bool:
        """
        Configure CDN provider
        
        Args:
            provider: Provider name
            api_key: API key
            api_secret: API secret
            zone_id: Zone ID (for Cloudflare)
            domain: Custom domain
            
        Returns:
            Success status
        """
        try:
            provider_enum = CDNProvider(provider.lower())
            
            self._config = CDNConfig(
                provider=provider_enum,
                api_key=api_key,
                api_secret=api_secret,
                zone_id=zone_id,
                domain=domain,
                enabled=True
            )
            
            logger.info(f"✅ CDN configured: {provider}")
            return True
            
        except ValueError:
            logger.error(f"Unknown CDN provider: {provider}")
            return False
        except Exception as e:
            logger.error(f"CDN configuration failed: {e}")
            return False
    
    def is_enabled(self) -> bool:
        """Check if CDN is enabled"""
        return self._config and self._config.enabled
    
    def get_cdn_url(self, original_url: str) -> str:
        """
        Convert original URL to CDN URL
        
        Args:
            original_url: Original file URL
            
        Returns:
            CDN URL
        """
        if not self.is_enabled():
            return original_url
        
        # Replace domain with CDN domain
        if self._config.domain:
            return original_url.replace(
                os.environ.get("VIRALOOP_URL", "https://api.viraloop.io"),
                self._config.domain
            )
        
        return original_url
    
    async def purge_cache(self, pattern: str = None) -> bool:
        """
        Purge CDN cache
        
        Args:
            pattern: URL pattern to purge (None = all)
            
        Returns:
            Success status
        """
        if not self.is_enabled():
            logger.warning("CDN not configured")
            return False
        
        try:
            if self._config.provider == CDNProvider.CLOUDFLARE:
                return await self._purge_cloudflare(pattern)
            elif self._config.provider == CDNProvider.BUNNY:
                return await self._purge_bunny(pattern)
            else:
                logger.warning(f"Purge not supported for {self._config.provider.value}")
                return False
                
        except Exception as e:
            logger.error(f"Cache purge failed: {e}")
            return False
    
    async def _purge_cloudflare(self, pattern: str = None) -> bool:
        """Purge Cloudflare cache"""
        import httpx
        
        if not self._config.api_key or not self._config.zone_id:
            return False
        
        url = f"https://api.cloudflare.com/client/v4/zones/{self._config.zone_id}/purge_cache"
        
        headers = {
            "Authorization": f"Bearer {self._config.api_key}",
            "Content-Type": "application/json"
        }
        
        data = {}
        if pattern:
            data["files"] = [{"url": pattern}]
        else:
            data["purge_everything"] = True
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=data, headers=headers)
            
            if response.status_code == 200:
                logger.info(f"✅ Cloudflare cache purged: {pattern or 'all'}")
                return True
            
            logger.error(f"Cloudflare purge failed: {response.text}")
            return False
    
    async def _purge_bunny(self, pattern: str = None) -> bool:
        """Purge Bunny CDN cache"""
        import httpx
        
        if not self._config.api_key or not self._config.domain:
            return False
        
        url = f"https://api.bunny.net/purge?hostname={self._config.domain}"
        
        headers = {
            "Authorization": f"{self._config.api_key}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers)
            
            return response.status_code == 200
    
    def sign_url(
        self,
        url: str,
        expires: int = 3600,
        ip: str = None
    ) -> str:
        """
        Generate signed CDN URL
        
        Args:
            url: Original URL
            expires: Expiration in seconds
            ip: Client IP (for IP-based signing)
            
        Returns:
            Signed URL
        """
        if not self._config or not self._config.api_secret:
            return url
        
        # Calculate expiration timestamp
        expires_at = int(time.time()) + expires
        
        # Build signature payload
        sign_data = f"{url}{expires_at}"
        if ip:
            sign_data += ip
        
        # Generate signature
        signature = hmac.new(
            self._config.api_secret.encode(),
            sign_data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # Build signed URL
        separator = "&" if "?" in url else "?"
        return f"{url}{separator}expires={expires_at}&signature={signature}"
    
    def verify_signature(
        self,
        url: str,
        expires: str,
        signature: str,
        ip: str = None
    ) -> bool:
        """
        Verify signed URL signature
        
        Args:
            url: Original URL
            expires: Expiration timestamp
            signature: Provided signature
            ip: Client IP
            
        Returns:
            Valid or not
        """
        if not self._config or not self._config.api_secret:
            return False
        
        # Check expiration
        if int(expires) < time.time():
            return False
        
        # Verify signature
        sign_data = f"{url}{expires}"
        if ip:
            sign_data += ip
        
        expected = hmac.new(
            self._config.api_secret.encode(),
            sign_data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(expected, signature)
    
    def add_cache_rule(self, rule: CacheRule):
        """Add custom cache rule"""
        self._cache_rules.append(rule)
        logger.info(f"Added cache rule: {rule.pattern} (TTL: {rule.ttl}s)")
    
    def get_cache_rule(self, url: str) -> Optional[CacheRule]:
        """Get applicable cache rule for URL"""
        import re
        
        for rule in self._cache_rules:
            # Convert glob to regex
            pattern = rule.pattern.replace("*", ".*")
            if re.match(pattern, url):
                return rule
        
        return None
    
    def get_stats(self) -> Dict[str, Any]:
        """Get CDN statistics"""
        total = self._stats["cache_hits"] + self._stats["cache_misses"]
        hit_rate = (
            self._stats["cache_hits"] / total * 100 
            if total > 0 else 0
        )
        
        return {
            "provider": self._config.provider.value if self._config else "none",
            "enabled": self.is_enabled(),
            "requests": self._stats["requests"],
            "bytes_sent": self._stats["bytes_sent"],
            "bytes_received": self._stats["bytes_received"],
            "cache_hits": self._stats["cache_hits"],
            "cache_misses": self._stats["cache_misses"],
            "hit_rate_percent": round(hit_rate, 2)
        }
    
    def record_request(
        self,
        bytes_sent: int = 0,
        bytes_received: int = 0,
        cache_hit: bool = False
    ):
        """Record request statistics"""
        self._stats["requests"] += 1
        self._stats["bytes_sent"] += bytes_sent
        self._stats["bytes_received"] += bytes_received
        
        if cache_hit:
            self._stats["cache_hits"] += 1
        else:
            self._stats["cache_misses"] += 1
    
    def get_config(self) -> Dict[str, Any]:
        """Get current CDN configuration"""
        if not self._config:
            return {"provider": "none", "enabled": False}
        
        return {
            "provider": self._config.provider.value,
            "domain": self._config.domain,
            "enabled": self._config.enabled,
            "zone_id": self._config.zone_id is not None
        }


# Global singleton
_cdn_manager = None

def get_cdn_manager() -> CDNManager:
    """Get global CDNManager instance"""
    global _cdn_manager
    if _cdn_manager is None:
        _cdn_manager = CDNManager()
    return _cdn_manager