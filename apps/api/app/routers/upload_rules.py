"""
업로드 규칙 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app import models

router = APIRouter(tags=["upload_rules"])


# === Pydantic Schemas ===

class UploadRuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    conditions: dict
    actions: dict
    priority: int = 0
    is_active: bool = True


class UploadRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    conditions: Optional[dict] = None
    actions: Optional[dict] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class UploadRuleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    conditions: dict
    actions: dict
    priority: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# === API Endpoints ===

@router.get("/", response_model=List[UploadRuleResponse])
def get_rules(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """업로드 규칙 목록 조회"""
    query = db.query(models.UploadRule)
    
    if is_active is not None:
        query = query.filter(models.UploadRule.is_active == is_active)
    
    rules = query.order_by(models.UploadRule.priority.desc()).all()
    return rules


@router.post("/", response_model=UploadRuleResponse)
def create_rule(
    rule_data: UploadRuleCreate,
    db: Session = Depends(get_db)
):
    """업로드 규칙 생성"""
    rule = models.UploadRule(
        name=rule_data.name,
        description=rule_data.description,
        conditions=rule_data.conditions,
        actions=rule_data.actions,
        priority=rule_data.priority,
        is_active=rule_data.is_active
    )
    
    db.add(rule)
    db.commit()
    db.refresh(rule)
    
    return rule


@router.get("/{rule_id}", response_model=UploadRuleResponse)
def get_rule(rule_id: int, db: Session = Depends(get_db)):
    """업로드 규칙 상세 조회"""
    rule = db.query(models.UploadRule).filter(models.UploadRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    return rule


@router.patch("/{rule_id}", response_model=UploadRuleResponse)
def update_rule(
    rule_id: int,
    update_data: UploadRuleUpdate,
    db: Session = Depends(get_db)
):
    """업로드 규칙 수정"""
    rule = db.query(models.UploadRule).filter(models.UploadRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    
    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(rule, key, value)
    
    rule.updated_at = datetime.now()
    db.commit()
    db.refresh(rule)
    
    return rule


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    """업로드 규칙 삭제"""
    rule = db.query(models.UploadRule).filter(models.UploadRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    
    db.delete(rule)
    db.commit()
    
    return {"message": "Rule deleted"}


@router.post("/{rule_id}/toggle")
def toggle_rule(rule_id: int, db: Session = Depends(get_db)):
    """업로드 규칙 활성화/비활성화 토글"""
    rule = db.query(models.UploadRule).filter(models.UploadRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    
    rule.is_active = not rule.is_active
    rule.updated_at = datetime.now()
    db.commit()
    db.refresh(rule)
    
    return rule
