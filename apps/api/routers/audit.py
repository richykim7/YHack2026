"""Audit and verification endpoints for pipeline provenance."""

import logging
import os

from fastapi import APIRouter, HTTPException
from supabase import create_client

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

router = APIRouter(prefix="/api/crisis", tags=["audit"])


@router.get("/{event_id}/audit")
async def get_audit_log(event_id: str):
    """Retrieve the audit log for a crisis event.

    Returns the full audit trail: agent actions, models used,
    token counts, costs, and durations.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Database not configured")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    try:
        resp = supabase.table("crisis_events").select(
            "audit_log, pipeline_run_id, pipeline_duration_ms"
        ).eq("id", event_id).single().execute()

        if not resp.data:
            raise HTTPException(status_code=404, detail="Crisis event not found")

        audit_log = resp.data.get("audit_log") or []
        return {
            "crisis_event_id": event_id,
            "pipeline_run_id": resp.data.get("pipeline_run_id", ""),
            "pipeline_duration_ms": resp.data.get("pipeline_duration_ms", 0),
            "audit_entries": audit_log,
            "count": len(audit_log),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Audit log retrieval failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Audit retrieval failed: {str(e)}")


@router.get("/{event_id}/verify")
async def verify_crisis_event(event_id: str):
    """Retrieve stored pipeline data for cross-referencing and verification.

    Returns all stored pipeline outputs: crisis_profile, gap_analysis,
    discovered_sources, all_plans, accepted_plan_name, and audit metadata.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Database not configured")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    try:
        resp = supabase.table("crisis_events").select("*").eq("id", event_id).single().execute()

        if not resp.data:
            raise HTTPException(status_code=404, detail="Crisis event not found")

        data = resp.data
        return {
            "crisis_event_id": event_id,
            "pipeline_run_id": data.get("pipeline_run_id", ""),
            "crisis_profile": data.get("crisis_profile"),
            "gap_analysis": data.get("gap_analysis"),
            "discovered_sources": data.get("discovered_sources"),
            "all_plans": data.get("all_plans"),
            "accepted_plan_name": data.get("accepted_plan_name"),
            "response_plan": data.get("response_plan"),
            "audit_log": data.get("audit_log"),
            "pipeline_duration_ms": data.get("pipeline_duration_ms", 0),
            "hex_assess_url": data.get("hex_assess_url"),
            "hex_plans_url": data.get("hex_plans_url"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Verification retrieval failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")
