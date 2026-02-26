from collections.abc import Generator

from app.services.flowise_service import Flowise, PredictionData


class FlowiseClient:
    def __init__(self) -> None:
        self._client = Flowise()

    def create_prediction(self, data: PredictionData) -> Generator[str, None, None]:
        return self._client.create_prediction(data)
