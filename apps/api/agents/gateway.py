import os
import logging
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.callbacks import BaseCallbackHandler

logger = logging.getLogger(__name__)

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


class UsageTrackingHandler(BaseCallbackHandler):
    """Callback handler that records per-agent token usage locally."""

    def __init__(self, agent_name: str, model: str):
        self.agent_name = agent_name
        self.model = model

    def on_llm_end(self, response: Any, **kwargs: Any) -> None:
        try:
            from routers.lava import record_agent_usage

            usage = {}
            if hasattr(response, "llm_output") and response.llm_output:
                usage = response.llm_output.get("token_usage", {})
            if not usage and response.generations:
                gen = response.generations[0][0] if response.generations[0] else None
                if gen and hasattr(gen, "generation_info") and gen.generation_info:
                    usage = gen.generation_info.get("usage", {})

            input_tokens = int(usage.get("prompt_tokens", 0))
            output_tokens = int(usage.get("completion_tokens", 0))

            if input_tokens or output_tokens:
                record_agent_usage(self.agent_name, input_tokens, output_tokens, self.model)
                logger.debug("Recorded usage for %s: %d in, %d out", self.agent_name, input_tokens, output_tokens)
        except Exception as e:
            logger.debug("Usage tracking failed for %s: %s", self.agent_name, e)


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
            callbacks=[UsageTrackingHandler(agent_name, model)],
        )
    else:
        # Direct Gemini (no Lava) — needs GOOGLE_API_KEY
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            base_url=_GEMINI_OPENAI_BASE,
            api_key=os.getenv("GOOGLE_API_KEY", ""),
            callbacks=[UsageTrackingHandler(agent_name, model)],
        )
