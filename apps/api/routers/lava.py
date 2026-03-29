import os

import httpx
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/lava", tags=["lava"])

AI_GATEWAY = os.environ.get("AI_GATEWAY", "lava")
LAVA_API_TOKEN = os.environ.get("LAVA_API_TOKEN", "")
LAVA_BASE_URL = os.environ.get("LAVA_BASE_URL", "https://api.lava.so")


async def fetch_lava_costs_data(limit: int = 100) -> dict:
    """Fetch and aggregate costs from Lava API. Reusable by pipeline."""
    if AI_GATEWAY != "lava" or not LAVA_API_TOKEN:
        return {"costs": [], "total_cost": 0.0, "gateway": AI_GATEWAY}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{LAVA_BASE_URL}/v1/requests",
                headers={"Authorization": f"Bearer {LAVA_API_TOKEN}"},
                params={"limit": limit},
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()

        # Aggregate by agent tag from metadata
        costs_by_agent: dict[str, dict] = {}
        for req in data.get("items", data.get("data", [])):
            metadata = req.get("metadata", {})
            tags = metadata.get("tags", "")
            # Extract agent name from "agent:scope" or "agent:assess" tag
            agent = "unknown"
            if isinstance(tags, str) and "agent:" in tags:
                agent = tags.split("agent:")[-1].split(",")[0].strip()
            elif isinstance(tags, list):
                for t in tags:
                    if t.startswith("agent:"):
                        agent = t[6:]
                        break
            # Fallback: check x-lava-tags key directly in metadata
            if agent == "unknown":
                lava_tags = metadata.get("x-lava-tags", "")
                if isinstance(lava_tags, str) and "agent:" in lava_tags:
                    agent = lava_tags.split("agent:")[-1].split(",")[0].strip()

            if agent not in costs_by_agent:
                costs_by_agent[agent] = {"agent": agent, "cost": 0.0, "tokens": 0, "requests": 0}

            model_usage = req.get("model_usage", {})
            costs_by_agent[agent]["cost"] += float(model_usage.get("total_cost", 0))
            costs_by_agent[agent]["tokens"] += int(model_usage.get("input_tokens", 0)) + int(
                model_usage.get("output_tokens", 0)
            )
            costs_by_agent[agent]["requests"] += 1

        costs = list(costs_by_agent.values())
        total = sum(c["cost"] for c in costs)
        return {"costs": costs, "total_cost": total, "gateway": "lava"}
    except Exception as e:
        return {"costs": [], "total_cost": 0.0, "gateway": "lava", "error": str(e)}


@router.get("/costs")
async def get_costs(limit: int = Query(default=100, le=500)):
    """Fetch and aggregate costs by agent tag from Lava.

    Implements COST-01, COST-02, COST-03.
    Returns [] when AI_GATEWAY is not lava (per D-11).
    """
    return await fetch_lava_costs_data(limit)
