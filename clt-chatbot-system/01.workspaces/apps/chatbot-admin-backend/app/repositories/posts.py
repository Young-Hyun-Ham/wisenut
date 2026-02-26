from __future__ import annotations

from datetime import datetime
from typing import List

from sqlalchemy.orm import Session

from app.db.models import AdminPost


class PostRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> List[AdminPost]:
        return self.db.query(AdminPost).order_by(AdminPost.created_at.desc()).all()

    def create(self, text: str, author: str = "admin", author_id: str = "admin") -> AdminPost:
        post = AdminPost(
            author=author,
            author_id=author_id,
            text=text,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(post)
        self.db.commit()
        self.db.refresh(post)
        return post

    def update(self, post_id: str, text: str) -> AdminPost:
        post = self.db.get(AdminPost, post_id)
        if not post:
            raise ValueError("Post not found.")
        post.text = text
        post.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(post)
        return post

    def delete(self, post_id: str) -> None:
        post = self.db.get(AdminPost, post_id)
        if not post:
            raise ValueError("Post not found.")
        self.db.delete(post)
        self.db.commit()
