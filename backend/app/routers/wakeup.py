from __future__ import annotations

import asyncio
import json
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Header
from fastapi.responses import StreamingResponse

from app.config import settings

router = APIRouter()

_TIMEOUT = 90.0
_RETRY_INTERVAL = 10.0

_AUTH_PATHS: dict[str, str] = {
    "circuit": "/api/auth/me",
    "canopy": "/api/auth/me",
    "chef": "/auth/me",
}


@router.get("/api/wakeup")
async def wakeup(authorization: Optional[str] = Header(None)) -> StreamingResponse:
    """Ping all sibling health endpoints in parallel; stream SSE results as each responds."""

    targets = [
        ("circuit", settings.circuit_url),
        ("canopy", settings.canopy_url),
        ("chef", settings.chef_url),
    ]

    async def ping(name: str, base_url: str) -> dict:
        health_url = {
            "circuit": f"{base_url}/health",
            "canopy": f"{base_url}/api/health",
            "chef": f"{base_url}/health",
        }[name]
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=_RETRY_INTERVAL) as client:
            while True:
                try:
                    r = await client.get(health_url)
                    if r.status_code < 400:
                        result: dict = {
                            "app": name,
                            "ok": True,
                            "elapsed": round(time.monotonic() - start, 1),
                        }
                        if authorization:
                            auth_path = _AUTH_PATHS[name]
                            try:
                                ar = await client.get(
                                    f"{base_url}{auth_path}",
                                    headers={"Authorization": authorization},
                                )
                                result["auth_ok"] = ar.status_code < 400
                            except Exception:
                                result["auth_ok"] = False
                        return result
                except Exception:
                    pass
                if time.monotonic() - start >= _TIMEOUT:
                    out: dict = {
                        "app": name,
                        "ok": False,
                        "elapsed": round(time.monotonic() - start, 1),
                    }
                    if authorization:
                        out["auth_ok"] = False
                    return out
                await asyncio.sleep(_RETRY_INTERVAL)

    async def generate():
        tasks = [asyncio.create_task(ping(name, url)) for name, url in targets]
        for fut in asyncio.as_completed(tasks):
            result = await fut
            yield f"data: {json.dumps(result)}\n\n"
        yield 'data: {"done":true}\n\n'

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
