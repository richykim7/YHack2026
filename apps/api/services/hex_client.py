import asyncio
import os

import httpx

HEX_BASE = "https://app.hex.tech/api/v1"
HEX_API_TOKEN = os.environ.get("HEX_API_TOKEN", "")
HEX_ASSESS_PROJECT_ID = os.environ.get("HEX_ASSESS_PROJECT_ID", "")
HEX_HISTORY_PROJECT_ID = os.environ.get("HEX_HISTORY_PROJECT_ID", "")
HEX_PLANS_PROJECT_ID = os.environ.get("HEX_PLANS_PROJECT_ID", "")

TERMINAL_STATUSES = {"COMPLETED", "ERRORED", "KILLED", "UNABLE_TO_ALLOCATE_KERNEL"}


async def trigger_hex_run(project_id: str, input_params: dict) -> dict:
    """Trigger a Hex project run. Returns {run_id, run_url}."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{HEX_BASE}/projects/{project_id}/runs",
            json={"inputParams": input_params},
            headers={"Authorization": f"Bearer {HEX_API_TOKEN}"},
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        return {"run_id": data["runId"], "run_url": data["runUrl"]}


async def poll_hex_status(
    project_id: str, run_id: str, max_polls: int = 30, interval: float = 5.0
) -> str:
    """Poll Hex run status. Returns final status string.

    Polls every 5s (12/min), max 30 polls (2.5 min). Respects 60 checks/hour limit.
    Exponential backoff after 10 polls to further conserve rate budget.
    """
    async with httpx.AsyncClient() as client:
        for i in range(max_polls):
            resp = await client.get(
                f"{HEX_BASE}/projects/{project_id}/runs/{run_id}",
                headers={"Authorization": f"Bearer {HEX_API_TOKEN}"},
                timeout=15.0,
            )
            status = resp.json()["status"]
            if status in TERMINAL_STATUSES:
                return status
            # Exponential backoff after 10 polls: 5s, 5s, ..., 5s, 7.5s, 10s, ...
            wait = interval if i < 10 else interval * (1.5 ** (i - 10))
            await asyncio.sleep(min(wait, 30.0))
    return "TIMEOUT"


async def trigger_plans_run(plans: list[dict], profile_dict: dict) -> dict:
    """Trigger Hex Plans notebook with plan data + crisis params."""
    import json

    return await trigger_hex_run(
        HEX_PLANS_PROJECT_ID,
        {
            "plan_data_json": json.dumps(plans),
            "crisis_type": profile_dict.get("crisis_type", ""),
            "geography": profile_dict.get("geography", ""),
            "severity": profile_dict.get("severity", 0),
            "timeline_days": profile_dict.get("timeline_days", 0),
            "demand_delta_pct": profile_dict.get("demand_delta_pct", 0),
            "affected_population": profile_dict.get("affected_population", 0),
        },
    )


async def trigger_history_run(geography: str = "Greater Philadelphia") -> dict | None:
    """Trigger the History dashboard Hex project.

    Returns {run_id, run_url} or None if no project configured.
    """
    if not HEX_HISTORY_PROJECT_ID or not HEX_API_TOKEN:
        return None
    return await trigger_hex_run(HEX_HISTORY_PROJECT_ID, {"geography": geography})
