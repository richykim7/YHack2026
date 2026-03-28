import os

from fastapi import HTTPException
from langchain_anthropic import ChatAnthropic


def get_llm(agent_name: str = "default", temperature: float = 0.3) -> ChatAnthropic:
    """Create a ChatAnthropic instance configured for the active AI gateway.

    Supports three modes via AI_GATEWAY env var:
      - "lava": Route through Lava gateway with per-agent cost tags
      - "openrouter": Route through OpenRouter (no tags)
      - "direct" (default): Direct Anthropic API access
    """
    gateway = os.getenv("AI_GATEWAY", "direct")
    model = "claude-sonnet-4-20250514"

    try:
        if gateway == "lava":
            return ChatAnthropic(
                model=model,
                temperature=temperature,
                anthropic_api_url=os.getenv("LAVA_BASE_URL", "https://gateway.lava.so/v1"),
                anthropic_api_key=os.getenv("LAVA_API_KEY", ""),
                default_headers={"x-lava-tag": f"agent:{agent_name}"},
            )
        elif gateway == "openrouter":
            return ChatAnthropic(
                model=model,
                temperature=temperature,
                anthropic_api_url=os.getenv(
                    "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
                ),
                anthropic_api_key=os.getenv("OPENROUTER_API_KEY", ""),
            )
        else:
            # Direct Anthropic fallback
            return ChatAnthropic(
                model=model,
                temperature=temperature,
                anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
            )
    except Exception as e:
        raise HTTPException(
            status_code=503, detail=f"AI gateway unreachable: {str(e)}"
        )
