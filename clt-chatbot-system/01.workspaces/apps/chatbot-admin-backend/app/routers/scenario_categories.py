from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.repositories.settings import SettingsRepository
from app.schemas import ScenarioCategory

router = APIRouter(tags=["Categories"])


@router.get("/scenario-categories", response_model=List[ScenarioCategory])
def list_categories(db: Session = Depends(get_db)):
    repo = SettingsRepository(db)
    raw = repo.get_scenario_categories()
    return [ScenarioCategory(**item) for item in raw]


@router.put("/scenario-categories", response_model=dict)
def save_categories(payload: List[ScenarioCategory], db: Session = Depends(get_db)):
    repo = SettingsRepository(db)
    repo.update_scenario_categories([item.dict() for item in payload])
    return {"updated": True}
