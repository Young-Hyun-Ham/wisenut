from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.repositories.scenarios import ScenarioReadOnlyRepository


@dataclass(frozen=True)
class ScenarioData:
    data: Dict[str, Any]
    mtime: float


class ScenarioNotFound(Exception):
    pass


class ScenarioRepository:
    def __init__(self, db: Session) -> None:
        self._repo = ScenarioReadOnlyRepository(db)

    def get_scenario(self, scenario_id: str) -> ScenarioData:
        row = self._repo.get(scenario_id)
        if not row:
            raise ScenarioNotFound(f"scenario not found: {scenario_id}")

        raw_data: Dict[str, Any] = {
            "nodes": row.nodes or [],
            "edges": row.edges or [],
            "start_node_id": row.start_node_id or None,
        }

        # mtime은 GraphRegistry 캐시 키로 사용되므로 DB 업데이트 시 변경 가능한 값을 사용한다.
        updated_at: datetime | None = row.updated_at or row.created_at
        mtime = updated_at.timestamp() if updated_at else 0.0

        return ScenarioData(data=raw_data, mtime=mtime)
