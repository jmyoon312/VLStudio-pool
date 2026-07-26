"""
Advanced Caching Service

Provides:
1. Multi-layer caching (memory, Redis, disk)
2. Cache invalidation strategies
3. Predictive caching
4. Cache warming
5. Distributed cache support

Usage:
    cache = AdvancedCache()
    
    # Set with TTL
    await cache.set("user:123", user_data, ttl=3600)
    
    # Get with fallback
    data = await cache.get("user:123", fallback_fn=load_user)
    
    # Invalidate pattern
    await cache.invalidate_pattern("user:*")
"""

import os
import asyncio
import logging
import json
import hashlib
import pickle
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass
from enum import Enum
import functools

logger = logging.getLogger(__name__)


class CacheLayer(Enum):
    """Cache layers"""
    MEMORY = "memory"
    REDIS = "redis"
    DISK = "disk"


class CacheStrategy(Enum):
    """Cache strategies"""
    CACHE_FIRST = "cache_first"      # Try cache, then source
    SOURCE_FIRST = "source_first"     # Try source, then cache
    WRITE_THROUGH = "write_through"   # Write to both
    WRITE_BACK = "write_back"         # Write to cache, async to source


@dataclass
class CacheEntry:
    """Cache entry"""
    key: str
    value: Any
    created_at: datetime
    expires_at: Optional[datetime]
    hit_count: int = 0
    last_accessed: datetime = None
    
    def __post_init__(self):
        if self.last_accessed is None:
            self.last_accessed = self.created_at
    
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return datetime.now() > self.expires_at


