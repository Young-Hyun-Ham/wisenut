from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, model_validator


class ChatMessage(BaseModel):
    text: str = Field(..., min_length=1)


class ChatRequestApi(BaseModel):
    message: ChatMessage | None = None
    content: str | None = None
    conversation_id: str | None = None
    slots: dict[str, Any] = Field(default_factory=dict)
    language: str | None = None
    scenarioSessionId: str | None = None

    @model_validator(mode="after")
    def ensure_content(self):
        if self.message and self.message.text:
            return self
        if self.content:
            return self
        raise ValueError("Either message.text or content must be provided.")

class ScenarioSummary(BaseModel):
    id: str
    title: str
    description: Optional[str] = None


class SubCategoryItemAction(BaseModel):
    type: str
    value: str

class ShortcutSubCategoryItem(BaseModel):
    title: str
    description: str
    action: SubCategoryItemAction

class ShortcutItem(BaseModel):
    title: str
    items: list[ShortcutSubCategoryItem]

class Shortcut(BaseModel):
    name: str
    subCategories: list[ShortcutItem]