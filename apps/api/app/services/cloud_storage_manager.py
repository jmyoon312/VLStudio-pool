"""
Cloud Storage Manager - Self-hosted Cloud Infrastructure

Manages:
1. Local cloud storage operations
2. File organization and versioning
3. Storage quota management
4. Backup automation

Usage:
    cloud = CloudStorageManager()
    
    # Upload file
    url = await cloud.upload("/path/to/video.mp4", "videos/2026/")
    
    # Get file info
    info = cloud.get_file_info("videos/2026/video.mp4")
    
    # Generate shareable link
    link = cloud.generate_link("videos/2026/video.mp4", expires_hours=24)
"""

import os
import json
import uuid
import logging
import hashlib
import shutil
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from pathlib import Path
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class StorageType(Enum):
    """Storage types"""
    LOCAL = "local"
    S3 = "s3"
    B2 = "b2"


class FileCategory(Enum):
    """File categories"""
    VIDEO = "video"
    AUDIO = "audio"
    IMAGE = "image"
    ASSET = "asset"
    BACKUP = "backup"
    TEMP = "temp"


@dataclass
class FileInfo:
    """File information"""
    path: str
    name: str
    size_bytes: int
    created_at: datetime
    modified_at: datetime
    category: FileCategory
    checksum: str
    version: int = 1
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StorageStats:
    """Storage statistics"""
    total_bytes: int = 0
    used_bytes: int = 0
    available_bytes: int = 0
    file_count: int = 0
    by_category: Dict[str, int] = field(default_factory=dict)


