import os
from fastapi import APIRouter, HTTPException, status

from app.core.config import DEV_LOGIN_ENABLED
from app.core.security import create_access_token

router = APIRouter(prefix="/auth")


@router.post("/admin-login")
def admin_login(payload: dict):
    if not DEV_LOGIN_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev login is disabled.",
        )
    username = payload.get("username")
    password = payload.get("password")
    expected_user = os.getenv("ADMIN_USERNAME", "admin")
    expected_pass = os.getenv("ADMIN_PASSWORD", "admin")
    if username != expected_user or password != expected_pass:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )
    user = {"id": username, "name": username, "role": "admin"}
    token = create_access_token({"sub": user["id"], "name": user["name"], "role": user["role"]})
    return {"user": user, "access_token": token, "expires_in": int(os.getenv("JWT_EXPIRES_IN", "3600"))}
