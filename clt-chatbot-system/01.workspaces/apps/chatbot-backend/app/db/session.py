import os

from sqlalchemy import create_engine,text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

from .models import Base, create_view, insert_shortcut_data

from . import models  # noqa: F401 (loads models so Base.metadata knows about them)
from .base import Base

def normalize_database_url(url: str) -> str:
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


DATABASE_URL = normalize_database_url(
    os.getenv("DATABASE_URL", "postgresql://chatbot:chatbot@localhost:5432/chatbot")
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base.metadata.create_all(bind=engine)

# 데이터 생성 로직 변경
def setup_db(engine):
    Base.metadata.create_all(bind=engine)

    # 뷰 생성 및 데이터 삽입 시, 이미 생성되어있으면 스킵,
    with engine.begin() as conn:
        try:
            conn.execute(text(create_view))
            print("View created or updated successfully.")
        except SQLAlchemyError as e:
            print(f"View creation skipped or failed: {e}")

        try:
            conn.execute(text(insert_shortcut_data))
            print("Initial data inserted successfully.")
        except SQLAlchemyError as e:
            print(f"Data insertion skipped: {e}")

setup_db(engine)