class CloudStorageManager:
    """
    Self-hosted Cloud Storage Manager
    
    Features:
    - Local file storage with organization
    - Versioning support
    - Checksum verification
    - Storage quota management
    - Backup automation
    - CDN-ready file serving
    """
    
    def __init__(self, base_path: str = None):
        if base_path is None:
            base_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                "downloads", "cloud"
            )
        
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        
        # Metadata storage
        self._metadata_dir = self.base_path / ".metadata"
        self._metadata_dir.mkdir(exist_ok=True)
        
        # Quota settings (default 100GB)
        self._max_storage_bytes = 100 * 1024 * 1024 * 1024
        
        # CDN serving path
        self._cdn_base = "/cloud"
        
        logger.info(f"CloudStorageManager initialized at: {self.base_path}")
    
    async def upload(
        self,
        source_path: str,
        destination: str,
        category: FileCategory = FileCategory.TEMP,
        create_version: bool = True
    ) -> Optional[str]:
        """
        Upload file to cloud storage
        
        Args:
            source_path: Source file path
            destination: Destination path (relative to base)
            category: File category
            create_version: Create version if file exists
            
        Returns:
            Cloud URL or None on failure
        """
        try:
            source = Path(source_path)
            if not source.exists():
                logger.error(f"Source file not found: {source_path}")
                return None
            
            # Create destination directory
            dest_path = self.base_path / destination
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Check if file exists
            final_path = dest_path
            if dest_path.exists() and create_version:
                final_path = self._get_versioned_path(dest_path)
            
            # Copy file
            shutil.copy2(source, final_path)
            
            # Calculate checksum
            checksum = await self._calculate_checksum(final_path)
            
            # Save metadata
            await self._save_metadata(final_path, category, checksum)
            
            # Generate URL
            url = f"{self._cdn_base}/{destination}"
            
            logger.info(f"✅ Uploaded: {source_path} -> {url}")
            return url
            
        except Exception as e:
            logger.error(f"Upload failed: {e}")
            return None
    
    async def download(
        self,
        cloud_path: str,
        destination: str
    ) -> Optional[str]:
        """
        Download file from cloud
        
        Args:
            cloud_path: Cloud path (relative)
            destination: Local destination
            
        Returns:
            Local path or None
        """
        try:
            file_path = self.base_path / cloud_path.lstrip('/')
            
            if not file_path.exists():
                logger.error(f"File not found in cloud: {cloud_path}")
                return None
            
            # Copy to destination
            dest = Path(destination)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file_path, dest)
            
            return str(dest)
            
        except Exception as e:
            logger.error(f"Download failed: {e}")
            return None
    
    def get_file_info(self, cloud_path: str) -> Optional[FileInfo]:
        """Get file information"""
        try:
            file_path = self.base_path / cloud_path.lstrip('/')
            
            if not file_path.exists():
                return None
            
            # Load metadata
            metadata = self._load_metadata(file_path)
            
            stat = file_path.stat()
            
            return FileInfo(
                path=cloud_path,
                name=file_path.name,
                size_bytes=stat.st_size,
                created_at=datetime.fromtimestamp(stat.st_ctime),
                modified_at=datetime.fromtimestamp(stat.st_mtime),
                category=FileCategory(metadata.get("category", "temp")),
                checksum=metadata.get("checksum", ""),
                version=metadata.get("version", 1),
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"Failed to get file info: {e}")
            return None
    
    def generate_link(
        self,
        cloud_path: str,
        expires_hours: int = 24,
        download: bool = False
    ) -> str:
        """
        Generate shareable link
        
        Args:
            cloud_path: Cloud path
            expires_hours: Link expiration hours
            download: Force download
            
        Returns:
            Shareable URL
        """
        # Generate token
        token = hashlib.sha256(
            f"{cloud_path}{datetime.now().isoformat()}".encode()
        ).hexdigest()[:16]
        
        # Store link info
        link_data = {
            "path": cloud_path,
            "expires": (datetime.now() + timedelta(hours=expires_hours)).isoformat(),
            "download": download
        }
        
        link_file = self._metadata_dir / f"link_{token}.json"
        with open(link_file, 'w') as f:
            json.dump(link_data, f)
        
        # Build URL
        base_url = os.environ.get("VIRALOOP_URL", "https://api.viraloop.io")
        action = "download" if download else "view"
        
        return f"{base_url}/cloud/{action}/{token}"
    
    def resolve_link(self, token: str) -> Optional[str]:
        """Resolve token to file path"""
        try:
            link_file = self._metadata_dir / f"link_{token}.json"
            
            if not link_file.exists():
                return None
            
            with open(link_file) as f:
                link_data = json.load(f)
            
            # Check expiration
            expires = datetime.fromisoformat(link_data["expires"])
            if expires < datetime.now():
                link_file.unlink()
                return None
            
            return link_data["path"]
            
        except Exception as e:
            logger.error(f"Failed to resolve link: {e}")
            return None
    
    def get_storage_stats(self) -> StorageStats:
        """Get storage statistics"""
        stats = StorageStats()
        
        try:
            # Calculate total storage
            for root, dirs, files in os.walk(self.base_path):
                # Skip metadata directory
                if '.metadata' in root:
                    continue
                
                for file in files:
                    file_path = Path(root) / file
                    try:
                        size = file_path.stat().st_size
                        stats.total_bytes += size
                        stats.file_count += 1
                    except:
                        pass
            
            stats.used_bytes = stats.total_bytes
            stats.available_bytes = self._max_storage_bytes - stats.used_bytes
            
            # Get by category
            for category in FileCategory:
                cat_dir = self.base_path / category.value
                if cat_dir.exists():
                    cat_size = sum(
                        f.stat().st_size 
                        for f in cat_dir.rglob('*') 
                        if f.is_file()
                    )
                    stats.by_category[category.value] = cat_size
            
        except Exception as e:
            logger.error(f"Failed to get storage stats: {e}")
        
        return stats
    
    def list_files(
        self,
        path: str = "",
        category: Optional[FileCategory] = None,
        limit: int = 100
    ) -> List[FileInfo]:
        """List files in directory"""
        try:
            search_path = self.base_path / path.lstrip('/')
            
            if not search_path.exists():
                return []
            
            files = []
            for file_path in search_path.rglob('*'):
                if not file_path.is_file():
                    continue
                
                info = self.get_file_info(str(file_path.relative_to(self.base_path)))
                if info:
                    if category is None or info.category == category:
                        files.append(info)
                
                if len(files) >= limit:
                    break
            
            return files
            
        except Exception as e:
            logger.error(f"Failed to list files: {e}")
            return []
    
    def delete_file(self, cloud_path: str, soft: bool = True) -> bool:
        """
        Delete file
        
        Args:
            cloud_path: Cloud path
            soft: Soft delete (move to .trash)
        """
        try:
            file_path = self.base_path / cloud_path.lstrip('/')
            
            if not file_path.exists():
                return False
            
            if soft:
                # Move to trash
                trash_path = self.base_path / ".trash" / file_path.name
                trash_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(file_path), str(trash_path))
            else:
                file_path.unlink()
            
            # Remove metadata
            metadata_path = self._get_metadata_path(file_path)
            if metadata_path.exists():
                metadata_path.unlink()
            
            return True
            
        except Exception as e:
            logger.error(f"Delete failed: {e}")
            return False
    
    def create_backup(self, category: FileCategory = None) -> str:
        """
        Create backup of storage
        
        Args:
            category: Category to backup, or None for all
            
        Returns:
            Backup path
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"backup_{timestamp}"
        backup_path = self.base_path / ".backups" / backup_name
        backup_path.mkdir(parents=True, exist_ok=True)
        
        try:
            if category:
                source = self.base_path / category.value
                if source.exists():
                    shutil.copytree(source, backup_path / category.value)
            else:
                # Backup everything except metadata
                for item in self.base_path.iterdir():
                    if item.name.startswith('.'):
                        continue
                    if item.is_dir():
                        shutil.copytree(item, backup_path / item.name)
                    else:
                        shutil.copy2(item, backup_path / item.name)
            
            logger.info(f"✅ Backup created: {backup_name}")
            return str(backup_path)
            
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            return ""
    
    async def _calculate_checksum(self, file_path: Path) -> str:
        """Calculate file checksum"""
        sha256 = hashlib.sha256()
        
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        
        return sha256.hexdigest()
    
    def _get_versioned_path(self, path: Path) -> Path:
        """Get versioned path"""
        stem = path.stem
        suffix = path.suffix
        parent = path.parent
        
        # Get current version
        metadata = self._load_metadata(path)
        version = metadata.get("version", 1) + 1
        
        return parent / f"{stem}_v{version}{suffix}"
    
    def _get_metadata_path(self, file_path: Path) -> Path:
        """Get metadata file path"""
        return self._metadata_dir / f"{file_path.name}.meta"
    
    async def _save_metadata(
        self,
        file_path: Path,
        category: FileCategory,
        checksum: str
    ):
        """Save file metadata"""
        metadata = {
            "original_name": file_path.name,
            "category": category.value,
            "checksum": checksum,
            "version": 1,
            "created_at": datetime.now().isoformat()
        }
        
        meta_path = self._get_metadata_path(file_path)
        with open(meta_path, 'w') as f:
            json.dump(metadata, f)
    
    def _load_metadata(self, file_path: Path) -> Dict[str, Any]:
        """Load file metadata"""
        meta_path = self._get_metadata_path(file_path)
        
        if meta_path.exists():
            with open(meta_path) as f:
                return json.load(f)
        
        return {}


# Global singleton
_cloud_storage = None

def get_cloud_storage() -> CloudStorageManager:
    """Get global CloudStorageManager instance"""
    global _cloud_storage
    if _cloud_storage is None:
        _cloud_storage = CloudStorageManager()
    return _cloud_storage