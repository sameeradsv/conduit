import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas import AgentChatRequest
from app.services.agent_service import stream_agent_chat

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.post("/chat")
async def agent_chat(req: AgentChatRequest) -> StreamingResponse:
    async def event_stream():
        try:
            async for event in stream_agent_chat(
                messages=req.messages,
                model=req.model,
                diary=req.diary,
                sibling_token=req.sibling_token,
                max_tokens=req.max_tokens,
                temperature=req.temperature,
                scope=req.scope,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
