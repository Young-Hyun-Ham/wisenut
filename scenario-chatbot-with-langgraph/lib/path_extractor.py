import re
from typing import Any


def extract_path(data: Any, path: str) -> Any:
    if data is None or not path:
        return None

    current = data
    parts = path.split(".")
    for part in parts:
        if not part:
            continue
        name_match = re.match(r"^([^\[]+)", part)
        if name_match:
            key = name_match.group(1)
            if not isinstance(current, dict) or key not in current:
                return None
            current = current[key]

        for index_match in re.finditer(r"\[(\d+)\]", part):
            if not isinstance(current, list):
                return None
            idx = int(index_match.group(1))
            if idx < 0 or idx >= len(current):
                return None
            current = current[idx]

    return current
