import json

log_path = r'C:\Users\jmyoo\.gemini\antigravity-ide\brain\e16db182-b7f8-4119-9913-8faa0b1b0004\.system_generated\logs\transcript_full.jsonl'
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        if 'CaptainQuarters.tsx' in line:
            try:
                data = json.loads(line)
                if data.get('type') in ['VIEW_FILE']:
                    print(f"--- STEP {data.get('step_index')} VIEW_FILE ---")
                    print(data.get('content', '')[:1000])
                elif data.get('type') == 'RUN_COMMAND':
                    print(f"--- STEP {data.get('step_index')} RUN_COMMAND ---")
                    if 'content' in data:
                        print(data['content'][:200])
            except Exception:
                pass
