import logging
import time
from typing import Iterable, List, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.concurrency import iterate_in_threadpool


def _parse_endpoints(raw: str) -> List[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def _match_endpoint(request: Request, patterns: Iterable[str]) -> bool:
    method = request.method.upper()
    path = request.url.path
    for pattern in patterns:
        pattern = pattern.strip()
        if not pattern:
            continue
        if pattern == "*":
            return True
        if pattern.startswith("METHOD "):
            _, pattern = pattern.split(" ", 1)
        if pattern.upper().startswith(("GET ", "POST ", "PUT ", "PATCH ", "DELETE ")):
            method_part, path_part = pattern.split(" ", 1)
            if method_part.upper() != method:
                continue
            pattern = path_part.strip()
        if pattern.endswith("*") and path.startswith(pattern[:-1]):
            return True
        if path == pattern:
            return True
    return False


def _readable_body(content_type: Optional[str]) -> bool:
    if not content_type:
        return False
    lowered = content_type.lower()
    return (
        "application/json" in lowered
        or "text/" in lowered
        or "application/x-www-form-urlencoded" in lowered
    )


class RequestResponseLoggerMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        *,
        endpoints: List[str],
        max_body_bytes: int = 2000,
    ):
        super().__init__(app)
        self.endpoints = endpoints
        self.max_body_bytes = max_body_bytes
        self.logger = logging.getLogger("reqres")

    async def dispatch(self, request: Request, call_next):
        should_log = _match_endpoint(request, self.endpoints)
        if not should_log:
            return await call_next(request)

        start_time = time.time()

        request_body = b""
        if _readable_body(request.headers.get("content-type")):
            request_body = await request.body()

        response = await call_next(request)

        response_body = b""
        if _readable_body(response.headers.get("content-type")):
            response_body = b"".join([chunk async for chunk in response.body_iterator])
            response.body_iterator = iterate_in_threadpool([response_body])

        duration_ms = int((time.time() - start_time) * 1000)

        self.logger.info(
            "method=%s path=%s status=%s duration_ms=%s request_body=%s response_body=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_body[: self.max_body_bytes].decode("utf-8", errors="replace"),
            response_body[: self.max_body_bytes].decode("utf-8", errors="replace"),
        )

        return response
