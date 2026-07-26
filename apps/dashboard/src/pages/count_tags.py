import sys
import re

def count_all_tags(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # Remove comments
    content = re.sub(r'{\s*/\*.*?\*/\s*}', '', content, flags=re.DOTALL)
    content = re.sub(r'//.*?\n', '\n', content)
    
    tags = {}
    # Match <Tag or </Tag
    tag_pattern = re.compile(r'<(/?[a-zA-Z0-9_\.]+)', re.DOTALL)
    
    # Also track self-closing tags
    # This is rough because it might match inside strings, but let's try
    self_closing_pattern = re.compile(r'<([a-zA-Z0-9_\.]+)[^>]*?/\s*>', re.DOTALL)
    self_closings = self_closing_pattern.findall(content)
    
    for match in tag_pattern.finditer(content):
        tag_name = match.group(1)
        is_closing = tag_name.startswith('/')
        if is_closing:
            clean_name = tag_name[1:]
            tags[clean_name] = tags.get(clean_name, 0) - 1
        else:
            tags[tag_name] = tags.get(tag_name, 0) + 1
            
    # Subtract self-closings
    for tag in self_closings:
        tags[tag] = tags.get(tag, 0) - 1
        
    print("Tag Balances (should be 0):")
    for tag, count in sorted(tags.items()):
        if count != 0:
            print(f"{tag:20}: {count:+2}")

if __name__ == "__main__":
    count_all_tags(sys.argv[1])
