from __future__ import annotations

from typing import List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db.models import Scenario


class ScenarioReadOnlyRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> List[Scenario]:
        return self.db.query(Scenario).order_by(Scenario.created_at.desc()).all()

    def get(self, scenario_id: str) -> Optional[Scenario]:
        return self.db.get(Scenario, scenario_id)   
