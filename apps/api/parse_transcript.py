import json
log_path = r'C:\Users\jmyoo\.gemini\antigravity-ide\brain\b86c2d7d-7e78-476a-9f0e-198fbbf22e7e\.system_generated\logs\transcript_full.jsonl'
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        if 'CaptainQuarters.tsx' in line:
            data = json.loads(line)
            if data.get('type') in ['VIEW_FILE', 'RUN_COMMAND', 'REPLACE_FILE_CONTENT', 'TOOL_CALLS']:
                print(f"Step: {data.get('step_index')} | Type: {data.get('type')} | Source: {data.get('source')}")
                if 'content' in data:
                    print(data['content'][:500] + '...')
                if 'tool_calls' in data:
                    print(json.dumps(data['tool_calls'], indent=2)[:500])
