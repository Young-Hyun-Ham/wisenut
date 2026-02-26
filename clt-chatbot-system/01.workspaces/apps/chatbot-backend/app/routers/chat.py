import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.security import get_current_user
from app.db.deps import get_db
from app.repositories.chat_repository import ChatRepository
from app.schemas import ChatRequestApi
from app.services.chat_service import ChatService
from app.services.flowise_client import FlowiseClient

import logging

router = APIRouter(dependencies=[Depends(get_current_user)])
chat_service = ChatService(FlowiseClient(), ChatRepository())

logger = logging.getLogger(__name__)

@router.post("/api/chat")
def chat(payload: ChatRequestApi, db=Depends(get_db), current_user=Depends(get_current_user)):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user token.")
    try:
        user_uuid = UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid user token.") from exc

    try:
        first, iterator, conversation_id, scenario_session_id = (
            chat_service.create_prediction_stream(payload, db, user_uuid)
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    try:
        if isinstance(first, dict):
            assistant_content = (
                first.get("text")
                or first.get("message")
                or (first.get("data") if isinstance(first.get("data"), str) else None)
            )
            if assistant_content is None:
                assistant_content = json.dumps(first, ensure_ascii=True)
            ChatRepository().save_message(
                db,
                conversation_id=conversation_id,
                user_id=user_uuid,
                sender="assistant",
                content=assistant_content,
                message_type="llm",
                scenario_session_id=scenario_session_id,
                meta=first,
            )
            return JSONResponse(first)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Invalid response from Flowise.") from exc

    def stream():
        buffer = ""
        collected = []
        yield first
        for chunk in iterator:
            buffer += chunk
            lines = buffer.split("\n")
            buffer = lines.pop() or ""
            for line in lines:
                if not line.strip() or line.lower().startswith("message:"):
                    continue
                if line.lower().startswith("data:"):
                    json_str = line[line.index(":") + 1 :].strip()
                else:
                    json_str = line.strip()
                if not json_str or json_str == "[DONE]":
                    continue
                try:
                    data = json.loads(json_str)
                except json.JSONDecodeError:
                    buffer = line + ("\n" + buffer if buffer else "")
                    continue
                if data.get("event") == "token" and isinstance(data.get("data"), str):
                    collected.append(data["data"])
                elif data.get("event") == "chunk" and isinstance(
                    data.get("data", {}).get("response"), str
                ):
                    collected.append(data["data"]["response"])
            yield chunk

        assistant_content = "".join(collected).strip()
        ChatRepository().save_message(
            db,
            conversation_id=conversation_id,
            user_id=user_uuid,
            sender="assistant",
            content=assistant_content,
            message_type="llm_stream",
            scenario_session_id=scenario_session_id,
            meta={"streaming": True},
        )

    return StreamingResponse(stream(), media_type="text/event-stream")
