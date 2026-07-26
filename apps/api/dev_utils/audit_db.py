
import sqlite3
import os

db_path = "/home/jmyoon/ViraLoop/apps/api/viral_loop.db"

def audit_videos():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("--- Video Consistency Audit ---")
    
    # 1. Check for is_script_only videos
    cursor.execute("SELECT COUNT(*) FROM videos WHERE is_script_only = 1")
    script_only_count = cursor.fetchone()[0]
    print(f"Videos with is_script_only=1: {script_only_count}")

    # 2. Check for videos with script_only=0
    cursor.execute("SELECT COUNT(*) FROM videos WHERE is_script_only = 0 OR is_script_only IS NULL")
    full_video_count = cursor.fetchone()[0]
    print(f"Videos with is_script_only=0/NULL: {full_video_count}")

    # 3. Sample check: list some script-only videos and their files (if we had file path info in DB)
    # Let's see what columns we have in videos table
    cursor.execute("PRAGMA table_info(videos)")
    columns = [col[1] for col in cursor.fetchall()]
    print(f"Columns in videos table: {columns}")

    # 4. Check Channel default_script_only
    cursor.execute("SELECT COUNT(*) FROM channels WHERE default_script_only = 1")
    channels_script_only = cursor.fetchone()[0]
    print(f"Channels with default_script_only=1: {channels_script_only}")

    # 5. List channels with default_script_only=1
    cursor.execute("SELECT id, name, handle FROM channels WHERE default_script_only = 1")
    channels = cursor.fetchall()
    print("\nChannels in Script-Only Mode:")
    for ch in channels:
        print(f" - {ch[1]} (@{ch[2]}) [ID: {ch[0]}]")

    conn.close()

if __name__ == "__main__":
    audit_videos()
