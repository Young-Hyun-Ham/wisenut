import uuid
from collections.abc import Generator

from app.repositories.chat_repository import ChatRepository
from app.schemas import ChatRequestApi
from app.services.flowise_service import PredictionData
from app.services.llm_service import LlmService


class ChatService:
    def __init__(self, llm_client: LlmService, repository: ChatRepository) -> None:
        self._llm_client = llm_client
        self._repository = repository

    def create_prediction_stream(
        self,
        payload: ChatRequestApi,
        db,
        user_id: uuid.UUID,
    ) -> tuple[str | dict, Generator[str, None, None], uuid.UUID, uuid.UUID | None]:
        message_text = self._extract_message_text(payload)
        if not message_text:
            raise ValueError("message.text is required.")

        conversation, scenario_session_id = self._ensure_conversation(
            db, user_id, payload.conversation_id, message_text, payload.scenarioSessionId
        )
        self._repository.save_message(
            db,
            conversation_id=conversation.id,
            user_id=user_id,
            sender="user",
            content=message_text,
            message_type="text",
            scenario_session_id=scenario_session_id,
            meta={"slots": payload.slots, "language": payload.language},
        )

        prediction = PredictionData(
            question=message_text,
            streaming=True,
            slots=payload.slots or {},
        )
        iterator = self._llm_client.create_prediction(prediction)
        try:
            first = next(iterator)
        except StopIteration as exc:
            raise RuntimeError("Empty response from Flowise.") from exc
        return first, iterator, conversation.id, scenario_session_id

    @staticmethod
    def _extract_message_text(payload: ChatRequestApi) -> str:
        if payload.message and payload.message.text:
            return payload.message.text
        if payload.content:
            return payload.content
        return ""

    def _ensure_conversation(
        self,
        db,
        user_id: uuid.UUID,
        conversation_id: str | None,
        message_text: str,
        scenario_session_id: str | None,
    ):
        conversation_uuid = self._parse_uuid(conversation_id)
        if conversation_id and not conversation_uuid:
            raise ValueError("Invalid conversation_id.")
        scenario_session_uuid = self._parse_uuid(scenario_session_id)

        if conversation_uuid:
            conversation = self._repository.get_conversation(db, conversation_uuid, user_id)
            if conversation is None:
                raise ValueError("Conversation not found.")
        else:
            title = message_text[:40] if message_text else "새 대화"
            conversation = self._repository.create_conversation(db, user_id, title)

        return conversation, scenario_session_uuid

    @staticmethod
    def _parse_uuid(value: str | None) -> uuid.UUID | None:
        if not value:
            return None
        try:
            return uuid.UUID(value)
        except ValueError:
            return None
