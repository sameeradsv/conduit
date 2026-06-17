import os
from typing import AsyncIterator

import httpx
from groq import AsyncGroq

from app.schemas import ChatMessage

DEFAULT_MODEL = "llama-3.3-70b-versatile"

_FALLBACK_MODELS = [
    {"id": "llama-3.3-70b-versatile", "label": "llama-3.3-70b", "context": 128000},
    {"id": "llama-3.1-8b-instant",    "label": "llama-3.1-8b-instant", "context": 131072},
]

# Non-chat model prefixes to exclude from the picker
_EXCLUDE_PREFIXES = ("whisper", "distil-whisper", "playai-", "guard-", "llama-guard")


async def fetch_models() -> list[dict]:
    """Fetch live model list from Groq. Falls back to _FALLBACK_MODELS on error."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return _FALLBACK_MODELS
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
        if r.status_code != 200:
            return _FALLBACK_MODELS
        items = r.json().get("data", [])
        models = []
        for m in sorted(items, key=lambda x: x.get("id", "")):
            mid = m.get("id", "")
            if any(mid.startswith(p) for p in _EXCLUDE_PREFIXES):
                continue
            label = mid.split("/")[-1]  # strip org prefix for display
            models.append({
                "id": mid,
                "label": label,
                "context": m.get("context_window", 8192),
            })
        return models if models else _FALLBACK_MODELS
    except Exception:
        return _FALLBACK_MODELS


def _client() -> AsyncGroq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")
    return AsyncGroq(api_key=api_key)


async def stream_chat(
    messages: list[ChatMessage],
    model: str,
    max_tokens: int = 1024,
    temperature: float = 0.7,
) -> AsyncIterator[str]:
    client = _client()
    stream = await client.chat.completions.create(
        model=model,
        messages=[{"role": m.role, "content": m.content} for m in messages],
        max_tokens=max_tokens,
        temperature=temperature,
        stream=True,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
