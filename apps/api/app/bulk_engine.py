import copy
import re
import uuid

def generate_batch_jobs(template, csv_data, mapping):
    """
    Generates a list of render jobs based on a template and CSV data.
    
    Args:
        template (dict): The project template (tracks, clips, etc.).
        csv_data (list[dict]): List of rows from the CSV.
        mapping (dict): Map of Layer ID -> CSV Column Name.
                        e.g. {'text-clip-uuid': 'Quote', 'image-clip-uuid': 'Background'}
    
    Returns:
        list[dict]: List of job configurations (project state for each video).
    """
    jobs = []
    
    for i, row in enumerate(csv_data):
        # Deep copy the template for this instance
        project_state = copy.deepcopy(template)
        
        # Iterate through tracks and clips to apply mapping
        for track in project_state.get('tracks', []):
            for clip in track.get('clips', []):
                
                # Check if this clip is mapped
                if clip['id'] in mapping:
                    column_name = mapping[clip['id']]
                    value = row.get(column_name)
                    
                    if value:
                        # Apply value based on clip type
                        if clip['type'] == 'text':
                            # Replace content
                            if 'text' in clip:
                                clip['text']['content'] = str(value)
                        
                        elif clip['type'] == 'image' or clip['type'] == 'video':
                            # Replace file source
                            # Value should be a URL or Path
                            clip['fileUrl'] = str(value)
                            clip['filePath'] = str(value) # Assuming local path or handled by proxy
                            
                # Also support inline variable substitution for Text clips even if not explicitly mapped?
                # e.g. "Hello {{Name}}"
                if clip['type'] == 'text' and 'text' in clip:
                    content = clip['text']['content']
                    # Regex to find {{Variable}}
                    matches = re.findall(r'\{\{(.*?)\}\}', content)
                    for var in matches:
                        if var in row:
                            content = content.replace(f'{{{{{var}}}}}', str(row[var]))
                    clip['text']['content'] = content

        job = {
            "id": str(uuid.uuid4()),
            "row_index": i,
            "project_state": project_state,
            "status": "pending",
            "output_filename": f"output_{i}_{row.get('id', 'video')}.mp4"
        }
        jobs.append(job)
        
    return jobs

def generate_variants(project_state, hooks):
    """
    Generates A/B test variants by replacing the hook (first clip) with different content.
    
    Args:
        project_state (dict): The base project.
        hooks (list[str]): List of hook texts.
        
    Returns:
        list[dict]: List of job configurations.
    """
    jobs = []
    
    for i, hook_text in enumerate(hooks):
        variant_state = copy.deepcopy(project_state)
        
        # Find the first text clip to replace
        replaced = False
        if 'tracks' in variant_state:
            for track in variant_state['tracks']:
                if track.get('clips'):
                    first_clip = track['clips'][0]
                    
                    # If it's a text clip, replace content
                    if first_clip['type'] == 'text' and 'text' in first_clip:
                        first_clip['text']['content'] = hook_text
                        replaced = True
                        break
                        
                    # If it's a video/image, we might add a text overlay? 
                    # For now, strictly replace if text.
        
        if not replaced:
            # If no text clip found at start, maybe add one?
            # Or just log warning.
            pass
            
        job = {
            "id": str(uuid.uuid4()),
            "row_index": i,
            "project_state": variant_state,
            "status": "pending",
            "output_filename": f"variant_{i+1}_{uuid.uuid4().hex[:4]}.mp4"
        }
        jobs.append(job)
        
    return jobs
