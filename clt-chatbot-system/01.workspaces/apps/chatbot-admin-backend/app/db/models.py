from __future__ import annotations

from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from .base import Base


class ScenarioCategory(Base):
    __tablename__ = "scenario_category"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Scenario(Base):
    __tablename__ = "scenario"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    job = Column(String)
    version = Column(String)
    category_id = Column(String, ForeignKey("scenario_category.id"))
    nodes = Column(JSONB, nullable=False, server_default=sa.text("'[]'::jsonb"))
    edges = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used_at = Column(DateTime(timezone=True))


class AdminTemplate(Base):
    __tablename__ = "admin_template"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    template_type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    nodes = Column(JSONB, nullable=False, server_default=sa.text("'[]'::jsonb"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ApiTemplate(Base):
    __tablename__ = "api_template"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_id = Column(UUID(as_uuid=True), nullable=True)
    name = Column(String, nullable=False)
    method = Column(String, nullable=False)
    url = Column(String, nullable=False)
    headers = Column(JSONB, nullable=True)
    body = Column(JSONB, nullable=True)
    response_mapping = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class FormTemplate(Base):
    __tablename__ = "form_template"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_id = Column(UUID(as_uuid=True), nullable=True)
    name = Column(String, nullable=False)
    elements = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class AdminSetting(Base):
    __tablename__ = "admin_setting"

    key = Column(String, primary_key=True, index=True)
    value = Column(JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class AdminPost(Base):
    __tablename__ = "admin_post"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    author = Column(String, nullable=False, default="admin")
    author_id = Column(String, nullable=False, default="admin")
    author_photo_url = Column(String)
    text = Column(Text, nullable=False)
    file_url = Column(String)
    file_name = Column(String)
    file_type = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
