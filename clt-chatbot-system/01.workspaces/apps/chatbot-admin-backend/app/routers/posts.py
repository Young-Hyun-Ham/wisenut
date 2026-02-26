from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.db.models import AdminPost
from app.repositories.posts import PostRepository
from app.schemas import Post, PostCreate, PostUpdate

router = APIRouter(tags=["Posts"])


def _to_schema(post_row: AdminPost) -> Post:
    return Post(
        id=str(post_row.id),
        author=post_row.author,
        authorId=post_row.author_id,
        authorPhotoURL=post_row.author_photo_url,
        text=post_row.text,
        fileUrl=post_row.file_url,
        fileName=post_row.file_name,
        fileType=post_row.file_type,
        timestamp=post_row.created_at.isoformat(),
    )


@router.get("/posts", response_model=List[Post])
def list_posts(db: Session = Depends(get_db)):
    repo = PostRepository(db)
    return [_to_schema(row) for row in repo.list()]


@router.post("/posts", response_model=Post, status_code=status.HTTP_201_CREATED)
def create_post(payload: PostCreate, db: Session = Depends(get_db)):
    repo = PostRepository(db)
    row = repo.create(text=payload.text)
    return _to_schema(row)


@router.patch("/posts/{postId}", response_model=Post)
def update_post(postId: str, payload: PostUpdate, db: Session = Depends(get_db)):
    repo = PostRepository(db)
    try:
        row = repo.update(postId, payload.text)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found.")
    return _to_schema(row)


@router.delete("/posts/{postId}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(postId: str, db: Session = Depends(get_db)):
    repo = PostRepository(db)
    try:
        repo.delete(postId)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found.")
