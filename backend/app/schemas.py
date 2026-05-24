from typing import Literal
from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: str = "llama-3.3-70b-versatile"
    max_tokens: int = 1024
    temperature: float = 0.7


class ModelInfo(BaseModel):
    id: str
    label: str
    context: int


class ModelsResponse(BaseModel):
    models: list[ModelInfo]
