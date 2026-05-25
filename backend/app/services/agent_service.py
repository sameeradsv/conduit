import json
import os
from typing import AsyncIterator, Optional

from groq import AsyncGroq

from app.schemas import ChatMessage
from app.tools.definitions import READ_TOOLS, WRITE_TOOLS
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

_DIARY_SYSTEM = (
    "You are a silent data router. The user will provide diary-style notes. "
    "Your ONLY job is to extract items and call the appropriate write tools. "
    "Do NOT generate any prose response — only call tools.\n"
    "Rules:\n"
    "- Tasks, todos, plans, things to do → create_task (one call per task)\n"
    "- Interactions with people, meetings, conversations → log_interaction (one call per interaction)\n"
    "- Meals, food, what was eaten/cooked/ordered → log_meal (one call per meal)\n"
    "Call multiple tools when multiple items are present. Extract all available detail."
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


def _build_messages(messages: list[ChatMessage], system: str) -> list[dict]:
    raw = [{"role": m.role, "content": m.content} for m in messages]
    if raw and raw[0]["role"] == "system":
        raw[0]["content"] = f"{system}\n\n{raw[0]['content']}"
        return raw
    return [{"role": "system", "content": system}] + raw


async def stream_agent_chat(
    messages: list[ChatMessage],
    model: str,
    diary: bool = False,
    sibling_token: Optional[str] = None,
    max_tokens: int = 1024,
    temperature: float = 0.7,
) -> AsyncIterator[dict]:
    client = _client()
    system = _DIARY_SYSTEM if diary else _AGENT_SYSTEM
    tools = WRITE_TOOLS if diary else READ_TOOLS

    groq_messages = _build_messages(messages, system)

    use_tools = model in _TOOL_CALL_MODELS
    create_kwargs: dict = dict(
        model=model,
        messages=groq_messages,
        max_tokens=max_tokens,
        temperature=temperature,
        stream=False,
    )
    if use_tools:
        create_kwargs["tools"] = tools
        create_kwargs["tool_choice"] = "auto"

    response = await client.chat.completions.create(**create_kwargs)
    choice = response.choices[0]

    if use_tools and choice.finish_reason == "tool_calls":
        tool_calls = choice.message.tool_calls

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

        confirmations = []

        for tc in tool_calls:
            yield {"status": "calling_tool", "tool": tc.function.name}
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            result_str = await execute_tool(tc.function.name, args, sibling_token)
            result_data = json.loads(result_str)
            success = "error" not in result_data

            if diary:
                confirmations.append({"tool": tc.function.name, "success": success})
            else:
                groq_messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result_str,
                })

        if diary:
            yield {"confirmation": confirmations}
        else:
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

    elif diary:
        yield {"confirmation": []}

    else:
        content = choice.message.content or ""
        if content:
            yield {"delta": content}
