import os
from typing import AsyncIterator

from groq import AsyncGroq

from app.schemas import ChatMessage

SUPPORTED_MODELS = [
    {"id": "llama-3.3-70b-versatile", "label": "llama-3.3-70b",       "context": 128000},
    {"id": "llama-3.1-8b-instant",    "label": "llama-3.1-8b-instant", "context": 131072},
    {"id": "llama-3.1-70b-versatile",  "label": "llama-3.1-70b",        "context": 131072},
    {"id": "qwen-qwq-32b",            "label": "qwen-qwq-32b",         "context": 131072},
]

VALID_MODEL_IDS = {m["id"] for m in SUPPORTED_MODELS}
DEFAULT_MODEL = "llama-3.3-70b-versatile"


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
    if model not in VALID_MODEL_IDS:
        model = DEFAULT_MODEL

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
