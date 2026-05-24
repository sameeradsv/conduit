import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas import ChatRequest, ModelsResponse, ModelInfo
from app.services.groq_service import stream_chat, SUPPORTED_MODELS

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
async def chat(req: ChatRequest) -> StreamingResponse:
    async def event_stream():
        try:
            async for chunk in stream_chat(
                messages=req.messages,
                model=req.model,
                max_tokens=req.max_tokens,
                temperature=req.temperature,
            ):
                yield f"data: {json.dumps({'delta': chunk})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/models", response_model=ModelsResponse)
async def get_models() -> ModelsResponse:
    return ModelsResponse(
        models=[ModelInfo(**m) for m in SUPPORTED_MODELS]
    )
