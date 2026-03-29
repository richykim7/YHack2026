import os

from langchain_openai import ChatOpenAI

# Per-agent model selection: fast model for chat/tools, pro for reasoning
MODEL_MAP = {
    "scope": "gemini-2.5-flash",
    "assess": "gemini-2.5-pro",
    "monitor": "gemini-2.5-flash",       # Fast classifier for post scanning
    "researcher": "gemini-2.5-pro",       # Reasoning model for crisis analysis
    "profiler": "gpt-4.1-mini",           # OpenAI model -- different provider for Lava showcase
}
DEFAULT_MODEL = "gemini-2.5-flash"

LAVA_OPENAI_BASE = "https://api.lava.so/v1"
_GEMINI_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/"


def get_llm(agent_name: str = "default", temperature: float = 0.3) -> ChatOpenAI:
    """Create a ChatOpenAI instance via configurable gateway.

    Supports two modes via AI_GATEWAY env var:
      - "lava": Route through Lava managed gateway (no provider keys needed,
        Lava handles billing and auto-routes based on model name)
      - "direct" (default): Direct Gemini OpenAI-compatible endpoint
    """
    gateway = os.getenv("AI_GATEWAY", "direct")
    model = MODEL_MAP.get(agent_name, DEFAULT_MODEL)

    if gateway == "lava":
        # Spend key for SDK calls (budget-controlled, auto-routes by model name)
        # Falls back to secret key if no spend key configured
        api_key = os.getenv("LAVA_SPEND_KEY") or os.getenv("LAVA_API_TOKEN", "")
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            base_url=LAVA_OPENAI_BASE,
            api_key=api_key,
            default_headers={"x-lava-tags": f"agent:{agent_name}"},
        )
    else:
        # Direct Gemini (no Lava) — needs GOOGLE_API_KEY
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            base_url=_GEMINI_OPENAI_BASE,
            api_key=os.getenv("GOOGLE_API_KEY", ""),
        )
