import json
import logging
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.deps import get_db
from app.db.models import Conversation, ScenarioSession
from app.repositories.scenarios import ScenarioReadOnlyRepository
from app.repositories.shortcut import ShortRepository
from app.schemas import ScenarioSummary, Shortcut
from app.services.scenario_engine import run_scenario

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)])


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def log_scenario_run(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        scenario_data = kwargs.get("scenario_data")
        scenario_state = kwargs.get("scenario_state")
        slots = kwargs.get("slots")
        logger.debug(
            "run_scenario payload=%s scenarioState=%s slots=%s result=%s",
            scenario_data,
            scenario_state,
            slots,
            result,
        )
        return result

    return wrapper


def log_request_response(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        session_id = kwargs.get("sessionId") or kwargs.get("session_id")
        payload = kwargs.get("payload")
        logger.debug(
            "request %s sessionId=%s payload=%s",
            func.__name__,
            session_id,
            payload,
        )
        try:
            response = func(*args, **kwargs)
            logger.debug(
                "response %s sessionId=%s result=%s",
                func.__name__,
                session_id,
                response,
            )
            return response
        except Exception:
            logger.debug(
                "exception %s sessionId=%s",
                func.__name__,
                session_id,
                exc_info=True,
            )
            raise

    return wrapper


@log_scenario_run
def _run_scenario_with_logging(
    scenario_data: Dict[str, Any],
    scenario_state: Dict[str, Any],
    message: Dict[str, Any],
    slots: Dict[str, Any],
    scenario_session_id: str | None,
    language: str,
) -> Dict[str, Any]:
    return run_scenario(
        scenario_data,
        scenario_state,
        message,
        slots,
        scenario_session_id=scenario_session_id,
        language=language,
    )


def _parse_uuid(value: Any) -> UUID | None:
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        return None


def _get_user_uuid(current_user: dict) -> UUID:
    user_id = current_user.get("sub") or current_user.get("id")
    parsed = _parse_uuid(user_id)
    if not parsed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid user information.",
        )
    return parsed


def _serialize_session(session: ScenarioSession) -> Dict[str, Any]:
    return {
        "id": str(session.id),
        "scenarioId": str(session.scenario_id) if session.scenario_id else None,
        "conversationId": str(session.conversation_id),
        "state": session.context or {},
        "slots": session.slots or {},
        "status": session.status,
        "created_at": session.started_at.isoformat() if session.started_at else None,
        "updated_at": session.last_active_at.isoformat()
        if session.last_active_at
        else None,
    }


def _session_or_404(session_id: str, db: Session, user_id: UUID) -> ScenarioSession:
    uuid_value = _parse_uuid(session_id)
    if not uuid_value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario session not found.")
    session = db.get(ScenarioSession, uuid_value)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario session not found.")
    return session


@router.get("/scenarios", response_model=List[ScenarioSummary])
def list_scenarios(db: Session = Depends(get_db)):
    repo = ScenarioReadOnlyRepository(db)
    return [
        ScenarioSummary(
            id=str(row.id),
            title=row.name,
            description=row.description,
        )
        for row in repo.list()
    ]


@router.get("/shortcuts")
def list_shortcuts(db: Session = Depends(get_db)) -> List[Shortcut]:
    repo = ShortRepository(db)

    return [
        Shortcut(
            name=row.name,
            subCategories=row.sub_categories
        )
        for row in repo.list()
    ]

@router.post("/shortcuts")
def save_shortcut(data_list: list[Shortcut], db: Session = Depends(get_db)) -> List[Shortcut]:
    repo = ShortRepository(db)

    repo.save(data_list)

    return [
        Shortcut(
            name=row.name,
            subCategories=row.sub_categories
        )
        for row in repo.list()
    ]

@router.get("/scenarios/{scenarioId}")
def get_scenario(scenarioId: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    repo = ScenarioReadOnlyRepository(db)
    scenario = repo.get(scenarioId)
    if scenario and (scenario.nodes or scenario.edges):
        return {
            "id": str(scenario.id),
            "title": scenario.name,
            "description": scenario.description,
            "nodes": scenario.nodes or [],
            "edges": scenario.edges or [],
        }
    base_tmp = Path(__file__).resolve().parents[5] / "tmp"
    candidate_paths = [
        base_tmp / f"{scenarioId}.json",
        base_tmp / scenarioId / ".json",
    ]
    for scenario_path in candidate_paths:
        if scenario_path.exists():
            try:
                with scenario_path.open("r", encoding="utf-8") as file:
                    return json.load(file)
            except (OSError, json.JSONDecodeError) as error:
                logger.warning("Failed to load fallback scenario JSON: %s", error)
    return {"id": scenarioId, "title": "Scenario", "nodes": []}


@router.post("/scenario-sessions", status_code=201)
def create_scenario_session(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    logger.info(f"[/scenario-sessions] payload: {payload}")
    user_id = _get_user_uuid(current_user)
    scenario_id = payload.get("scenarioId")
    conversation_id = payload.get("conversationId")
    if not scenario_id or not conversation_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scenarioId and conversationId are required.",
        )
    scenario = ScenarioReadOnlyRepository(db).get(str(scenario_id))
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found.")
    conversation_uuid = _parse_uuid(conversation_id)
    if not conversation_uuid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid conversationId.",
        )
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_uuid, Conversation.user_id == user_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    slots = payload.get("slots") or {}
    now = datetime.now(timezone.utc)
    session = ScenarioSession(
        scenario_id=scenario.id,
        user_id=user_id,
        conversation_id=conversation.id,
        status="starting",
        slots=slots,
        context={},
        started_at=now,
        last_active_at=now,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _serialize_session(session)


@router.get("/scenario-sessions/{sessionId}")
def get_scenario_session(
    sessionId: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    return _serialize_session(
        _session_or_404(sessionId, db, _get_user_uuid(current_user))
    )


@router.patch("/scenario-sessions/{sessionId}")
def update_scenario_session(
    sessionId: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    session = _session_or_404(sessionId, db, _get_user_uuid(current_user))
    if "state" in payload:
        session.context = payload.get("state")
    if "slots" in payload:
        session.slots = payload.get("slots")
    if "status" in payload:
        session.status = payload.get("status")
    session.last_active_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(session)
    return _serialize_session(session)


@router.post("/scenario-sessions/{sessionId}/events")
@log_request_response
def create_scenario_event(
    sessionId: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    session = _session_or_404(sessionId, db, _get_user_uuid(current_user))
    scenario = ScenarioReadOnlyRepository(db).get(str(session.scenario_id))
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found.")

    slots = payload.get("slots")
    if slots is None:
        slots = session.slots or {}
    else:
        slots = dict(slots)

    context = session.context or {}
    scenario_state = payload.get("scenarioState")
    if scenario_state is None:
        scenario_state = context.get("scenarioState")
    scenario_state = dict(scenario_state) if isinstance(scenario_state, dict) else {}

    message = payload.get("message") or {}
    language = payload.get("language") or "ko"

    scenario_data = {
        "id": str(scenario.id),
        "nodes": scenario.nodes or [],
        "edges": scenario.edges or [],
    }
    if scenario.name:
        scenario_data["title"] = scenario.name
    if scenario.description:
        scenario_data["description"] = scenario.description

    result = _run_scenario_with_logging(
        scenario_data=scenario_data,
        scenario_state=scenario_state,
        message=message,
        slots=slots,
        scenario_session_id=sessionId,
        language=language,
    )

    if not isinstance(result, dict):
        logger.error("Scenario engine returned unexpected result: %s", result)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Scenario engine failed to produce a response.",
        )

    logger.info("result: %s", result)
    now = datetime.now(timezone.utc)
    session.slots = result.get("slots") or {}
    scenario_state_payload = result.get("scenarioState") or {}
    if scenario_state_payload:
        session.context = {"scenarioState": scenario_state_payload}
    else:
        session.context = {}
    session.current_node_id = scenario_state_payload.get("currentNodeId")
    session.last_active_at = now
    new_status = result.get("status") or ("completed" if result.get("type") == "scenario_end" else "active")
    session.status = new_status
    if result.get("type") == "scenario_end":
        session.ended_at = now

    db.commit()
    db.refresh(session)

    return {
        **result,
        "status": session.status,
        "sessionId": str(session.id),
        "created_at": now_iso(),
    }


@router.post("/scenario-sessions/{sessionId}/end")
def end_scenario_session(
    sessionId: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    session = _session_or_404(sessionId, db, _get_user_uuid(current_user))
    session.status = "completed"
    session.context = {}
    session.last_active_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(session)
    return _serialize_session(session)


@router.get("/favorites")
def list_favorites() -> List[Dict[str, Any]]:
    return []


@router.post("/favorites", status_code=201)
def create_favorite(payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": "fav_002",
        "type": payload.get("type") or "scenario",
        "target_id": payload.get("target_id") or "scenario_001",
        "created_at": now_iso(),
    }


@router.delete("/favorites/{favoriteId}", status_code=204)
def delete_favorite(favoriteId: str) -> Response:
    return Response(status_code=204)


@router.post("/favorites/reorder")
def reorder_favorites(payload: Dict[str, Any]) -> Dict[str, Any]:
    return {"updated": len(payload.get("orders") or [])}


@router.get("/notifications")
def list_notifications(read: bool | None = None) -> List[Dict[str, Any]]:
    return [
        {
            "id": "noti_001",
            "title": "Notice",
            "message": "Mock notification",
            "is_read": read if read is not None else False,
            "created_at": now_iso(),
        }
    ]


@router.patch("/notifications/{notificationId}")
def update_notification(notificationId: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {"id": notificationId, **payload}



@router.delete("/notifications/{notificationId}", status_code=204)
def delete_notification(notificationId: str) -> Response:
    return Response(status_code=204)


@router.post("/notifications/read-all")
def read_all_notifications() -> Dict[str, Any]:
    return {"updated": 0}


@router.get("/settings/user")
def get_user_settings() -> Dict[str, Any]:
    return {"theme": "light", "locale": "ko"}


@router.put("/settings/user")
def put_user_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    return payload


@router.get("/settings/global")
def get_global_settings() -> Dict[str, Any]:
    return {"headerTitle": "AI Chatbot"}


@router.put("/settings/global")
def put_global_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    return payload


@router.get("/search")
def search(q: str) -> List[Dict[str, Any]]:
    return [
        {
            "type": "conversation",
            "id": "conv_001",
            "title": "Sample Conversation",
            "snippets": [q],
        }
    ]
