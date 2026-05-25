from __future__ import annotations

from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.auth_utils import get_user_for_token
from app.config import settings
from app.database import get_db
from app.models import User


def optional_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    return get_user_for_token(db, token)


def require_user(user: Optional[User] = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def optional_auth_user(user: Optional[User] = Depends(optional_user)) -> Optional[User]:
    """When AUTH_REQUIRED=true behaves like require_user; otherwise allows anonymous access."""
    if settings.auth_required and user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user