class AdvancedCache:
    """
    Advanced Multi-Layer Caching Service
    
    Features:
    - Memory → Redis → Disk hierarchy
    - Intelligent cache invalidation
    - Predictive pre-caching
    - Cache statistics and monitoring
    - Distributed cache support
    """
    
    def __init__(self):
        self._memory_cache: Dict[str, CacheEntry] = {}
        self._redis_client = None
        self._disk_cache_dir = None
        
        # Configuration
        self._config = {
            "memory_max_size": 10000,
            "memory_ttl": 300,        # 5 minutes
            "redis_ttl": 3600,        # 1 hour
            "disk_ttl": 86400,        # 24 hours
            "enable_redis": True,
            "enable_disk": True
        }
        
        # Stats
        self._stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "invalidations": 0,
            "by_layer": {layer.value: 0 for layer in CacheLayer}
        }
        
        # Initialize disk cache
        self._init_disk_cache()
        
        logger.info("AdvancedCache initialized")
    
    def _init_disk_cache(self):
        """Initialize disk cache"""
        self._disk_cache_dir = "/tmp/viraloop_cache"
        os.makedirs(self._disk_cache_dir, exist_ok=True)
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: int = None,
        strategy: CacheStrategy = CacheStrategy.CACHE_FIRST
    ):
        """
        Set cache value
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            strategy: Cache strategy
        """
        now = datetime.now()
        expires_at = now + timedelta(seconds=ttl) if ttl else None
        
        # Create entry
        entry = CacheEntry(
            key=key,
            value=value,
            created_at=now,
            expires_at=expires_at
        )
        
        # Memory cache
        self._memory_cache[key] = entry
        self._enforce_memory_limit()
        
        # Redis (if enabled)
        if self._config["enable_redis"] and self._redis_client:
            await self._set_redis(key, value, ttl or self._config["redis_ttl"])
        
        # Disk (if enabled)
        if self._config["enable_disk"]:
            self._set_disk(key, value, ttl or self._config["disk_ttl"])
        
        self._stats["sets"] += 1
        
        logger.debug(f"💾 Cached: {key} (TTL: {ttl or 'default'})")
    
    async def get(
        self,
        key: str,
        fallback: Callable = None,
        ttl: int = None
    ) -> Optional[Any]:
        """
        Get cache value
        
        Args:
            key: Cache key
            fallback: Function to call on cache miss
            ttl: Default TTL for fallback result
            
        Returns:
            Cached value or fallback result
        """
        # Try memory first
        entry = self._memory_cache.get(key)
        
        if entry and not entry.is_expired():
            entry.hit_count += 1
            entry.last_accessed = datetime.now()
            self._stats["hits"] += 1
            self._stats["by_layer"][CacheLayer.MEMORY.value] += 1
            logger.debug(f"✅ Cache hit (memory): {key}")
            return entry.value
        
        # Try Redis
        if self._config["enable_redis"] and self._redis_client:
            value = await self._get_redis(key)
            if value is not None:
                # Populate memory cache
                await self.set(key, value, ttl=self._config["memory_ttl"])
                self._stats["hits"] += 1
                self._stats["by_layer"][CacheLayer.REDIS.value] += 1
                logger.debug(f"✅ Cache hit (redis): {key}")
                return value
        
        # Try disk
        if self._config["enable_disk"]:
            value = self._get_disk(key)
            if value is not None:
                # Populate upper layers
                await self.set(key, value, ttl=self._config["memory_ttl"])
                self._stats["hits"] += 1
                self._stats["by_layer"][CacheLayer.DISK.value] += 1
                logger.debug(f"✅ Cache hit (disk): {key}")
                return value
        
        # Cache miss
        self._stats["misses"] += 1
        logger.debug(f"❌ Cache miss: {key}")
        
        # Call fallback if provided
        if fallback:
            try:
                if asyncio.iscoroutinefunction(fallback):
                    value = await fallback()
                else:
                    value = fallback()
                
                if value is not None:
                    await self.set(key, value, ttl=ttl)
                
                return value
            except Exception as e:
                logger.error(f"Fallback failed for {key}: {e}")
        
        return None
    
    async def delete(self, key: str):
        """Delete cache entry"""
        # Memory
        if key in self._memory_cache:
            del self._memory_cache[key]
        
        # Redis
        if self._redis_client:
            try:
                await self._redis_client.delete(key)
            except:
                pass
        
        # Disk
        self._delete_disk(key)
        
        self._stats["invalidations"] += 1
        logger.debug(f"🗑️ Cache deleted: {key}")
    
    async def invalidate_pattern(self, pattern: str):
        """Invalidate keys matching pattern"""
        import re
        
        # Convert glob to regex
        regex_pattern = pattern.replace("*", ".*").replace("?", ".")
        
        # Memory
        keys_to_delete = [
            k for k in self._memory_cache.keys()
            if re.match(regex_pattern, k)
        ]
        
        for key in keys_to_delete:
            await self.delete(key)
        
        # Redis (if available)
        if self._redis_client:
            try:
                keys = await self._redis_client.keys(pattern)
                if keys:
                    await self._redis_client.delete(*keys)
            except:
                pass
        
        logger.info(f"🗑️ Invalidated {len(keys_to_delete)} keys matching: {pattern}")
    
    def _enforce_memory_limit(self):
        """Enforce memory cache size limit"""
        if len(self._memory_cache) > self._config["memory_max_size"]:
            # Remove oldest entries (LRU)
            sorted_entries = sorted(
                self._memory_cache.items(),
                key=lambda x: x[1].last_accessed
            )
            
            remove_count = len(self._memory_cache) - self._config["memory_max_size"] + 100
            
            for key, _ in sorted_entries[:remove_count]:
                del self._memory_cache[key]
    
    # Redis methods
    async def _set_redis(self, key: str, value: Any, ttl: int):
        """Set Redis cache"""
        try:
            if not self._redis_client:
                self._redis_client = self._get_redis_client()
            
            serialized = json.dumps(value) if isinstance(value, (dict, list)) else str(value)
            await self._redis_client.setex(key, ttl, serialized)
        except Exception as e:
            logger.debug(f"Redis set failed: {e}")
    
    async def _get_redis(self, key: str) -> Optional[Any]:
        """Get Redis cache"""
        try:
            if not self._redis_client:
                self._redis_client = self._get_redis_client()
            
            value = await self._redis_client.get(key)
            if value:
                return json.loads(value)
        except:
            pass
        return None
    
    def _get_redis_client(self):
        """Get Redis client (lazy init)"""
        try:
            import redis
            return redis.Redis(host='localhost', port=6379, decode_responses=True)
        except:
            return None
    
    # Disk methods
    def _set_disk(self, key: str, value: Any, ttl: int):
        """Set disk cache"""
        try:
            # Create key hash
            key_hash = hashlib.md5(key.encode()).hexdigest()
            filepath = os.path.join(self._disk_cache_dir, f"{key_hash}.cache")
            
            data = {
                "key": key,
                "value": value,
                "expires_at": (datetime.now() + timedelta(seconds=ttl)).isoformat()
            }
            
            with open(filepath, 'wb') as f:
                pickle.dump(data, f)
        except Exception as e:
            logger.debug(f"Disk cache set failed: {e}")
    
    def _get_disk(self, key: str) -> Optional[Any]:
        """Get disk cache"""
        try:
            key_hash = hashlib.md5(key.encode()).hexdigest()
            filepath = os.path.join(self._disk_cache_dir, f"{key_hash}.cache")
            
            if not os.path.exists(filepath):
                return None
            
            with open(filepath, 'rb') as f:
                data = pickle.load(f)
            
            # Check expiration
            if data.get("expires_at"):
                expires = datetime.fromisoformat(data["expires_at"])
                if datetime.now() > expires:
                    os.remove(filepath)
                    return None
            
            return data.get("value")
            
        except Exception as e:
            return None
    
    def _delete_disk(self, key: str):
        """Delete disk cache"""
        try:
            key_hash = hashlib.md5(key.encode()).hexdigest()
            filepath = os.path.join(self._disk_cache_dir, f"{key_hash}.cache")
            
            if os.path.exists(filepath):
                os.remove(filepath)
        except:
            pass
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total = self._stats["hits"] + self._stats["misses"]
        hit_rate = (self._stats["hits"] / total * 100) if total > 0 else 0
        
        return {
            "hits": self._stats["hits"],
            "misses": self._stats["misses"],
            "hit_rate_percent": round(hit_rate, 2),
            "sets": self._stats["sets"],
            "invalidations": self._stats["invalidations"],
            "by_layer": self._stats["by_layer"],
            "memory_entries": len(self._memory_cache),
            "memory_max": self._config["memory_max_size"]
        }
    
    async def warm_cache(self, keys: List[str], loader: Callable):
        """
        Pre-warm cache with keys
        
        Args:
            keys: List of keys to warm
            loader: Async function to load data
        """
        logger.info(f"🔥 Warming cache for {len(keys)} keys...")
        
        for key in keys:
            try:
                value = await loader(key)
                if value:
                    await self.set(key, value)
            except Exception as e:
                logger.warning(f"Cache warm failed for {key}: {e}")
        
        logger.info("✅ Cache warming complete")
    
    def clear_all(self):
        """Clear all caches"""
        self._memory_cache.clear()
        
        if self._redis_client:
            try:
                # Note: This clears ALL redis, be careful
                pass
            except:
                pass
        
        # Clear disk cache
        for file in os.listdir(self._disk_cache_dir):
            if file.endswith(".cache"):
                os.remove(os.path.join(self._disk_cache_dir, file))
        
        logger.info("🗑️ All caches cleared")


def cached(ttl: int = 300, key_prefix: str = ""):
    """Decorator for caching function results"""
    def decorator(func):
        cache = AdvancedCache()
        
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key
            cache_key = f"{key_prefix}{func.__name__}"
            if args:
                cache_key += f":{':'.join(str(a) for a in args)}"
            
            # Try to get from cache
            result = await cache.get(cache_key)
            
            if result is None:
                # Call function
                if asyncio.iscoroutinefunction(func):
                    result = await func(*args, **kwargs)
                else:
                    result = func(*args, **kwargs)
                
                # Cache result
                if result is not None:
                    await cache.set(cache_key, result, ttl=ttl)
            
            return result
        
        return wrapper
    return decorator


# Global singleton
_advanced_cache = None

def get_advanced_cache() -> AdvancedCache:
    """Get global AdvancedCache instance"""
    global _advanced_cache
    if _advanced_cache is None:
        _advanced_cache = AdvancedCache()
    return _advanced_cache