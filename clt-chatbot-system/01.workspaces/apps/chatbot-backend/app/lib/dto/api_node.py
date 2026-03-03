from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


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
