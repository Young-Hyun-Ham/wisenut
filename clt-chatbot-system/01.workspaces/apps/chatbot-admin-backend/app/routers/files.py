from __future__ import annotations

from typing import Dict
from uuid import uuid4

from fastapi import APIRouter, HTTPException, UploadFile, status

from app.schemas import FileUploadResponse
from app.stores import FILES, ensure_defaults

router = APIRouter(tags=["Posts"])

ensure_defaults()


@router.post("/files", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
def upload_file(file: UploadFile):
    ensure_defaults()
    file_id = str(uuid4())
    file_url = f"https://files.example.com/{file_id}"
    FILES[file_id] = {"fileId": file_id, "fileUrl": file_url, "fileName": file.filename}
    return FileUploadResponse(fileId=file_id, fileUrl=file_url)


@router.delete("/files/{fileId}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(fileId: str):
    ensure_defaults()
    if fileId not in FILES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found.")
    FILES.pop(fileId)
