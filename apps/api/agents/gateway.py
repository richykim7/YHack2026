import base64
import json
import os
from urllib.parse import quote

from fastapi import HTTPException
from langchain_openai import ChatOpenAI

# Per-agent model selection: fast model for chat/tools, pro for reasoning
MODEL_MAP = {
    "scope": "gemini-2.5-flash",
    "assess": "gemini-2.5-pro",
}
DEFAULT_MODEL = "gemini-2.5-flash"

_GEMINI_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/"


def _build_lava_gemini_url() -> str:
    """Build Lava forward proxy URL targeting Gemini's OpenAI-compatible endpoint."""
    return f"https://api.lava.so/v1/forward?u={quote(_GEMINI_OPENAI_BASE, safe='')}"


def _build_forward_token(provider_key: str) -> str:
    """Build Lava forward token with BYOK (bring-your-own-key) for Gemini."""
    payload = {
        "secret_key": os.getenv("LAVA_API_KEY", ""),
        "provider_key": provider_key,
    }
    return base64.b64encode(json.dumps(payload).encode()).decode()


def get_llm(agent_name: str = "default", temperature: float = 0.3) -> ChatOpenAI:
    """Create a ChatOpenAI instance targeting Gemini via configurable gateway.

    Supports two modes via AI_GATEWAY env var:
      - "lava": Route through Lava forward proxy with per-agent cost tags
      - "direct" (default): Direct Gemini OpenAI-compatible endpoint
    """
    gateway = os.getenv("AI_GATEWAY", "direct")
    model = MODEL_MAP.get(agent_name, DEFAULT_MODEL)

    try:
        if gateway == "lava":
            google_key = os.getenv("GOOGLE_API_KEY", "")
            return ChatOpenAI(
                model=model,
                temperature=temperature,
                base_url=_build_lava_gemini_url(),
                api_key=_build_forward_token(google_key),
                default_headers={"x-lava-tags": f"agent:{agent_name}"},
            )
        else:
            # Direct Gemini (no Lava)
            return ChatOpenAI(
                model=model,
                temperature=temperature,
                base_url=_GEMINI_OPENAI_BASE,
                api_key=os.getenv("GOOGLE_API_KEY", ""),
            )
    except Exception as e:
        raise HTTPException(
            status_code=503, detail=f"AI gateway unreachable: {str(e)}"
        )
