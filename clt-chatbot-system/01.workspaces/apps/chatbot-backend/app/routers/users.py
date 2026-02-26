from fastapi import APIRouter, Depends

from app.core.security import get_current_user

router = APIRouter(prefix="/users")


@router.get("/me")
def me(current_user=Depends(get_current_user)):
    return {
        "id": current_user.get("sub"),
        "name": current_user.get("name"),
        "role": current_user.get("role", "user"),
    }
