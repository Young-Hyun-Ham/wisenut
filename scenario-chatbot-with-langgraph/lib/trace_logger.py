from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

_WRITE_LOCK = Lock()
_BASE_DIR = Path(__file__).resolve().parents[1]
_DEFAULT_TRACE_PATH = _BASE_DIR / "data" / "run_trace.jsonl"
_DEFAULT_EVENTS_PATH = _BASE_DIR / "data" / "run_events.jsonl"


def _utc_iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_path(env_key: str, default_path: Path) -> Path:
    raw = os.environ.get(env_key)
    return Path(raw) if raw else default_path


def _append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        line = json.dumps(payload, ensure_ascii=False)
        with _WRITE_LOCK:
            with path.open("a", encoding="utf-8") as f:
                f.write(line + "\n")
    except Exception:
        # Trace/event logging must not break chat serving path.
        return


def append_trace(
    *,
    run_id: str,
    thread_id: str | None,
    status: str,
    duration_ms: int | None = None,
    node: str | None = None,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    model: str | None = None,
    error: str | None = None,
) -> None:
    payload = {
        "ts": _utc_iso_now(),
        "run_id": run_id,
        "thread_id": thread_id,
        "status": status,
        "duration_ms": duration_ms,
        "node": node,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "model": model,
        "error": error,
    }
    _append_jsonl(_resolve_path("LANGGRAPH_TRACE_PATH", _DEFAULT_TRACE_PATH), payload)


def append_event(
    *,
    run_id: str,
    event_type: str,
    node: str | None = None,
    payload: dict[str, Any] | None = None,
    latency_ms: int | None = None,
    level: str = "info",
) -> None:
    record = {
        "ts": _utc_iso_now(),
        "run_id": run_id,
        "event_type": event_type,
        "node": node,
        "payload": payload,
        "latency_ms": latency_ms,
        "level": level,
    }
    _append_jsonl(_resolve_path("LANGGRAPH_EVENTS_PATH", _DEFAULT_EVENTS_PATH), record)
