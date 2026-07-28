from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app import models

router = APIRouter(tags=["categories"])

class CategoryCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None
    level: Optional[int] = 0

class CategoryResponse(BaseModel):
    id: int
    name: str
    name_en: Optional[str] = None
    folder_name: Optional[str] = None
    parent_id: Optional[int] = None
    level: Optional[int] = 0
    is_fixed: Optional[bool] = False
    ai_generated: Optional[bool] = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

@router.get("/", response_model=List[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    """List all categories"""
    return db.query(models.Category).order_by(models.Category.level, models.Category.name).all()

@router.post("/", response_model=CategoryResponse)
def create_category(category_in: CategoryCreate, db: Session = Depends(get_db)):
    """Create a new category"""
    existing = db.query(models.Category).filter(models.Category.name == category_in.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Category with this name already exists")
    category = models.Category(
        name=category_in.name,
        parent_id=category_in.parent_id,
        level=category_in.level or 0,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category

@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    """Delete a category"""
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(category)
    db.commit()
    return {"status": "deleted", "id": category_id}
