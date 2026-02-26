import os
import time
from typing import Dict

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRES_IN = int(os.getenv("JWT_EXPIRES_IN", "3600"))

bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(payload: Dict) -> str:
    now = int(time.time())
    data = {
        **payload,
        "iat": now,
        "exp": now + JWT_EXPIRES_IN,
    }
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict:
    try:
        return jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from exc


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header.",
        )
    return decode_access_token(credentials.credentials)
