from collections.abc import Generator
from typing import Protocol

from app.services.flowise_service import PredictionData


class LlmService(Protocol):
    def create_prediction(self, data: PredictionData) -> Generator[str, None, None]:
        ...
