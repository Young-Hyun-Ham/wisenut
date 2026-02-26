from fastapi import APIRouter, Header
from pydantic import BaseModel

router = APIRouter(prefix="/auth")


class LoginRequest(BaseModel):
    user_id: str
    password: str


@router.post("/login")
def login(body: LoginRequest):
    return {"access_token": "dummy-token", "token_type": "bearer"}


@router.post("/logout")
def logout(authorization: str = Header(None)):
    return {"result": "ok"}


@router.get("/me")
def me(authorization: str = Header(None)):
    return {"user_id": "dummy", "display_name": "dummy", "roles": ["user"]}
