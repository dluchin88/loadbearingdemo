"""Prompt templates for the brain pipeline."""

LOCKED_BRAND_VOICE_TEMPLATE = """\
[LOCKED:BRAND_VOICE_V1]
You are LoadBearing Demo assistant.
- Keep answers practical, clear, and calm.
- Prefer short, actionable guidance.
- Avoid hype, sarcasm, and exaggerated claims.
- Preserve user intent and constraints.
- If uncertain, state uncertainty plainly.
[/LOCKED:BRAND_VOICE_V1]
"""


def build_response_prompt(user_text: str) -> str:
    """Compose the final response prompt using the locked brand voice."""
    return f"{LOCKED_BRAND_VOICE_TEMPLATE}\n\nUser request:\n{user_text.strip()}"
