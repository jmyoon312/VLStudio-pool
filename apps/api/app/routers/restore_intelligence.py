import os
import re

backup_dir = "/mnt/f/build/new/ViraLoop/backend/app/routers"
current_dir = "/app/apps/api/app/routers"

def extract_intelligence_block(content):
    """
    Extracts the block between 'router = APIRouter' and the first '@router'.
    """
    # Find router declaration
    router_match = re.search(r'router = APIRouter\(.*?\)', content, re.DOTALL)
    if not router_match:
        return None
    
    start_pos = router_match.end()
    
    # Find first endpoint
    endpoint_match = re.search(r'\n@router\.', content)
    if not endpoint_match:
        # Try finding the end of the file if no endpoints exist
        end_pos = len(content)
    else:
        end_pos = endpoint_match.start()
        
    return content[start_pos:end_pos]

def restore_file(filename):
    backup_path = os.path.join(backup_dir, filename)
    current_path = os.path.join(current_dir, filename)
    
    if not os.path.exists(backup_path) or not os.path.exists(current_path):
        return False
        
    with open(backup_path, 'r') as f:
        backup_content = f.read()
    with open(current_path, 'r') as f:
        current_content = f.read()
        
    intel_block = extract_intelligence_block(backup_content)
    if intel_block is None:
        return False
        
    # Find insertion point in current file
    router_match = re.search(r'router = APIRouter\(.*?\)', current_content, re.DOTALL)
    if not router_match:
        return False
        
    insertion_start = router_match.end()
    
    endpoint_match = re.search(r'\n@router\.', current_content)
    if not endpoint_match:
        insertion_end = len(current_content)
    else:
        insertion_end = endpoint_match.start()
        
    # Build new content
    new_content = current_content[:insertion_start] + intel_block + current_content[insertion_end:]
    
    with open(current_path, 'w') as f:
        f.write(new_content)
    return True

print("[FALLBACK] Starting Fleet-wide Intelligence Restoration...")
count = 0
for filename in os.listdir(current_dir):
    if filename.endswith(".py"):
        if restore_file(filename):
            print(f"[OK] Restored Intelligence: {filename}")
            count += 1
        else:
            print(f"[WARN] Skipped/Failed: {filename}")

print(f"\n🦾 Restoration Complete. {count} units have been re-aligned with legacy intelligence.")
