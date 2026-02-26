from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.db.models  # noqa: F401
from app.core.config import DATABASE_URL
from app.db.base import Base

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False, future=True)

Base.metadata.create_all(bind=engine)
