import sys
import re

def trace_nesting(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # Remove comments
    content = re.sub(r'{\s*/\*.*?\*/\s*}', '', content, flags=re.DOTALL)
    content = re.sub(r'//.*?\n', '\n', content)
    
    lines = content.split('\n')
    level = 0
    for i, line in enumerate(lines):
        # Count strictly <div (not preceded by /) and </div>
        # Ignore self-closing <div /> if any (rare in JSX but possible)
        num_opens = len(re.findall(r'<div(?![^>]*?/\s*>)', line))
        num_closes = len(re.findall(r'</div', line))
        
        diff = num_opens - num_closes
        level += diff
        if diff != 0:
            print(f"Line {i+1:4}: Level {level:2} ({diff:+2}) | {line.strip()[:60]}")

if __name__ == "__main__":
    trace_nesting(sys.argv[1])
