from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATABASE_URL = settings.database_url

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
# Neon drops idle connections — pre-ping detects stale ones, pool_recycle discards
# them before the server-side 300s timeout.
pool_kwargs = (
    {}
    if DATABASE_URL.startswith("sqlite")
    else {"pool_pre_ping": True, "pool_recycle": 280, "pool_size": 2, "max_overflow": 3}
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
        tables = inspector.get_table_names()

        if "users" in tables:
            existing = {c["name"] for c in inspector.get_columns("users")}
            if "cortex_user_id" not in existing:
                conn.execute(text("ALTER TABLE users ADD COLUMN cortex_user_id INTEGER"))
                conn.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_cortex_user_id "
                    "ON users (cortex_user_id) WHERE cortex_user_id IS NOT NULL"
                ))
                conn.commit()

        if "chat_sessions" in tables:
            existing = {c["name"] for c in inspector.get_columns("chat_sessions")}
            if "title" not in existing:
                conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN title VARCHAR(200) DEFAULT ''"))
                conn.commit()
            # Migrate old cortex_user_id column to user_id if present
            if "cortex_user_id" in existing and "user_id" not in existing:
                conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN user_id INTEGER REFERENCES users(id)"))
                conn.commit()

        # WebAuthn tables
        if "webauthn_credentials" not in tables:
            conn.execute(text(
                "CREATE TABLE webauthn_credentials ("
                "credential_id TEXT PRIMARY KEY, "
                "public_key TEXT NOT NULL, "
                "sign_count INTEGER DEFAULT 0, "
                "user_id TEXT NOT NULL, "
                "created_at TIMESTAMP DEFAULT NOW()"
                ")"
            ))
            conn.execute(text("CREATE INDEX ix_webauthn_cred_user ON webauthn_credentials (user_id)"))
            conn.commit()

        if "webauthn_challenges" not in tables:
            conn.execute(text(
                "CREATE TABLE webauthn_challenges ("
                "id VARCHAR(64) PRIMARY KEY, "
                "challenge VARCHAR(128) NOT NULL, "
                "user_id TEXT, "
                "expires_at TIMESTAMP NOT NULL, "
                "created_at TIMESTAMP DEFAULT NOW()"
                ")"
            ))
            conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401

    if DATABASE_URL.startswith("sqlite"):
        db_path = Path(DATABASE_URL.replace("sqlite:///", ""))
        db_path.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _migrate_postgres()


if __name__ == "__main__":
    init_db()
    print("Database schema is ready.")
