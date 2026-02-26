from __future__ import annotations

import os
from typing import Callable, Iterable, List


def _envflag(name: str, default: str = "true") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def _normalize_database_url(url: str) -> str:
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


ADMIN_AUTH_REQUIRED = _envflag("ADMIN_AUTH_REQUIRED", "false")
DEV_LOGIN_ENABLED = _envflag("ENABLE_DEV_LOGIN", "false")
DATABASE_URL = _normalize_database_url(
    os.getenv("DATABASE_URL", "postgresql://chatbot:chatbot@localhost:5432/chatbot")
)


def _envlist(name: str, default: str) -> List[str]:
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


CORS_ALLOW_ORIGINS = _envlist(
    "CORS_ALLOW_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://localhost:8100",
)
