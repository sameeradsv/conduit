import json
import os
import re
from typing import AsyncIterator, Optional

from groq import AsyncGroq, APIStatusError

from app.schemas import ChatMessage
from app.tools.definitions import READ_TOOLS, WRITE_TOOLS, SCOPE_TOOLS
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
    "Call multiple tools when multiple items are present. Extract all available detail.\n"
    "Date handling: if the entry starts with [Entry date: YYYY-MM-DD], that is the date the events "
    "occurred. Set occurred_at to YYYY-MM-DDT12:00:00 for log_interaction and timestamp to "
    "YYYY-MM-DDT12:00:00 for log_meal. Omit these fields for today's entries."
)

_SCOPE_SYSTEMS: dict[str, str] = {
    "circuit": (
        "You are a terminal assistant embedded in Circuit, a task management app. "
        "Use your tools to help the user check tasks, understand priorities, and add new tasks. "
        "Be concise and terminal-appropriate. If Circuit is unreachable, say so clearly."
    ),
    "canopy": (
        "You are a terminal assistant embedded in Canopy, a relationship tracking app. "
        "Use your tools to help the user recall people, review interaction history, and log new interactions. "
        "Be concise and terminal-appropriate."
    ),
    "chef": (
        "You are a terminal assistant embedded in Chef, a kitchen decision app. "
        "Use your tools to give meal recommendations, help decide cook vs order, and log meals. "
        "Be concise and terminal-appropriate."
    ),
}

_TOOL_CALL_MODELS = {
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.1-70b-versatile",
}

# Diary mode always routes silently via tool calls — use the most reliable
# tool-call model regardless of the user's selected chat model.
_DIARY_MODEL = "llama-3.3-70b-versatile"

# Matches the old Llama text-format function call that Groq sometimes generates
# instead of a structured tool call: <function=name>{...}</function>
_FUNC_RE = re.compile(r"<function=(\w+)>(.*?)</function>", re.DOTALL)


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


def _parse_failed_generation(body: dict) -> list[dict]:
    """
    Parse tool calls from Groq's failed_generation field.
    The model sometimes produces <function=name>{args}</function> text instead of
    a structured tool call; Groq rejects it with 400/tool_use_failed, but the
    args are still usable if we extract them ourselves.
    """
    fg = (body.get("error") or {}).get("failed_generation", "")
    calls = []
    for name, args_str in _FUNC_RE.findall(fg):
        try:
            args = json.loads(args_str)
        except json.JSONDecodeError:
            continue
        calls.append({"name": name, "args": args})
    return calls


def _coerce_args(name: str, args: dict) -> dict:
    """Fix known type mismatches that models produce against our schemas."""
    if name == "log_meal" and "satisfaction" in args:
        try:
            args["satisfaction"] = int(args["satisfaction"])
        except (ValueError, TypeError):
            args.pop("satisfaction", None)
    return args


async def stream_agent_chat(
    messages: list[ChatMessage],
    model: str,
    diary: bool = False,
    sibling_token: Optional[str] = None,
    max_tokens: int = 1024,
    temperature: float = 0.7,
    scope: Optional[str] = None,
) -> AsyncIterator[dict]:
    client = _client()
    if scope and scope in _SCOPE_SYSTEMS:
        system = _SCOPE_SYSTEMS[scope]
        tools = SCOPE_TOOLS.get(scope, READ_TOOLS)
    elif diary:
        system = _DIARY_SYSTEM
        tools = WRITE_TOOLS
    else:
        system = _AGENT_SYSTEM
        tools = READ_TOOLS

    groq_messages = _build_messages(messages, system)

    effective_model = _DIARY_MODEL if diary else model
    use_tools = effective_model in _TOOL_CALL_MODELS
    create_kwargs: dict = dict(
        model=effective_model,
        messages=groq_messages,
        max_tokens=max_tokens,
        temperature=temperature,
        stream=False,
    )
    if use_tools:
        create_kwargs["tools"] = tools
        create_kwargs["tool_choice"] = "required" if diary else "auto"
        if diary:
            create_kwargs["parallel_tool_calls"] = False

    # Attempt the structured tool call; fall back to parsing failed_generation
    # when Groq rejects the model's text-format function call (400/tool_use_failed).
    try:
        response = await client.chat.completions.create(**create_kwargs)
        choice = response.choices[0]
    except APIStatusError as exc:
        if exc.status_code != 400:
            raise
        body = exc.body if isinstance(exc.body, dict) else {}
        if (body.get("error") or {}).get("code") != "tool_use_failed":
            raise
        parsed = _parse_failed_generation(body)
        if not parsed:
            raise
        # Execute the recovered tool calls directly
        confirmations = []
        for tc in parsed:
            name, args = tc["name"], _coerce_args(tc["name"], tc["args"])
            yield {"status": "calling_tool", "tool": name}
            result_str = await execute_tool(name, args, sibling_token)
            result_data = json.loads(result_str)
            if diary:
                confirmations.append({"tool": name, "success": "error" not in result_data})
            else:
                groq_messages.append({
                    "role": "tool",
                    "tool_call_id": f"fallback_{name}",
                    "content": result_str,
                })
        if diary:
            yield {"confirmation": confirmations}
        return

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
            args = _coerce_args(tc.function.name, args)
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
                model=effective_model,
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
