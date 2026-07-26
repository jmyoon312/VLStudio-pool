import sys
sys.path.insert(0, r'C:\ViraLoopMedia\VLStudio\apps\api')
from app.database import SessionLocal
from app.models import DiscoveryVideo
from datetime import datetime, timedelta

db = SessionLocal()
try:
    cutoff = datetime.now() - timedelta(days=90)
    cutoff_str = cutoff.strftime("%Y-%m-%d")
    old = db.query(DiscoveryVideo).filter(
        DiscoveryVideo.upload_date != None,
        DiscoveryVideo.upload_date < cutoff
    ).all()
    print(f"Found {len(old)} old videos to delete (before {cutoff_str})")
    for v in old[:20]:  # 처음 20개만 출력
        print(f"  - {v.upload_date} | {str(v.title)[:40]}")
    count = db.query(DiscoveryVideo).filter(
        DiscoveryVideo.upload_date != None,
        DiscoveryVideo.upload_date < cutoff
    ).delete(synchronize_session='fetch')
    db.commit()
    print(f"Deleted {count} old videos successfully!")
    
    remaining = db.query(DiscoveryVideo).count()
    print(f"Remaining videos in DB: {remaining}")
finally:
    db.close()
