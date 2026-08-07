from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import crud, schemas, database, models
from ..script_engine import ScriptEngine
from ..llm_manager import LLMClient

router = APIRouter(tags=["script"])

# Dependency for ScriptEngine
def get_script_engine(db: Session = Depends(database.get_db)):
    settings = crud.get_settings(db)
    llm_client = LLMClient(settings)
    return ScriptEngine(llm_client)

# Style Endpoints
@router.get("/styles", response_model=List[schemas.ScriptStyle])
def read_styles(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    styles = crud.get_script_styles(db, skip=skip, limit=limit)
    return styles

@router.post("/styles", response_model=schemas.ScriptStyle)
def create_style(style: schemas.ScriptStyleCreate, db: Session = Depends(database.get_db)):
    return crud.create_script_style(db=db, style=style)

@router.put("/styles/{style_id}", response_model=schemas.ScriptStyle)
def update_style(style_id: int, style: schemas.ScriptStyleUpdate, db: Session = Depends(database.get_db)):
    db_style = crud.update_script_style(db, style_id=style_id, style_update=style)
    if db_style is None:
        raise HTTPException(status_code=404, detail="Style not found")
    return db_style

@router.delete("/styles/{style_id}", response_model=schemas.ScriptStyle)
def delete_style(style_id: int, db: Session = Depends(database.get_db)):
    db_style = crud.delete_script_style(db, style_id=style_id)
    if db_style is None:
        raise HTTPException(status_code=404, detail="Style not found")
    return db_style

# Generation Endpoints
@router.post("/generate", response_model=schemas.ScriptGenerationResponse)
def generate_script(
    request: schemas.ScriptGenerationRequest,
    db: Session = Depends(database.get_db),
    engine: ScriptEngine = Depends(get_script_engine)
):
    style_instruction = ""
    sample_text = ""

    if request.style_id:
        style = crud.get_script_style(db, request.style_id)
        if style:
            style_instruction = style.system_instruction
            sample_text = style.sample_text
    
    settings = crud.get_settings(db)
    provider = request.provider or settings.script_analysis_provider
    model = request.model or settings.script_analysis_model

    try:
        # Returns dict: {"content": ..., "model_used": ..., "warning": ...}
        result = engine.generate_script(
            input_text=request.input_text,
            style_instruction=style_instruction,
            sample_text=sample_text,
            glossary=request.glossary,
            provider=provider,
            model=model,
            niche=request.niche,
            wisdom=request.wisdom,
            use_web_search=request.use_web_search
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/refine", response_model=schemas.ScriptGenerationResponse)
def refine_script(
    request: schemas.ScriptRefinementRequest,
    db: Session = Depends(database.get_db),
    engine: ScriptEngine = Depends(get_script_engine)
):
    style_instruction = ""
    sample_text = ""

    if request.style_id:
        style = crud.get_script_style(db, request.style_id)
        if style:
            style_instruction = style.system_instruction
            sample_text = style.sample_text

    settings = crud.get_settings(db)
    provider = request.provider or settings.script_analysis_provider
    model = request.model or settings.script_analysis_model

    try:
        # Returns dict: {"content": ..., "model_used": ..., "warning": ...}
        result = engine.refine_script(
            current_text=request.current_text,
            instruction=request.instruction,
            persona=request.persona,
            style_instruction=style_instruction,
            sample_text=sample_text,
            provider=provider,
            model=model,
            tempo_percentage=request.tempo_percentage or 100
        )

        # [NEW] Save refined script to workspace if it exists
        try:
            import os
            if request.video_id:
                video = crud.get_video(db, request.video_id)
                if video and video.metadata_json and "workspace_path" in video.metadata_json:
                    workspace_root = video.metadata_json["workspace_path"]
                    if os.path.exists(workspace_root):
                        refined_content = result.get("content") or ""
                        with open(os.path.join(workspace_root, "refined_script.txt"), "w", encoding="utf-8") as f:
                            f.write(refined_content)
                        
                        # Update Strategic Brief
                        with open(os.path.join(workspace_root, "strategy_brief.md"), "a", encoding="utf-8") as f:
                            f.write(f"\n\n## Refined Narrative ({request.persona or 'Custom'})\n> {refined_content}\n\n*Refinement Instruction: {request.instruction}*")
        except Exception as workspace_err:
            print(f"Workspace Update Failed: {workspace_err}")

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/safety-review", response_model=schemas.SafetyReviewResponse)
def safety_review_script(
    request: schemas.SafetyReviewRequest,
    db: Session = Depends(database.get_db),
    engine: ScriptEngine = Depends(get_script_engine)
):
    settings = crud.get_settings(db)
    provider = request.provider or settings.script_analysis_provider
    model = request.model or settings.script_analysis_model

    try:
        return engine.safety_review_script(
            current_text=request.current_text,
            provider=provider,
            model=model
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
