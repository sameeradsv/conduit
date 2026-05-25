from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth_utils import create_session, hash_password, verify_password
from app.database import get_db
from app.deps.auth import require_user
from app.models import AuthSession, User

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class AuthRequest(BaseModel):
    username: str
    passcode: str


class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    token: str
    user: UserOut


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
def auth_status(db: Session = Depends(get_db)):
    has_users = db.scalar(select(User.id).limit(1)) is not None
    return {"has_users": has_users}


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(data: AuthRequest, db: Session = Depends(get_db)):
    username = data.username.strip().lower()
    if not username or not data.passcode:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Username and passcode required")
    if len(data.passcode) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Passcode must be at least 6 characters")
    if db.scalar(select(User).where(User.username == username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")

    user = User(username=username, password_hash=hash_password(data.passcode))
    db.add(user)
    db.commit()
    db.refresh(user)
    session = create_session(db, user)
    return AuthResponse(token=session.token, user=UserOut.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login(data: AuthRequest, db: Session = Depends(get_db)):
    username = data.username.strip().lower()
    user = db.scalar(select(User).where(User.username == username))
    if not user or not verify_password(data.passcode, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or passcode")
    session = create_session(db, user)
    return AuthResponse(token=session.token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(require_user)):
    return UserOut.model_validate(user)


@router.delete("/logout", status_code=204)
def logout(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
    _user: User = Depends(require_user),
):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        session = db.get(AuthSession, token)
        if session:
            db.delete(session)
            db.commit()
