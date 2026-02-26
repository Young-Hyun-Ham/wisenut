import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.deps import get_db
from app.db.models import User

router = APIRouter(prefix="/auth")


@router.get("/dev-login")
def dev_login(id: str, db: Session = Depends(get_db)):
    if os.getenv("ENABLE_DEV_LOGIN", "false").lower() != "true":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="dev-login is disabled.",
        )
    if not id or not id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="id is required.",
        )
    user_id = id.strip()
    user_row = db.query(User).filter(User.name == user_id).first()
    if user_row is None:
        user_row = User(name=user_id, role="user", status="active")
        db.add(user_row)
        db.commit()
        db.refresh(user_row)
    user = {"id": str(user_row.id), "name": user_row.name, "role": user_row.role}
    token = create_access_token({"sub": user["id"], "name": user["name"], "role": user["role"]})
    return {"user": user, "access_token": token, "expires_in": int(os.getenv("JWT_EXPIRES_IN", "3600"))}
