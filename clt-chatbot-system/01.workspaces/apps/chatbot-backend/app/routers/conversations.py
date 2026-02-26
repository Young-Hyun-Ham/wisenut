import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.deps import get_db
from app.db.models import Conversation, Message, ScenarioSession

router = APIRouter(dependencies=[Depends(get_current_user)])


def _get_user_uuid(current_user: dict) -> uuid.UUID:
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user token.")
    try:
        return uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid user token.") from exc


def _conversation_or_404(
    db: Session, conversation_id: uuid.UUID, user_id: uuid.UUID
) -> Conversation:
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user_id)
        .first()
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conversation


@router.get("/conversations")
def list_conversations(
    offset: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    user_id = _get_user_uuid(current_user)
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(convo.id),
            "title": convo.title,
            "pinned": convo.pinned,
            "is_pinned": convo.pinned,
            "created_at": convo.created_at.isoformat() if convo.created_at else None,
            "updated_at": convo.updated_at.isoformat() if convo.updated_at else None,
        }
        for convo in conversations
    ]


@router.post("/conversations", status_code=201)
def create_conversation(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    user_id = _get_user_uuid(current_user)
    title = payload.get("title") or "New Chat"
    conversation = Conversation(user_id=user_id, title=title, pinned=False)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return {
        "id": str(conversation.id),
        "title": conversation.title,
        "pinned": conversation.pinned,
        "is_pinned": conversation.pinned,
        "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
        "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else None,
    }


@router.get("/conversations/{conversationId}")
def get_conversation(
    conversationId: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    user_id = _get_user_uuid(current_user)
    conversation = _conversation_or_404(db, conversationId, user_id)
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return {
        "id": str(conversation.id),
        "title": conversation.title,
        "pinned": conversation.pinned,
        "is_pinned": conversation.pinned,
        "messages": [
            {
                "id": str(message.id),
                "conversation_id": str(message.conversation_id),
                "role": message.sender,
                "content": message.content,
                "created_at": message.created_at.isoformat()
                if message.created_at
                else None,
                "meta": message.meta,
            }
            for message in messages
        ],
    }


@router.patch("/conversations/{conversationId}")
def update_conversation(
    conversationId: uuid.UUID,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    user_id = _get_user_uuid(current_user)
    conversation = _conversation_or_404(db, conversationId, user_id)
    if "title" in payload:
        conversation.title = payload.get("title")
    if "is_pinned" in payload:
        conversation.pinned = bool(payload.get("is_pinned"))
    db.commit()
    db.refresh(conversation)
    return {
        "id": str(conversation.id),
        "title": conversation.title,
        "pinned": conversation.pinned,
        "is_pinned": conversation.pinned,
        "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
        "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else None,
    }


@router.delete("/conversations/{conversationId}", status_code=204)
def delete_conversation(
    conversationId: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Response:
    user_id = _get_user_uuid(current_user)
    conversation = _conversation_or_404(db, conversationId, user_id)
    db.query(ScenarioSession).filter(ScenarioSession.conversation_id == conversation.id).delete()
    db.query(Message).filter(Message.conversation_id == conversation.id).delete()
    db.delete(conversation)
    db.commit()
    return Response(status_code=204)


@router.get("/conversations/{conversationId}/messages")
def list_messages(
    conversationId: uuid.UUID,
    skip: int = 0,
    limit: int = 15,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    user_id = _get_user_uuid(current_user)
    conversation = _conversation_or_404(db, conversationId, user_id)
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(message.id),
            "conversation_id": str(message.conversation_id),
            "role": message.sender,
            "content": message.content,
            "created_at": message.created_at.isoformat()
            if message.created_at
            else None,
            "meta": message.meta,
        }
        for message in messages
    ]


@router.post("/conversations/{conversationId}/messages", status_code=201)
def create_message(
    conversationId: uuid.UUID,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    user_id = _get_user_uuid(current_user)
    conversation = _conversation_or_404(db, conversationId, user_id)
    message = Message(
        conversation_id=conversation.id,
        user_id=user_id,
        sender=payload.get("role") or "user",
        content=payload.get("content") or "",
        type=payload.get("type"),
        scenario_session_id=payload.get("scenario_session_id"),
        meta=payload.get("meta"),
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return {
        "id": str(message.id),
        "conversation_id": str(message.conversation_id),
        "role": message.sender,
        "content": message.content,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "meta": message.meta,
    }


@router.patch("/conversations/{conversationId}/messages/{messageId}")
def update_message(
    conversationId: uuid.UUID,
    messageId: uuid.UUID,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    user_id = _get_user_uuid(current_user)
    _conversation_or_404(db, conversationId, user_id)
    message = (
        db.query(Message)
        .filter(Message.id == messageId, Message.conversation_id == conversationId)
        .first()
    )
    if message is None:
        raise HTTPException(status_code=404, detail="Message not found.")
    meta = message.meta or {}
    if "selectedOption" in payload:
        meta["selectedOption"] = payload.get("selectedOption")
    if "feedback" in payload:
        meta["feedback"] = payload.get("feedback")
    message.meta = meta
    db.commit()
    db.refresh(message)
    return {
        "id": str(message.id),
        "conversation_id": str(message.conversation_id),
        "role": message.sender,
        "content": message.content,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "selectedOption": meta.get("selectedOption"),
        "feedback": meta.get("feedback"),
    }


@router.get("/conversations/{conversationId}/scenario-sessions")
def list_scenario_sessions(
    conversationId: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    user_id = _get_user_uuid(current_user)
    _conversation_or_404(db, conversationId, user_id)
    sessions = (
        db.query(ScenarioSession)
        .filter(ScenarioSession.conversation_id == conversationId)
        .order_by(ScenarioSession.last_active_at.desc().nullslast())
        .all()
    )
    return [
        {
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
            "updatedAt": session.last_active_at.isoformat()
            if session.last_active_at
            else None,
        }
        for session in sessions
    ]
