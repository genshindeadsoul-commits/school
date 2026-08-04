"""Password hashing, JWT issuance/verification, and role-based auth
dependencies for FastAPI routes.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------- passwords
def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode(), hashed.encode())
    except ValueError:
        return False


# ---------------------------------------------------------------- JWT
def create_access_token(subject: str, role: str, extra: Optional[dict] = None) -> str:
    """role is one of: 'admin' | 'coordinator'"""
    to_encode = {"sub": subject, "role": role}
    if extra:
        to_encode.update(extra)
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


# ---------------------------------------------------------------- FastAPI deps
def get_current_claims(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing authentication token")
    return decode_token(credentials.credentials)


def require_admin(claims: dict = Depends(get_current_claims)) -> dict:
    if claims.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return claims


def require_coordinator(claims: dict = Depends(get_current_claims)) -> dict:
    if claims.get("role") != "coordinator":
        raise HTTPException(status_code=403, detail="Coordinator access required")
    return claims


def require_admin_or_coordinator(claims: dict = Depends(get_current_claims)) -> dict:
    if claims.get("role") not in ("admin", "superadmin", "coordinator"):
        raise HTTPException(status_code=403, detail="Authentication required")
    return claims
