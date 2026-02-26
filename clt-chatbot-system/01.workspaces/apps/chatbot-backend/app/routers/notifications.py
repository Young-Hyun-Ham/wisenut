import json
from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.security import decode_access_token, get_current_user
from app.db.deps import get_db
from app.db.models import Notification
from app.notifications.bus import NotificationEventBus

router = APIRouter(prefix="/notifications", tags=["notifications"])


def parse_uuid(value: str) -> UUID:
    try:
        return UUID(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID.",
        ) from exc


def parse_cursor(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid cursor.",
        ) from exc


@router.get("")
def list_notifications(
    limit: int = 20,
    cursor: Optional[str] = None,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    user: Dict = Depends(get_current_user),
):
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="limit must be 1-100")
    user_id = parse_uuid(user.get("sub", ""))
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.read.is_(False))
    if cursor:
        cursor_dt = parse_cursor(cursor)
        query = query.filter(Notification.created_at < cursor_dt)
    items = query.order_by(Notification.created_at.desc()).limit(limit).all()
    next_cursor = items[-1].created_at.isoformat() if len(items) == limit else None
    return {
        "items": [
            {
                "id": str(item.id),
                "type": item.type,
                "message": item.message,
                "read": item.read,
                "conversation_id": str(item.conversation_id) if item.conversation_id else None,
                "scenario_session_id": str(item.scenario_session_id) if item.scenario_session_id else None,
                "created_at": item.created_at.isoformat(),
            }
            for item in items
        ],
        "next_cursor": next_cursor,
    }


@router.post("/read")
def read_notifications(
    payload: Dict[str, List[str]],
    db: Session = Depends(get_db),
    user: Dict = Depends(get_current_user),
):
    ids = payload.get("ids", [])
    if not ids:
        return {"updated": 0}
    user_id = parse_uuid(user.get("sub", ""))
    notification_ids = [parse_uuid(value) for value in ids]
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.id.in_(notification_ids))
        .update({Notification.read: True}, synchronize_session=False)
    )
    db.commit()
    return {"updated": updated}


@router.post("", status_code=201)
async def create_notification(
    payload: Dict[str, str | None],
    request: Request,
    db: Session = Depends(get_db),
    user: Dict = Depends(get_current_user),
):
    message = payload.get("message")
    if not message or not message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="message is required")
    notification = Notification(
        user_id=parse_uuid(user.get("sub", "")),
        type=payload.get("type") or "info",
        message=message.strip(),
        conversation_id=parse_uuid(payload["conversation_id"]) if payload.get("conversation_id") else None,
        scenario_session_id=parse_uuid(payload["scenario_session_id"]) if payload.get("scenario_session_id") else None,
        read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    bus: NotificationEventBus = request.app.state.notification_bus
    await bus.publish(
        str(notification.user_id),
        {
            "id": str(notification.id),
            "type": notification.type,
            "message": notification.message,
            "read": notification.read,
            "conversation_id": str(notification.conversation_id) if notification.conversation_id else None,
            "scenario_session_id": str(notification.scenario_session_id) if notification.scenario_session_id else None,
            "created_at": notification.created_at.isoformat(),
        },
    )
    return {
        "id": str(notification.id),
        "type": notification.type,
        "message": notification.message,
        "read": notification.read,
        "conversation_id": str(notification.conversation_id) if notification.conversation_id else None,
        "scenario_session_id": str(notification.scenario_session_id) if notification.scenario_session_id else None,
        "created_at": notification.created_at.isoformat(),
    }


@router.delete("/{notification_id}", status_code=204)
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    user: Dict = Depends(get_current_user),
):
    notification_uuid = parse_uuid(notification_id)
    user_id = parse_uuid(user.get("sub", ""))
    deleted = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.id == notification_uuid)
        .delete()
    )
    if deleted:
        db.commit()
    return None


@router.get("/stream")
async def stream_notifications(
    request: Request,
    db: Session = Depends(get_db),
):
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1]
    if not token:
        token = request.query_params.get("token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token.")
    user = decode_access_token(token)
    bus: NotificationEventBus = request.app.state.notification_bus
    user_id = str(parse_uuid(user.get("sub", "")))
    queue = await bus.subscribe(user_id)

    async def event_stream():
        try:
            items = (
                db.query(Notification)
                .filter(Notification.user_id == UUID(user_id))
                .order_by(Notification.created_at.desc())
                .limit(20)
                .all()
            )
            snapshot_payload = {
                "items": [
                    {
                        "id": str(item.id),
                        "type": item.type,
                        "message": item.message,
                        "read": item.read,
                        "conversation_id": str(item.conversation_id) if item.conversation_id else None,
                        "scenario_session_id": str(item.scenario_session_id) if item.scenario_session_id else None,
                        "created_at": item.created_at.isoformat(),
                    }
                    for item in items
                ]
            }
            yield f"event: snapshot\ndata: {json.dumps(snapshot_payload)}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                payload = await queue.get()
                yield f"event: notification\ndata: {json.dumps(payload)}\n\n"
        finally:
            await bus.unsubscribe(user_id, queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )
