# API 노드 DTO + 데이터 파싱 설계

## 목표
- `node.data`를 엄격한 DTO로 변환한다.
- 필수 필드 및 기본값을 검증한다.
- 템플릿 치환과 응답 매핑을 전송 로직과 분리한다.

## DTO 스키마 (Pydantic)
```python
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

class ResponseMapping(BaseModel):
    slot: str
    path: str

class ApiNodeData(BaseModel):
    id: str
    method: str = "POST"
    url: str
    headers: Dict[str, Any] = Field(default_factory=dict)
    body: Optional[str] = None
    responseMapping: List[ResponseMapping] = Field(default_factory=list)
    errorMappingEnabled: bool = False
    isMulti: bool = False
```

## 파싱 로직
```python
import json
from typing import Dict
from lib.dto.api_node import ApiNodeData

def parse_api_node_data(raw: Dict) -> ApiNodeData:
    headers = raw.get("headers") or {}
    if isinstance(headers, str):
        headers = json.loads(headers)

    parsed = {
        "id": raw.get("id"),
        "method": raw.get("method", "POST"),
        "url": raw.get("url"),
        "headers": headers,
        "body": raw.get("body"),
        "responseMapping": raw.get("responseMapping", []),
        "errorMappingEnabled": raw.get("errorMappingEnabled", False),
        "isMulti": raw.get("isMulti", False),
    }
    return ApiNodeData.model_validate(parsed)
```

## 템플릿 치환 (slot 기반)
```python
import re

def render_template(text: str, slot: dict) -> str:
    def repl(match):
        key = match.group(1).strip()
        return str(slot.get(key, ""))
    return re.sub(r"\\{\\{([^}]+)\\}\\}", repl, text or "")
```

## 노드 실행 흐름 (의사코드)
```python
from lib.api_node_parser import parse_api_node_data
from lib.template import render_template

def _call_api_node(state, raw_data):
    dto = parse_api_node_data(raw_data)
    slot = state.get("slot", {})

    headers = dto.headers
    body = render_template(dto.body, slot) if dto.body else None

    # 전송 계층 (httpx/requests)
    resp_json = http_post(dto.url, headers=headers, body=body)

    # responseMapping -> slot 업데이트
    for mapping in dto.responseMapping:
        val = extract_path(resp_json, mapping.path)
        if val is not None:
            slot[mapping.slot] = val

    return {"type": "api", "data": raw_data, "slot": slot}
```

## 필요한 헬퍼 함수
- `http_post`: 요청을 보내고 JSON으로 응답을 파싱
- `extract_path`: `a.b.c` 및 `a[0].b` 형태의 경로 지원
- 에러 정책: 매핑 실패는 기본적으로 스킵

## 참고 사항
- `headers`가 문자열 JSON이면 dict로 변환한다.
- `isMulti`, `apis`는 추후 필요 시 확장 가능하다.
