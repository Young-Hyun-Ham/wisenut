import uuid

from sqlalchemy.orm import Session

from app.db.models import Conversation, Message


class ChatRepository:
    def get_conversation(self, db: Session, conversation_id: uuid.UUID, user_id: uuid.UUID):
        return (
            db.query(Conversation)
            .filter(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
            )
            .first()
        )

    def create_conversation(
        self,
        db: Session,
        user_id: uuid.UUID,
        title: str | None,
    ) -> Conversation:
        conversation = Conversation(user_id=user_id, title=title)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        return conversation

    def save_message(
        self,
        db: Session,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        sender: str,
        content: str,
        message_type: str,
        scenario_session_id: uuid.UUID | None,
        meta: dict | None,
    ) -> Message:
        message = Message(
            conversation_id=conversation_id,
            user_id=user_id,
            sender=sender,
            content=content,
            type=message_type,
            scenario_session_id=scenario_session_id,
            meta=meta,
        )
        db.add(message)
        db.commit()
        db.refresh(message)
        return message
