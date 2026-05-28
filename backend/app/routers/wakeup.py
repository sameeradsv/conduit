from __future__ import annotations

import asyncio
import json
import time

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.config import settings

router = APIRouter()

_TARGETS = [
    ("circuit", "{circuit_url}/api/health"),
    ("canopy",  "{canopy_url}/api/health"),
    ("chef",    "{chef_url}/health"),
]


@router.get("/api/wakeup")
async def wakeup() -> StreamingResponse:
    """Ping all sibling health endpoints in parallel; stream SSE results as each responds."""

    targets = [
        ("circuit", f"{settings.circuit_url}/api/health"),
        ("canopy",  f"{settings.canopy_url}/api/health"),
        ("chef",    f"{settings.chef_url}/health"),
    ]

    async def ping(name: str, url: str) -> dict:
        start = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                r = await client.get(url)
            ok = r.status_code < 400
        except Exception:
            ok = False
        return {"app": name, "ok": ok, "elapsed": round(time.monotonic() - start, 1)}

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
