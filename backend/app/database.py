import os
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{DATA_DIR / 'conduit.db'}",
)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
# Neon drops idle connections — pre-ping detects stale ones, pool_recycle discards
# them before the server-side 300s timeout.
pool_kwargs = (
    {}
    if DATABASE_URL.startswith("sqlite")
    else {"pool_pre_ping": True, "pool_recycle": 280}
)

engine = create_engine(DATABASE_URL, connect_args=connect_args, **pool_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def _migrate_postgres() -> None:
    """Add columns introduced after the initial schema was created."""
    if DATABASE_URL.startswith("sqlite"):
        return
    with engine.connect() as conn:
        inspector = inspect(engine)
        if "chat_sessions" not in inspector.get_table_names():
            return
        existing = {c["name"] for c in inspector.get_columns("chat_sessions")}
        if "title" not in existing:
            conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN title VARCHAR(200) DEFAULT ''"))
            conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
