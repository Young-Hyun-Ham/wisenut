import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Tuple


@dataclass(frozen=True)
class ScenarioData:
    data: Dict
    mtime: float


class ScenarioNotFound(Exception):
    pass


class ScenarioRepository:
    def __init__(self, base_dir: Path | None = None) -> None:
        self._base_dir = base_dir or Path(__file__).resolve().parents[1]

    def get_scenario(self, scenario_id: str) -> ScenarioData:
        file_path = self._base_dir / "data" / f"{scenario_id}.json"
        if not file_path.exists():
            raise ScenarioNotFound(f"scenario not found: {file_path}")
        with open(file_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
        return ScenarioData(data=raw_data, mtime=file_path.stat().st_mtime)
