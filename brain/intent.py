"""Intent normalization and detection primitives."""

from dataclasses import dataclass


@dataclass(frozen=True)
class IntentResult:
    normalized_text: str
    intent: str


def normalize_text(raw_text: str) -> str:
    """Normalize user input for downstream intent and routing logic."""
    return " ".join(raw_text.strip().lower().split())


def detect_intent(normalized_text: str) -> str:
    """Detect a coarse intent label using lightweight heuristics."""
    if any(token in normalized_text for token in ("hello", "hi", "hey")):
        return "greeting"
    if any(token in normalized_text for token in ("help", "how", "what", "why")):
        return "assist"
    if any(token in normalized_text for token in ("run", "execute", "tool")):
        return "tooling"
    return "default"


def resolve_intent(raw_text: str) -> IntentResult:
    """Run normalization + intent detection in one call."""
    normalized = normalize_text(raw_text)
    return IntentResult(normalized_text=normalized, intent=detect_intent(normalized))
