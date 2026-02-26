from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.repositories.scenarios import ScenarioRepository
from app.schemas import ScenarioDetail, ScenarioNamePayload, ScenarioSummary

router = APIRouter(tags=["Scenarios"])


def _to_summary(detail: ScenarioDetail) -> ScenarioSummary:
    return ScenarioSummary(id=detail.id or "", title=detail.title, description=detail.description)


@router.get("/scenarios", response_model=List[ScenarioSummary])
def list_scenarios(db: Session = Depends(get_db)):
    repo = ScenarioRepository(db)
    return [
        _to_summary(
            ScenarioDetail(
                id=str(row.id),
                title=row.name,
                description=row.description,
                nodes=row.nodes or [],
            )
        )
        for row in repo.list()
    ]


@router.post("/scenarios", response_model=ScenarioDetail, status_code=status.HTTP_201_CREATED)
def create_scenario(payload: ScenarioDetail, db: Session = Depends(get_db)):
    repo = ScenarioRepository(db)
    row = repo.create(
        title=payload.title,
        description=payload.description,
        nodes=payload.nodes,
        edges=payload.edges,
    )
    return ScenarioDetail(
        id=str(row.id),
        title=row.name,
        description=row.description,
        nodes=row.nodes or [],
        edges=row.edges or [],
    )


def _scenario_or_404(repo: ScenarioRepository, scenario_id: str) -> ScenarioDetail:
    row = repo.get(scenario_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scenario not found.")
    return ScenarioDetail(
        id=str(row.id),
        title=row.name,
        description=row.description,
        nodes=row.nodes or [],
        edges=row.edges or [],
    )


@router.get("/scenarios/{scenarioId}", response_model=ScenarioDetail)
def get_scenario(scenarioId: str, db: Session = Depends(get_db)):
    repo = ScenarioRepository(db)
    return _scenario_or_404(repo, scenarioId)


@router.patch("/scenarios/{scenarioId}", response_model=ScenarioDetail)
def update_scenario(scenarioId: str, payload: ScenarioDetail, db: Session = Depends(get_db)):
    repo = ScenarioRepository(db)
    payload_data = payload.dict(exclude_unset=True, exclude={"id"})
    try:
        row = repo.update(
            scenarioId,
            title=payload_data.get("title"),
            description=payload_data.get("description"),
            nodes=payload_data.get("nodes"),
            edges=payload_data.get("edges"),
        )
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scenario not found.")
    return ScenarioDetail(
        id=str(row.id),
        title=row.name,
        description=row.description,
        nodes=row.nodes or [],
        edges=row.edges or [],
    )


@router.delete("/scenarios/{scenarioId}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scenario(scenarioId: str, db: Session = Depends(get_db)):
    repo = ScenarioRepository(db)
    try:
        repo.delete(scenarioId)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scenario not found.")


@router.post("/scenarios/{scenarioId}/clone", response_model=ScenarioDetail, status_code=status.HTTP_201_CREATED)
def clone_scenario(scenarioId: str, payload: ScenarioNamePayload, db: Session = Depends(get_db)):
    repo = ScenarioRepository(db)
    try:
        row = repo.clone(scenarioId, title=payload.name)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source scenario not found.")
    return ScenarioDetail(
        id=str(row.id),
        title=row.name,
        description=row.description,
        nodes=row.nodes or [],
        edges=row.edges or [],
    )


@router.post("/scenarios/{scenarioId}/rename", response_model=ScenarioDetail)
def rename_scenario(scenarioId: str, payload: ScenarioNamePayload, db: Session = Depends(get_db)):
    repo = ScenarioRepository(db)
    try:
        row = repo.rename(scenarioId, title=payload.name, description=payload.description)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scenario not found.")
    return ScenarioDetail(
        id=str(row.id),
        title=row.name,
        description=row.description,
        nodes=row.nodes or [],
        edges=row.edges or [],
    )
