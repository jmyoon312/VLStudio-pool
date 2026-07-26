from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas, crud, database
from ..creative_engine import CreativeEngine
from ..llm_manager import LLMClient

# Dependency
def get_creative_engine(db: Session = Depends(get_db)):
    settings = crud.get_settings(db)
    llm_client = LLMClient(settings)
    return CreativeEngine(llm_client)

router = APIRouter(tags=["Creative Scripts"])
@router.get("/script-styles", response_model=List[schemas.ScriptStyle])
def get_script_styles(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return db.query(models.ScriptStyle).offset(skip).limit(limit).all()

@router.post("/script-styles", response_model=schemas.ScriptStyle)
def create_script_style(
    style: schemas.ScriptStyleCreate,
    db: Session = Depends(get_db)
):
    db_style = models.ScriptStyle(**style.dict())
    db.add(db_style)
    db.commit()
    db.refresh(db_style)
    return db_style

@router.put("/script-styles/{style_id}", response_model=schemas.ScriptStyle)
def update_script_style(
    style_id: int,
    style: schemas.ScriptStyleUpdate,
    db: Session = Depends(get_db)
):
    db_style = db.query(models.ScriptStyle).filter(models.ScriptStyle.id == style_id).first()
    if not db_style:
        raise HTTPException(status_code=404, detail="Script style not found")
    
    update_data = style.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_style, key, value)
    
    db.commit()
    db.refresh(db_style)
    return db_style

@router.delete("/script-styles/{style_id}")
def delete_script_style(
    style_id: int,
    db: Session = Depends(get_db)
):
    db_style = db.query(models.ScriptStyle).filter(models.ScriptStyle.id == style_id).first()
    if not db_style:
        raise HTTPException(status_code=404, detail="Script style not found")
    
    db.delete(db_style)
    db.commit()
    return {"status": "success"}

@router.post("/generate-script", response_model=schemas.ScriptGenerationResponse)
def generate_script(
    request: schemas.ScriptGenerationRequest,
    engine: CreativeEngine = Depends(get_creative_engine),
    db: Session = Depends(get_db)
):
    try:
        # Fetch style
        style = db.query(models.ScriptStyle).filter(models.ScriptStyle.id == request.style_id).first()
        if not style:
            raise HTTPException(status_code=404, detail="Script style not found")
            
        # Construct System Prompt
        system_instruction = style.system_instruction
        if style.sample_text:
            system_instruction += f"\n\nExample Output:\n{style.sample_text}"
            
        if request.glossary:
             system_instruction += f"\n\nGlossary/Terms:\n{request.glossary}"

        # Generate
        response_text = engine.llm_client.generate_content(
            prompt=request.input_text,
            model_name=request.model_name,
            system_instruction=system_instruction
        )
        
        # Handle dict response
        if isinstance(response_text, dict):
             response_text = response_text.get("content", "")

        return {
            "script": response_text,
            "model_used": request.model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
