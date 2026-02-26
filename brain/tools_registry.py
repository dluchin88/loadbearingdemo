"""Intent-to-tool routing map for the brain module."""

from collections.abc import Callable

ToolCallable = Callable[[dict], dict]


def echo_tool(payload: dict) -> dict:
    return {"tool": "echo_tool", "output": payload.get("text", "")}


def helper_tool(payload: dict) -> dict:
    return {"tool": "helper_tool", "output": "How can I help?"}


def default_tool(payload: dict) -> dict:
    return {"tool": "default_tool", "output": payload.get("text", "")}


TOOLS_BY_INTENT: dict[str, ToolCallable] = {
    "greeting": helper_tool,
    "assist": helper_tool,
    "tooling": echo_tool,
    "default": default_tool,
}


def get_tool_for_intent(intent: str) -> ToolCallable:
    """Return the registered callable for an intent."""
    return TOOLS_BY_INTENT.get(intent, default_tool)
