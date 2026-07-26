import sys
sys.path.insert(0, r'C:\ViraLoopMedia\VLStudio\apps\api')
from app.database import SessionLocal
from app.models import DiscoveryVideo
from datetime import datetime, timedelta
import json
from sqlalchemy import text

db = SessionLocal()
try:
    rows = db.execute(text('SELECT video_id, title, upload_date, metadata_json FROM discovery_videos ORDER BY upload_date ASC LIMIT 20')).fetchall()
    print('First 20 by upload_date (oldest first):')
    for r in rows:
        meta = {}
        try:
            raw = r[3]
            if isinstance(raw, str):
                meta = json.loads(raw)
            elif raw:
                meta = raw
        except:
            pass
        db_date = str(r[2]) if r[2] else 'NULL'
        meta_date = meta.get('upload_date', 'N/A')
        title_short = str(r[1])[:35] if r[1] else 'N/A'
        print(f"  DB_upload={db_date} | meta={meta_date} | {title_short}")
finally:
    db.close()
