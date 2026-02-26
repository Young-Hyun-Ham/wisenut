from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.repositories.settings import SettingsRepository
from app.schemas import (
    NodeColorSettings,
    NodeTextColorSettings,
    NodeVisibilitySettings,
    Settings,
)

router = APIRouter(tags=["Settings"])


@router.get("/settings/global", response_model=Settings)
def get_global_settings(db: Session = Depends(get_db)):
    repo = SettingsRepository(db)
    return Settings(**repo.get_global())


@router.put("/settings/global", response_model=Settings)
def update_global_settings(payload: Settings, db: Session = Depends(get_db)):
    repo = SettingsRepository(db)
    return Settings(**repo.update_global(payload.dict()))


@router.get("/settings/node-colors", response_model=NodeColorSettings)
def get_node_colors(db: Session = Depends(get_db)):
    repo = SettingsRepository(db)
    return NodeColorSettings(**repo.get_node_colors())


@router.put("/settings/node-colors", response_model=NodeColorSettings)
def update_node_colors(payload: NodeColorSettings, db: Session = Depends(get_db)):
    repo = SettingsRepository(db)
    return NodeColorSettings(**repo.update_node_colors(payload.dict()))


@router.get("/settings/node-text-colors", response_model=NodeTextColorSettings)
def get_node_text_colors(db: Session = Depends(get_db)):
    repo = SettingsRepository(db)
    return NodeTextColorSettings(**repo.get_node_text_colors())


@router.put("/settings/node-text-colors", response_model=NodeTextColorSettings)
def update_node_text_colors(payload: NodeTextColorSettings, db: Session = Depends(get_db)):
    repo = SettingsRepository(db)
    return NodeTextColorSettings(**repo.update_node_text_colors(payload.dict()))


@router.get("/settings/node-visibility", response_model=NodeVisibilitySettings)
def get_node_visibility(db: Session = Depends(get_db)):
    repo = SettingsRepository(db)
    return NodeVisibilitySettings(**repo.get_node_visibility())


@router.put("/settings/node-visibility", response_model=NodeVisibilitySettings)
def update_node_visibility(payload: NodeVisibilitySettings, db: Session = Depends(get_db)):
    repo = SettingsRepository(db)
    return NodeVisibilitySettings(**repo.update_node_visibility(payload.dict()))
