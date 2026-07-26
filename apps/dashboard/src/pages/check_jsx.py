import sys
import re

def check_jsx_balance(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # Remove comments
    content = re.sub(r'{\s*/\*.*?\*/\s*}', '', content, flags=re.DOTALL)
    content = re.sub(r'//.*?\n', '\n', content)
    
    # Track tags
    stack = []
    # Improved regex: matches <Tag ... /> or <Tag ... > or </Tag>
    # Uses DOTALL to handle multi-line tags
    tag_pattern = re.compile(r'<(/?[a-zA-Z0-9_\.]+)(.*?)>', re.DOTALL)
    
    for match in tag_pattern.finditer(content):
        tag_full = match.group(0)
        tag_name = match.group(1)
        tag_attrs = match.group(2)
        
        is_closing = tag_name.startswith('/')
        is_self_closing = tag_attrs.strip().endswith('/')
        
        if is_self_closing:
            continue
            
        if is_closing:
            clean_name = tag_name[1:]
            if not stack:
                print(f"Error: Extra closing tag </{clean_name}> at Line: {content.count('\n', 0, match.start()) + 1}")
                continue
            
            last_tag, line_no = stack.pop()
            if last_tag != clean_name:
                print(f"Error: Mismatched tag. Found </{clean_name}> at Line {content.count('\n', 0, match.start()) + 1}, but expected </{last_tag}> (Opened at Line: {line_no})")
                # Recovery: pop until we find a match or stack is empty
                found = False
                temp_stack = [(last_tag, line_no)]
                while stack:
                    t, l = stack.pop()
                    if t == clean_name:
                        found = True
                        break
                    temp_stack.append((t, l))
                if not found:
                    # Put them back
                    for item in reversed(temp_stack):
                        stack.append(item)
        else:
            # Skip common self-closing HTML tags
            if tag_name.lower() in ['input', 'img', 'br', 'hr', 'link', 'meta']:
                continue
            stack.append((tag_name, content.count('\n', 0, match.start()) + 1))

    if stack:
        print("\nUnclosed tags remaining in stack (Total: {}):".format(len(stack)))
        for tag, line in reversed(stack):
            print(f"<{tag}> opened at line {line}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 check_jsx.py <file_path>")
    else:
        check_jsx_balance(sys.argv[1])
