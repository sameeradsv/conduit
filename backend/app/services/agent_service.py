import json
import os
from typing import AsyncIterator, Optional

from groq import AsyncGroq

from app.schemas import ChatMessage
from app.tools.definitions import TOOLS
from app.tools.executor import execute_tool

_AGENT_SYSTEM = (
    "You are Conduit, a terminal-style AI assistant. "
    "You have live access to the user's other apps via tools:\n"
    "- Circuit: task management (tasks, summaries)\n"
    "- Canopy: relationship tracking (people, interaction logs)\n"
    "- Chef: kitchen decisions (meal recommendations, cook vs order)\n\n"
    "Use the tools when the user asks about their tasks, people, or food. "
    "If a sibling app is unreachable, acknowledge it and continue. "
    "Keep responses concise and terminal-appropriate."
)

_TOOL_CALL_MODELS = {
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.1-70b-versatile",
}


def _client() -> AsyncGroq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")
    return AsyncGroq(api_key=api_key)


def _inject_system(messages: list[dict]) -> list[dict]:
    if messages and messages[0]["role"] == "system":
        existing = messages[0]["content"]
        messages[0]["content"] = f"{_AGENT_SYSTEM}\n\n{existing}"
        return messages
    return [{"role": "system", "content": _AGENT_SYSTEM}] + messages


async def stream_agent_chat(
    messages: list[ChatMessage],
    model: str,
    sibling_token: Optional[str] = None,
    max_tokens: int = 1024,
    temperature: float = 0.7,
) -> AsyncIterator[dict]:
    client = _client()
    groq_messages = _inject_system(
        [{"role": m.role, "content": m.content} for m in messages]
    )

    # Only pass tools for models that support function calling
    use_tools = model in _TOOL_CALL_MODELS
    create_kwargs: dict = dict(
        model=model,
        messages=groq_messages,
        max_tokens=max_tokens,
        temperature=temperature,
        stream=False,
    )
    if use_tools:
        create_kwargs["tools"] = TOOLS
        create_kwargs["tool_choice"] = "auto"

    response = await client.chat.completions.create(**create_kwargs)
    choice = response.choices[0]

    if use_tools and choice.finish_reason == "tool_calls":
        tool_calls = choice.message.tool_calls

        # Append assistant turn with tool_calls into history
        groq_messages.append({
            "role": "assistant",
            "content": choice.message.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in tool_calls
            ],
        })

        # Execute each tool and append results
        for tc in tool_calls:
            yield {"status": "calling_tool", "tool": tc.function.name}
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            result = await execute_tool(tc.function.name, args, sibling_token)
            groq_messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result,
            })

        # Stream the final synthesised response
        stream = await client.chat.completions.create(
            model=model,
            messages=groq_messages,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield {"delta": delta}

    else:
        # No tool calls — yield the full content as one delta
        content = choice.message.content or ""
        if content:
            yield {"delta": content}
