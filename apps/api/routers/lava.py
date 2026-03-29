import json
import os
import logging
from collections import defaultdict
from pathlib import Path

import httpx
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/lava", tags=["lava"])
logger = logging.getLogger(__name__)

AI_GATEWAY = os.environ.get("AI_GATEWAY", "lava")
LAVA_API_TOKEN = os.environ.get("LAVA_API_TOKEN", "")
LAVA_BASE_URL = os.environ.get("LAVA_BASE_URL", "https://api.lava.so")

# Persistent file for agent cost tracking (survives server restarts)
_COSTS_FILE = Path(__file__).resolve().parent.parent / ".agent_costs.json"

# Local per-agent cost tracker (populated by gateway.py after each LLM call)
_agent_costs: dict[str, dict] = defaultdict(
    lambda: {"agent": "", "model": "", "cost": 0.0, "tokens": 0, "requests": 0}
)


def _load_costs() -> None:
    """Load persisted agent costs from disk."""
    if _COSTS_FILE.exists():
        try:
            data = json.loads(_COSTS_FILE.read_text())
            for entry in data:
                name = entry.get("agent", "")
                if name:
                    _agent_costs[name] = entry
        except Exception as e:
            logger.warning("Failed to load persisted costs: %s", e)


def _save_costs() -> None:
    """Persist current agent costs to disk."""
    try:
        _COSTS_FILE.write_text(json.dumps(list(_agent_costs.values()), indent=2))
    except Exception as e:
        logger.warning("Failed to persist costs: %s", e)


# Load on module import so costs survive restarts
_load_costs()


def record_agent_usage(agent_name: str, input_tokens: int, output_tokens: int, model: str) -> None:
    """Record per-agent token usage locally. Called by gateway after each LLM call."""
    entry = _agent_costs[agent_name]
    entry["agent"] = agent_name
    entry["model"] = model
    entry["tokens"] += input_tokens + output_tokens
    entry["requests"] += 1
    _save_costs()


def reset_agent_costs() -> None:
    """Reset local tracking (call at pipeline start)."""
    _agent_costs.clear()
    _save_costs()


def get_local_agent_costs() -> list[dict]:
    """Return current per-agent cost breakdown."""
    return list(_agent_costs.values())


def _fallback_model_breakdown(total_cost: float, total_requests: int) -> list[dict]:
    """Estimate per-model cost breakdown when no local agent tracking is available.

    Uses the known agent→model map and approximate output pricing ratios to
    distribute the Lava-reported total across models.
    """
    from agents.gateway import MODEL_MAP

    # Group agents by model and assign relative cost weight based on pricing
    # (higher price-per-token models get proportionally more of the total)
    model_weights = {
        "gemini-2.5-flash": 0.60,   # cheapest, but used by multiple agents
        "gemini-2.5-pro": 1.25,     # ~2x flash pricing
        "gpt-4.1-mini": 1.60,       # mid-range pricing
    }

    models_used: dict[str, list[str]] = {}
    for agent, model in MODEL_MAP.items():
        models_used.setdefault(model, []).append(agent)

    weighted_total = sum(
        model_weights.get(m, 1.0) * len(agents)
        for m, agents in models_used.items()
    )
    if weighted_total == 0:
        return []

    result = []
    for model, agents in models_used.items():
        weight = model_weights.get(model, 1.0) * len(agents)
        share = weight / weighted_total
        est_requests = max(1, round(total_requests * share))
        result.append({
            "agent": ", ".join(agents),
            "model": model,
            "cost": round(total_cost * share, 6),
            "tokens": 0,
            "requests": est_requests,
        })

    return sorted(result, key=lambda x: x["cost"], reverse=True)


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
        elif total_cost > 0:
            # No local tracking (e.g. server restarted) but Lava has spend data —
            # estimate a per-model breakdown so the chart still renders
            local_costs = _fallback_model_breakdown(total_cost, total_requests)

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
