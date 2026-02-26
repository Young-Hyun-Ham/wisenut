from __future__ import annotations

from typing import List, Literal, Optional, Type
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db.models import ApiTemplate, FormTemplate

TemplateType = Literal["api", "form"]
TEMPLATE_MODEL_MAP: dict[str, Type] = {
    "api": ApiTemplate,
    "form": FormTemplate,
}

class TemplateRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self, template_type: TemplateType):
        model = TEMPLATE_MODEL_MAP.get(template_type)
        if not model:
            raise ValueError(f"Unsupported template_type: {template_type}")

        return (
            self.db.query(model)
            .order_by(model.updated_at.desc())
            .all()
        )
    
    
    def create_api(
        self,
        *,
        name: str,
        method: str,
        url: str,
        headers: dict | None = None,
        body: dict | None = None,
        response_mapping: dict | None = None,
    ) -> ApiTemplate:
        template = ApiTemplate(
            id=uuid4(),
            name=name,
            method=method,
            url=url,
            headers=headers or {},
            body=body or {},
            response_mapping=response_mapping or [],
        )
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        return template
    
    def create_form(
        self, 
        *, 
        name: str, 
        elements: Optional[List[dict]]
    ) -> FormTemplate:
        template = FormTemplate(
            id=uuid4(),
            name=name,
            elements=elements or [],
        )
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        return template

    def create(self, template_type: TemplateType, **kwargs):
        if template_type == "api":
            return self.create_api(**kwargs)
        if template_type == "form":
            return self.create_form(**kwargs)
        raise ValueError("Invalid template_type")


    def delete(self, template_type: TemplateType, template_id: str) -> None:
        model = TEMPLATE_MODEL_MAP.get(template_type)
        if not model:
            raise ValueError(f"Unsupported template_type: {template_type}")

        template = self.db.query(model).filter_by(id=template_id).first()
        if not template:
            raise ValueError("Template not found.")

        self.db.delete(template)
        self.db.commit()
