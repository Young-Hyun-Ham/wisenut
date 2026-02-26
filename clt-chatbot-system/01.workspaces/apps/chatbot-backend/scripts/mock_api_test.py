#!/usr/bin/env python3
"""OpenAPI 기반 chatbot-backend Mock 테스트 스크립트.

- openapi.yaml의 paths를 단순 파싱해 모든 엔드포인트 호출
- Prism mock 서버를 대상으로 수행
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from typing import Dict, List, Tuple
from urllib import request, error

HTTP_METHODS = {"get", "post", "put", "patch", "delete"}
NO_BODY_POST_PATHS = {"/notifications/read-all", "/scenario-sessions/{sessionId}/end"}


def parse_paths(openapi_path: str) -> Dict[str, List[str]]:
    paths: Dict[str, List[str]] = {}
    current_path = None
    in_paths = False

    with open(openapi_path, "r", encoding="utf-8") as f:
        for line in f:
            if not in_paths:
                if line.startswith("paths:"):
                    in_paths = True
                continue

            if in_paths:
                if not line.strip():
                    continue
                indent = len(line) - len(line.lstrip(" "))
                # paths 블록 종료
                if indent == 0:
                    break

                if indent == 2 and line.strip().endswith(":"):
                    current_path = line.strip()[:-1]
                    paths[current_path] = []
                    continue

                if indent == 4 and current_path:
                    key = line.strip()[:-1]
                    if key in HTTP_METHODS:
                        paths[current_path].append(key.upper())

    return paths


def replace_path_params(path: str) -> str:
    return re.sub(r"\{[^/]+\}", "test", path)


def build_query(path: str) -> str:
    if path.startswith("/auth/dev-login"):
        return "?id=test"
    if path.startswith("/search"):
        return "?q=test"
    return ""


def build_json_body(path: str, method: str) -> str | None:
    if method not in {"POST", "PUT", "PATCH"}:
        return None

    if path == "/api/chat":
        return json.dumps({
            "message": {"text": "hello"},
            "scenarioState": None,
            "slots": {},
            "language": "ko",
        })
    if path == "/conversations":
        return json.dumps({"title": "test"})
    if path.endswith("/messages"):
        return json.dumps({"role": "user", "content": "test"})
    if "/messages/" in path:
        return json.dumps({"selectedOption": "test", "feedback": "like"})
    if path == "/scenario-sessions":
        return json.dumps({"scenarioId": "test", "conversationId": "test", "slots": {}})
    if path.startswith("/scenario-sessions/") and path.endswith("/end"):
        return None
    if path.startswith("/scenario-sessions/"):
        return json.dumps({"status": "in_progress", "state": {}, "slots": {}})
    if path == "/favorites":
        return json.dumps({"type": "scenario", "target_id": "test"})
    if path == "/favorites/reorder":
        return json.dumps({"orders": [{"id": "test", "order": 0}]})
    if path.startswith("/notifications/"):
        return json.dumps({"is_read": True})
    if path == "/notifications/read-all":
        return None
    if path == "/settings/user":
        return json.dumps({"theme": "light", "locale": "ko"})
    if path == "/settings/global":
        return json.dumps({"headerTitle": "AI Chatbot"})
    return json.dumps({})


def build_multipart_body() -> Tuple[bytes, str]:
    boundary = "----boundary"
    body = (
        f"--{boundary}\r\n"
        "Content-Disposition: form-data; name=\"file\"; filename=\"test.txt\"\r\n"
        "Content-Type: text/plain\r\n\r\n"
        "test\r\n"
        f"--{boundary}--\r\n"
    )
    return body.encode("utf-8"), f"multipart/form-data; boundary={boundary}"


def call_endpoint(base_url: str, path: str, method: str, token: str) -> Tuple[int, str]:
    url = f"{base_url}{replace_path_params(path)}{build_query(path)}"
    headers = {"Authorization": f"Bearer {token}"}

    data = None
    content_type = None

    if path == "/files" and method == "POST":
        data, content_type = build_multipart_body()
    else:
        if method == "POST" and path in NO_BODY_POST_PATHS:
            data = b""
            content_type = None
            headers["Content-Length"] = "0"
        else:
            body = build_json_body(path, method)
            if body is not None:
                data = body.encode("utf-8")
                content_type = "application/json"

    if content_type:
        headers["Content-Type"] = content_type

    req = request.Request(url, data=data, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=10) as resp:
            payload = resp.read().decode("utf-8")
            return resp.status, payload
    except error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return 0, str(e)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--openapi", default="../openapi.yaml")
    parser.add_argument("--base", default="http://localhost:4010")
    parser.add_argument("--token", default="test")
    args = parser.parse_args()

    paths = parse_paths(args.openapi)
    if not paths:
        print("No paths found in openapi.yaml", file=sys.stderr)
        return 1

    results = []
    for path, methods in sorted(paths.items()):
        for method in methods:
            status, payload = call_endpoint(args.base, path, method, args.token)
            results.append((method, path, status, payload))

    for method, path, status, payload in results:
        print(f"{method} {path} -> {status}")
        if status >= 400 or status == 0:
            print(payload)

    failed = [r for r in results if r[2] >= 400 or r[2] == 0]
    print(f"\nTotal: {len(results)}, Failed: {len(failed)}")
    return 0 if not failed else 2


if __name__ == "__main__":
    raise SystemExit(main())
