from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_db_path = (Path(__file__).resolve().parents[2] / "data" / "conduit.db").as_posix()
_default_cors = "https://sameeradsv.github.io"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = f"sqlite:///{_db_path}"
    cors_origins: str = _default_cors
    auth_required: bool = False
    groq_api_key: str = ""
    # Optional: URL of the shared Cortex Auth Server e.g. "https://cortex-auth.onrender.com"
    cortex_auth_url: str = ""
    # Sibling app base URLs (no trailing slash) — must be set via env vars
    circuit_url: str = ""
    canopy_url: str = ""
    chef_url: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
