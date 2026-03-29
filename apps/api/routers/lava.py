import os
import logging
from collections import defaultdict

import httpx
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/lava", tags=["lava"])
logger = logging.getLogger(__name__)

AI_GATEWAY = os.environ.get("AI_GATEWAY", "lava")
LAVA_API_TOKEN = os.environ.get("LAVA_API_TOKEN", "")
LAVA_BASE_URL = os.environ.get("LAVA_BASE_URL", "https://api.lava.so")

# Local per-agent cost tracker (populated by gateway.py after each LLM call)
_agent_costs: dict[str, dict] = defaultdict(
    lambda: {"agent": "", "cost": 0.0, "tokens": 0, "requests": 0}
)


def record_agent_usage(agent_name: str, input_tokens: int, output_tokens: int, model: str) -> None:
    """Record per-agent token usage locally. Called by gateway after each LLM call."""
    entry = _agent_costs[agent_name]
    entry["agent"] = agent_name
    entry["tokens"] += input_tokens + output_tokens
    entry["requests"] += 1
    # Cost will be reconciled from Lava spend_keys aggregate


def reset_agent_costs() -> None:
    """Reset local tracking (call at pipeline start)."""
    _agent_costs.clear()


def get_local_agent_costs() -> list[dict]:
    """Return current per-agent cost breakdown."""
    return list(_agent_costs.values())


async def fetch_lava_costs_data(limit: int = 100) -> dict:
    """Fetch aggregate costs from Lava /v1/spend_keys and merge with local per-agent tracking."""
    if AI_GATEWAY != "lava" or not LAVA_API_TOKEN:
        return {"costs": [], "total_cost": 0.0, "gateway": AI_GATEWAY}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{LAVA_BASE_URL}/v1/spend_keys",
                headers={"Authorization": f"Bearer {LAVA_API_TOKEN}"},
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()

        # Sum across all spend keys for aggregate totals
        total_cost = 0.0
        total_requests = 0
        for key in data.get("data", []):
            total_cost += float(key.get("total_spend", 0))
            total_requests += int(key.get("total_requests", 0))

        # Use local per-agent tracking for granular breakdown
        local_costs = get_local_agent_costs()
        if local_costs:
            # Distribute the Lava total proportionally across agents by token count
            total_local_tokens = sum(c["tokens"] for c in local_costs)
            if total_local_tokens > 0 and total_cost > 0:
                for c in local_costs:
                    c["cost"] = round(total_cost * (c["tokens"] / total_local_tokens), 6)

        return {
            "costs": local_costs,
            "total_cost": total_cost,
            "total_requests": total_requests,
            "gateway": "lava",
        }
    except Exception as e:
        logger.warning("Lava spend_keys fetch failed: %s", e)
        # Fall back to local tracking only
        local_costs = get_local_agent_costs()
        return {"costs": local_costs, "total_cost": 0.0, "gateway": "lava", "error": str(e)}


@router.get("/costs")
async def get_costs(limit: int = Query(default=100, le=500)):
    """Fetch and aggregate costs by agent tag from Lava.

    Implements COST-01, COST-02, COST-03.
    Returns [] when AI_GATEWAY is not lava (per D-11).
    """
    return await fetch_lava_costs_data(limit)
