"""Single entry point for the append-only brain pipeline."""

from .intent import resolve_intent
from .prompts import build_response_prompt
from .tools_registry import get_tool_for_intent


def _memory_stub(normalized_text: str) -> dict:
    """Stub memory stage for future state retrieval."""
    return {"memory": None, "query": normalized_text}


def _policy_stub(intent: str, memory_snapshot: dict) -> dict:
    """Stub policy stage for future safety/governance decisions."""
    return {
        "allowed": True,
        "reason": "policy_stub_default_allow",
        "intent": intent,
        "memory_snapshot": memory_snapshot,
    }


def route(user_text: str) -> dict:
    """Run the pipeline: normalize → intent → memory stub → policy stub → tool routing → response."""
    intent_result = resolve_intent(user_text)
    memory_snapshot = _memory_stub(intent_result.normalized_text)
    policy_decision = _policy_stub(intent_result.intent, memory_snapshot)

    if not policy_decision["allowed"]:
        return {
            "intent": intent_result.intent,
            "response": "Request blocked by policy.",
            "policy": policy_decision,
        }

    tool = get_tool_for_intent(intent_result.intent)
    tool_result = tool({"text": intent_result.normalized_text, "intent": intent_result.intent})
    response_prompt = build_response_prompt(intent_result.normalized_text)

    return {
        "intent": intent_result.intent,
        "normalized_text": intent_result.normalized_text,
        "memory": memory_snapshot,
        "policy": policy_decision,
        "tool_result": tool_result,
        "response": tool_result.get("output", ""),
        "response_prompt": response_prompt,
    }
