import asyncio
from typing import Any, Dict, Set


class NotificationEventBus:
    def __init__(self) -> None:
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, user_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        async with self._lock:
            self._subscribers.setdefault(user_id, set()).add(queue)
        return queue

    async def unsubscribe(self, user_id: str, queue: asyncio.Queue) -> None:
        async with self._lock:
            queues = self._subscribers.get(user_id)
            if not queues:
                return
            queues.discard(queue)
            if not queues:
                self._subscribers.pop(user_id, None)

    async def publish(self, user_id: str, payload: Dict[str, Any]) -> None:
        async with self._lock:
            queues = list(self._subscribers.get(user_id, set()))
        for queue in queues:
            await queue.put(payload)
