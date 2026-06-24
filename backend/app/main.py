from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db
from app.routers import chat
from app.routers.agent import router as agent_router
from app.routers.auth import router as auth_router
from app.routers.history import router as history_router
from app.routers.webauthn import router as webauthn_router
from app.routers.wakeup import router as wakeup_router

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.init_db_on_startup:
        init_db()
    yield


app = FastAPI(
    title="conduit API",
    description="Terminal-style multi-model AI chat — Groq backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(chat.router)
app.include_router(agent_router)
app.include_router(history_router)
app.include_router(webauthn_router)
app.include_router(wakeup_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "conduit-api"}


@app.get("/api/health")
def api_health():
    return health()
