from collections.abc import Generator
from dataclasses import dataclass, field
import logging

import requests


@dataclass
class FlowiseSettings:
    BASE_URL: str = "http://202.20.84.65:3003"
    ORCHESTRATION_ID: str = "308a9cb7-a2e6-41ec-a498-00bff4b9eba8"
    CONNECT_TIMEOUT: float = 5.0
    READ_TIMEOUT: float = 30.0


@dataclass
class Settings:
    flowise: FlowiseSettings = field(default_factory=FlowiseSettings)


settings = Settings()
logger = logging.getLogger(__name__)


@dataclass
class IFileUpload:
    """
    IFileUpload
    """

    data: str | None
    type: str
    name: str
    mime: str


@dataclass
class IMessage:
    """
    IMessage
    """

    message: str
    type: str
    role: str | None = None
    content: str | None = None


@dataclass
class PredictionData:
    """
    PredictionData
    """

    question: str
    chatflowId: str | None = None
    overrideConfig: dict | None = None
    chatId: str | None = None
    streaming: bool = False
    history: list[IMessage] | None = None
    slots: dict | None = None
    # uploads: list[IFileUpload] | None = None


class Flowise:
    """
    Flowise client
    """

    def _get_headers(self) -> dict[str, str]:
        headers = {}
        # if self.api_key:
        #     headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def create_prediction(
        self,
        data: PredictionData,
    ) -> Generator[str, None, None]:
        """
        fetch prediction
        """

        if not data.chatflowId:
            data.chatflowId = settings.flowise.ORCHESTRATION_ID

        # Step 1: Check if chatflow is available for streaming
        chatflow_stream_url = (
            f"{settings.flowise.BASE_URL}/api/v1/chatflows-streaming/{data.chatflowId}"
        )
        response = requests.get(chatflow_stream_url)
        response.raise_for_status()

        chatflow_stream_data = response.json()
        is_streaming_available = chatflow_stream_data.get("isStreaming", False)

        prediction_url = (
            f"{settings.flowise.BASE_URL}/api/v1/prediction/{data.chatflowId}"
        )

        # Step 2: Handle streaming prediction
        if is_streaming_available and data.streaming:
            slots = data.slots or {}
            ten_id = slots.get("ten_id") or slots.get("tenId")
            stg_id = slots.get("stg_id") or slots.get("stgId")
            prediction_payload = {
                "chatflowId": data.chatflowId,
                "question": data.question,
                "overrideConfig": data.overrideConfig,
                "chatId": data.chatId,
                "streaming": data.streaming,
                "history": [msg.__dict__ for msg in (data.history or [])],
                # "uploads": [upload.__dict__ for upload in (data.uploads or [])],
            }
            if ten_id is not None:
                prediction_payload["ten_id"] = ten_id
            if stg_id is not None:
                prediction_payload["stg_id"] = stg_id

            with requests.post(
                prediction_url,
                json=prediction_payload,
                stream=True,
                headers=self._get_headers(),
                timeout=(
                    settings.flowise.CONNECT_TIMEOUT,
                    settings.flowise.READ_TIMEOUT,
                ),
            ) as r:
                r.raise_for_status()
                for line in r.iter_lines():
                    if line:
                        line_str = line.decode("utf-8")
                        logger.debug(line_str)
                        if line_str.startswith("data:"):
                            yield f"message:\n{line_str}\n\n"

        # Step 3: Handle non-streaming prediction
        else:
            prediction_payload = {
                "chatflowId": data.chatflowId,
                "question": data.question,
                "overrideConfig": data.overrideConfig,
                "chatId": data.chatId,
                "history": [msg.__dict__ for msg in (data.history or [])],
            }

            response = requests.post(
                prediction_url,
                json=prediction_payload,
                headers=self._get_headers(),
            )
            response.raise_for_status()
            yield response.json()
