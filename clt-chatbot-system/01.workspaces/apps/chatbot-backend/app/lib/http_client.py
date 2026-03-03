import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Tuple

import httpx


def _is_mock_enabled() -> bool:
    # return os.getenv("MOCK_API", "").lower() in {"1", "true", "yes"}
    return True


def _mock_index_path() -> Path:
    env_path = os.getenv("MOCK_INDEX_PATH")
    if env_path:
        return Path(env_path)
    return Path(__file__).resolve().parents[1] / "data" / "mock_api" / "index.json"


@lru_cache
def _load_mock_index(path_str: str) -> Dict[str, str]:
    path = Path(path_str)
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, dict) else {}


def _load_mock_response(index_path: Path, url: str) -> Tuple[int, Any]:
    index = _load_mock_index(str(index_path))
    rel_path = index.get(url)
    if not rel_path:
        return 503, {"error": "mock mapping not found", "url": url}

    response_path = (index_path.parent / rel_path).resolve()
    if not response_path.exists():
        return 503, {
            "error": "mock response not found",
            "url": url,
            "path": str(response_path),
        }
    with open(response_path, "r", encoding="utf-8") as f:
        return 200, json.load(f)


def http_request(
    method: str, url: str, headers: Dict[str, Any] | None, body: Any
) -> Tuple[int, Any]:
    if _is_mock_enabled():
        return _load_mock_response(_mock_index_path(), url)

    with httpx.Client(timeout=30) as client:
        if isinstance(body, (dict, list)):
            response = client.request(method, url, headers=headers, json=body)
        else:
            response = client.request(method, url, headers=headers, content=body)

    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type:
        return response.status_code, response.json()
    try:
        return response.status_code, response.json()
    except ValueError:
        return response.status_code, response.text
