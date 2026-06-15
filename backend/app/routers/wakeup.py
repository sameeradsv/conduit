from __future__ import annotations

import asyncio
import json
import time

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.config import settings

router = APIRouter()

_TIMEOUT = 90.0
_RETRY_INTERVAL = 10.0


@router.get("/api/wakeup")
async def wakeup() -> StreamingResponse:
    """Ping all sibling health endpoints in parallel; stream SSE results as each responds."""

    targets = [
        ("circuit", f"{settings.circuit_url}/health"),
        ("canopy",  f"{settings.canopy_url}/api/health"),
        ("chef",    f"{settings.chef_url}/health"),
    ]

    async def ping(name: str, url: str) -> dict:
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=_RETRY_INTERVAL) as client:
            while True:
                try:
                    r = await client.get(url)
                    if r.status_code < 400:
                        return {"app": name, "ok": True, "elapsed": round(time.monotonic() - start, 1)}
                except Exception:
                    pass
                if time.monotonic() - start >= _TIMEOUT:
                    return {"app": name, "ok": False, "elapsed": round(time.monotonic() - start, 1)}
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
