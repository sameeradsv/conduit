"""Chat history — save and retrieve past conversations."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth_dep import optional_user_id
from app.database import get_db
from app.models import ChatMessageModel, ChatSession

router = APIRouter(prefix="/api/history", tags=["history"])


# ── Request / response schemas ────────────────────────────────────────────────

class MessageIn(BaseModel):
    role: str
    content: str


class SessionIn(BaseModel):
    model: str
    messages: list[MessageIn]


class MessageOut(BaseModel):
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionOut(BaseModel):
    id: int
    model: str
    title: str
    created_at: datetime
    messages: list[MessageOut] = []

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _derive_title(messages: list[MessageIn]) -> str:
    for m in messages:
        if m.role == "user" and m.content.strip():
            return m.content.strip()[:80]
    return "untitled"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=SessionOut, status_code=201)
def save_session(
    body: SessionIn,
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(optional_user_id),
):
    session = ChatSession(
        cortex_user_id=user_id,
        model=body.model,
        title=_derive_title(body.messages),
    )
    db.add(session)
    db.flush()  # get session.id before adding messages

    for m in body.messages:
        if m.role in ("user", "assistant"):  # skip system messages
            db.add(ChatMessageModel(
                session_id=session.id,
                role=m.role,
                content=m.content,
            ))

    db.commit()
    db.refresh(session)
    return session


@router.get("", response_model=list[SessionOut])
def list_sessions(
    limit: int = 20,
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(optional_user_id),
):
    query = db.query(ChatSession)
    if user_id is not None:
        query = query.filter(ChatSession.cortex_user_id == user_id)
    else:
        # Guest: return nothing (no user to scope to)
        return []
    return (
        query
        .order_by(ChatSession.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/{session_id}", response_model=SessionOut)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(optional_user_id),
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")
    # Only return the session if it belongs to this user (or is a guest session)
    if user_id is not None and session.cortex_user_id != user_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Forbidden")
    return session


@router.delete("/{session_id}", status_code=204)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(optional_user_id),
):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        return
    if user_id is not None and session.cortex_user_id != user_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Forbidden")
    db.delete(session)
    db.commit()
