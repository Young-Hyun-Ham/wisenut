from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field


class User(BaseModel):
    id: str
    name: str
    role: str


class TokenResponse(BaseModel):
    user: User
    access_token: str
    expires_in: int


class ScenarioSummary(BaseModel):
    id: str
    title: str
    description: Optional[str] = None


class ScenarioDetail(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    nodes: List[Dict[str, Any]] = Field(default_factory=list)
    edges: List[Dict[str, Any]] = Field(default_factory=list)


class ScenarioNamePayload(BaseModel):
    name: str
    description: Optional[str] = None


class ScenarioSubCategory(BaseModel):
    id: str
    title: str
    items: List[ScenarioSummary] = Field(default_factory=list)


class ScenarioCategory(BaseModel):
    id: str
    title: str
    subCategories: List[ScenarioSubCategory] = Field(default_factory=list)


TemplateType = Literal["api", "form"]
class TemplateBase(BaseModel):
    id: Optional[str] = None
    template_type: TemplateType
    name: str


# API 템플릿
class ApiTemplate(TemplateBase):
    template_type: Literal["api"] = "api"
    method: str
    url: str
    headers: Optional[Dict[str, Any]] = Field(default_factory=dict)
    body: Optional[Dict[str, Any]] = Field(default_factory=dict)
    response_mapping: List[Dict[str, Any]] = Field(default_factory=list, alias="responseMapping")


# Form 템플릿
class FormTemplate(TemplateBase):
    template_type: Literal["form"] = "form"
    elements: List[Dict[str, Any]] = Field(default_factory=list)


class Settings(BaseModel):
    theme: str = "light"
    locale: str = "ko"
    llmProvider: str = "flowise"


class NodeColorSettings(BaseModel):
    colors: Dict[str, str] = Field(default_factory=dict)


class NodeTextColorSettings(BaseModel):
    colors: Dict[str, str] = Field(default_factory=dict)


class NodeVisibilitySettings(BaseModel):
    visibleNodeTypes: List[str] = Field(default_factory=list)


class PostBase(BaseModel):
    text: str


class Post(PostBase):
    id: str
    author: str
    authorId: str
    authorPhotoURL: Optional[str] = None
    fileUrl: Optional[str] = None
    fileName: Optional[str] = None
    fileType: Optional[str] = None
    timestamp: str


class PostCreate(PostBase):
    fileId: Optional[str] = None


class PostUpdate(BaseModel):
    text: str


class FileUploadResponse(BaseModel):
    fileId: str
    fileUrl: str
