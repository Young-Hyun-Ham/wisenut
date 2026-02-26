import asyncio
import contextlib
import json
import os
from typing import Any, Dict, Optional
from uuid import UUID

import psycopg

from app.db.models import Notification
from app.db.session import SessionLocal

from .bus import NotificationEventBus


def normalize_psycopg_dsn(url: str) -> str:
    if url.startswith("postgresql+psycopg://"):
        return url.replace("postgresql+psycopg://", "postgresql://", 1)
    return url


class PgNotifySource:
    def __init__(self, dsn: str, channel: str, bus: NotificationEventBus) -> None:
        self._dsn = normalize_psycopg_dsn(dsn)
        self._channel = channel
        self._bus = bus
        self._task: Optional[asyncio.Task] = None
        self._stopping = asyncio.Event()

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stopping.clear()
        self._task = asyncio.create_task(self._listen())

    async def stop(self) -> None:
        self._stopping.set()
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task

    async def _listen(self) -> None:
        try:
            async with await psycopg.AsyncConnection.connect(self._dsn) as conn:
                await conn.execute(f"LISTEN {self._channel}")
                async for notify in conn.notifies():
                    if self._stopping.is_set():
                        break
                    await self._handle_notify(notify.payload)
        except Exception as exc:
            print(f"PgNotifySource stopped: {exc}")

    async def _handle_notify(self, payload: str) -> None:
        try:
            data: Dict[str, Any] = json.loads(payload)
        except json.JSONDecodeError:
            return
        if data.get("type") != "notification":
            return
        notification_id = data.get("id")
        user_id = data.get("user_id")
        if not notification_id or not user_id:
            return
        notification = self._load_notification(notification_id)
        if not notification:
            await self._bus.publish(str(user_id), data)
            return
        await self._bus.publish(
            str(user_id),
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

    def _load_notification(self, notification_id: str) -> Optional[Notification]:
        try:
            notification_uuid = UUID(notification_id)
        except ValueError:
            return None
        db = SessionLocal()
        try:
            return db.query(Notification).filter(Notification.id == notification_uuid).first()
        finally:
            db.close()


def create_pg_notify_source(bus: NotificationEventBus) -> Optional[PgNotifySource]:
    if os.getenv("NOTIFY_ENABLED", "true").lower() != "true":
        return None
    dsn = os.getenv("DATABASE_URL", "postgresql://chatbot:chatbot@localhost:5432/chatbot")
    channel = os.getenv("NOTIFY_CHANNEL", "chatbot_events")
    return PgNotifySource(dsn=dsn, channel=channel, bus=bus)
