from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db.models import Scenario


class ScenarioRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> List[Scenario]:
        return self.db.query(Scenario).order_by(Scenario.created_at.desc()).all()

    def create(self, *, title: str, description: Optional[str], nodes: List[dict], edges: List[dict]) -> Scenario:
        scenario = Scenario(
            name=title,
            description=description,
            nodes=nodes or [],
            edges=edges or [],
            last_used_at=datetime.utcnow(),
        )
        self.db.add(scenario)
        self.db.commit()
        self.db.refresh(scenario)
        return scenario

    def get(self, scenario_id: str) -> Optional[Scenario]:
        return self.db.get(Scenario, scenario_id)

    def update(
        self,
        scenario_id: str,
        *,
        title: Optional[str] = None,
        description: Optional[str] = None,
        nodes: Optional[List[dict]] = None,
        edges: Optional[List[dict]] = None,
    ) -> Scenario:
        scenario = self.get(scenario_id)
        if not scenario:
            raise ValueError("Scenario not found.")
        if title is not None:
            scenario.name = title
        if description is not None:
            scenario.description = description
        if nodes is not None:
            scenario.nodes = nodes
        if edges is not None:
            scenario.edges = edges
        scenario.updated_at = datetime.utcnow()
        scenario.last_used_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(scenario)
        return scenario

    def delete(self, scenario_id: str) -> None:
        scenario = self.get(scenario_id)
        if not scenario:
            raise ValueError("Scenario not found.")
        self.db.delete(scenario)
        self.db.commit()

    def clone(self, scenario_id: str, *, title: str) -> Scenario:
        source = self.get(scenario_id)
        if not source:
            raise ValueError("Scenario not found.")
        clone = Scenario(
            id=uuid4(),
            name=title,
            description=source.description,
            nodes=source.nodes or [],
            edges=source.edges or [],
            last_used_at=datetime.utcnow(),
        )
        self.db.add(clone)
        self.db.commit()
        self.db.refresh(clone)
        return clone

    def rename(self, scenario_id: str, *, title: str, description: Optional[str] = None) -> Scenario:
        return self.update(scenario_id, title=title, description=description)