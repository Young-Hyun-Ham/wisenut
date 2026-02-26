from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.db.models import AdminSetting

GLOBAL_DEFAULT: Dict[str, Any] = {"theme": "light", "locale": "ko", "llmProvider": "flowise"}
NODE_COLORS_DEFAULT: Dict[str, Any] = {"colors": {"default": "#EDEDED", "action": "#FFD54F"}}
NODE_TEXT_COLORS_DEFAULT: Dict[str, Any] = {"colors": {"default": "#1F2933"}}
NODE_VISIBILITY_DEFAULT: Dict[str, Any] = {"visibleNodeTypes": 
                                           [
                                               "start", 
                                               "action", 
                                               "response",
                                               "api",
                                               "message",
                                               "branch",
                                               "setSlot",
                                               "delay",
                                               "fixedmenu",
                                               "link",
                                               "iframe",
                                               "form",
                                               "scenario"
                                            ]
                                        }
SCENARIO_CATEGORIES_DEFAULT: list[Dict[str, Any]] = []


class SettingsRepository:
    def __init__(self, db: Session):
        self.db = db

    def _get_raw(self, key: str, default: Any) -> Any:
        row = self.db.get(AdminSetting, key)
        if not row:
            row = AdminSetting(key=key, value=deepcopy(default), updated_at=datetime.utcnow())
            self.db.add(row)
            self.db.commit()
            self.db.refresh(row)
        return row.value

    def _upsert_raw(self, key: str, payload: Any) -> Any:
        row = self.db.get(AdminSetting, key)
        if not row:
            row = AdminSetting(key=key, value=payload, updated_at=datetime.utcnow())
            self.db.add(row)
        else:
            row.value = payload
            row.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(row)
        return row.value

    def get_global(self) -> Dict[str, Any]:
        return self._get_raw("global_settings", GLOBAL_DEFAULT)

    def update_global(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._upsert_raw("global_settings", payload)

    def get_node_colors(self) -> Dict[str, Any]:
        return self._get_raw("node_colors", NODE_COLORS_DEFAULT)

    def update_node_colors(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._upsert_raw("node_colors", payload)

    def get_node_text_colors(self) -> Dict[str, Any]:
        return self._get_raw("node_text_colors", NODE_TEXT_COLORS_DEFAULT)

    def update_node_text_colors(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._upsert_raw("node_text_colors", payload)

    def get_node_visibility(self) -> Dict[str, Any]:
        return self._get_raw("node_visibility", NODE_VISIBILITY_DEFAULT)

    def update_node_visibility(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._upsert_raw("node_visibility", payload)

    def get_scenario_categories(self) -> list[Dict[str, Any]]:
        return self._get_raw("scenario_categories", SCENARIO_CATEGORIES_DEFAULT)

    def update_scenario_categories(self, payload: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        return self._upsert_raw("scenario_categories", payload)
