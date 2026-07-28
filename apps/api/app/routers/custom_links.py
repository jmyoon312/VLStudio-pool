from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import crud, models, schemas, database

router = APIRouter(tags=["custom-links"])

@router.get("", response_model=List[schemas.CustomLink])
@router.get("/", response_model=List[schemas.CustomLink])
def read_custom_links(db: Session = Depends(database.get_db)):
    return crud.get_custom_links(db)

@router.post("", response_model=schemas.CustomLink)
@router.post("/", response_model=schemas.CustomLink)
def create_custom_link(link: schemas.CustomLinkCreate, db: Session = Depends(database.get_db)):
    return crud.create_custom_link(db=db, link=link)

@router.put("/reorder", response_model=bool)
def reorder_custom_links(ordered_ids: List[int], db: Session = Depends(database.get_db)):
    return crud.reorder_custom_links(db=db, ordered_ids=ordered_ids)

@router.put("/{link_id}", response_model=schemas.CustomLink)
def update_custom_link(link_id: int, link: schemas.CustomLinkUpdate, db: Session = Depends(database.get_db)):
    db_link = crud.update_custom_link(db=db, link_id=link_id, link_update=link)
    if db_link is None:
        raise HTTPException(status_code=404, detail="Custom link not found")
    return db_link

@router.delete("/{link_id}", response_model=schemas.CustomLink)
def delete_custom_link(link_id: int, db: Session = Depends(database.get_db)):
    db_link = crud.delete_custom_link(db=db, link_id=link_id)
    if db_link is None:
        raise HTTPException(status_code=404, detail="Custom link not found")
    return db_link
