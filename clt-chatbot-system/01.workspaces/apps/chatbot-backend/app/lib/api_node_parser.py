import json
from typing import Dict

from app.lib.dto.api_node import ApiNodeData


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
