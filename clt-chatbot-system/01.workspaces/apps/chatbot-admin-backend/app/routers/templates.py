from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.deps import get_db
from pydantic import BaseModel, Field
from app.repositories.templates import TemplateRepository
from app.schemas import (
    ApiTemplate,
    FormTemplate,
)

router = APIRouter(prefix="/templates", tags=["Templates"])

class ApiTemplatePatch(BaseModel):
    name: Optional[str] = None
    method: Optional[str] = None
    url: Optional[str] = None
    headers: Optional[Dict[str, Any]] = None
    body: Optional[Dict[str, Any]] = None
    response_mapping: Optional[Dict[str, Any]] = None


class FormTemplatePatch(BaseModel):
    name: Optional[str] = None
    elements: Optional[List[Dict[str, Any]]] = None


def _to_api_template(row: Any) -> ApiTemplate:
    return ApiTemplate(
        id=str(row.id),
        template_type="api",
        name=row.name,
        method=row.method,
        url=row.url,
        headers=row.headers or {},
        body=row.body or {},
        responseMapping=row.response_mapping or [],
    )


def _to_form_template(row: Any) -> FormTemplate:
    return FormTemplate(
        id=str(row.id),
        template_type="form",
        name=row.name,
        elements=row.elements or [],
    )


def _payload_to_dict(payload: BaseModel) -> Dict[str, Any]:
    # PATCH에서 None은 제외하고, unset도 제외
    return payload.model_dump(exclude_unset=True, exclude_none=True)


@router.get("/api", response_model=List[ApiTemplate])
def list_api_templates(db: Session = Depends(get_db)):
    repo = TemplateRepository(db)
    return [_to_api_template(row) for row in repo.list("api")]


@router.post("/api", response_model=ApiTemplate, status_code=status.HTTP_201_CREATED)
def create_api_template(payload: ApiTemplate, db: Session = Depends(get_db)):
    repo = TemplateRepository(db)
    # repo.create_api 시그니처에 맞춰 전달
    row = repo.create(
        "api",
        name=payload.name,
        method=payload.method,
        url=payload.url,
        headers=payload.headers,
        body=payload.body,
        response_mapping=payload.response_mapping,
    )
    return _to_api_template(row)


@router.delete("/api/{templateId}", status_code=status.HTTP_204_NO_CONTENT)
def delete_api_template(templateId: str, db: Session = Depends(get_db)):
    repo = TemplateRepository(db)
    try:
        repo.delete("api", templateId)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found.")


@router.get("/form", response_model=List[FormTemplate])
def list_form_templates(db: Session = Depends(get_db)):
    repo = TemplateRepository(db)
    return [_to_form_template(row) for row in repo.list("form")]


@router.post("/form", response_model=FormTemplate, status_code=status.HTTP_201_CREATED)
def create_form_template(payload: FormTemplate, db: Session = Depends(get_db)):
    repo = TemplateRepository(db)

    # repo.create_form 시그니처에 맞춰 전달 (elements 사용)
    row = repo.create(
        "form",
        name=payload.name,
        elements=payload.elements,
    )
    return _to_form_template(row)


@router.delete("/form/{templateId}", status_code=status.HTTP_204_NO_CONTENT)
def delete_form_template(templateId: str, db: Session = Depends(get_db)):
    repo = TemplateRepository(db)
    try:
        repo.delete("form", templateId)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found.")