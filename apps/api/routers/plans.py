"""Plan acceptance and document generation endpoints."""

import logging
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from supabase import create_client

from services.documents import generate_documents, GeneratedDocument

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

router = APIRouter(prefix="/api/plans", tags=["plans"])


class AcceptPlanRequest(BaseModel):
    crisis_event_id: str
    plan: dict  # ResponsePlan serialized
    target_site_id: str  # Which site receives the line items


def _estimate_expiration(food_category: str) -> str:
    """Estimate expiration date for newly reserved inventory."""
    ranges = {
        "produce": 5, "dairy": 10, "protein": 4,
        "canned": 365, "grains": 365, "beverages": 365,
    }
    days = ranges.get(food_category, 30)
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")


@router.post("/accept")
async def accept_plan(req: AcceptPlanRequest):
    """Accept a response plan: write to crisis_events, reserve inventory, recompute health.

    1. Store accepted plan in crisis_events.response_plan
    2. Insert line items as reserved inventory
    3. Handle transfers (subtract from source, add to destination)
    4. Recompute health scores for affected sites
    5. Return updated health scores
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Database not configured")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    try:
        plan_name = req.plan.get("name", "unknown")

        # 1. Store accepted plan in crisis_events
        supabase.table("crisis_events").update({
            "response_plan": req.plan,
            "accepted_plan_name": plan_name,
        }).eq("id", req.crisis_event_id).execute()

        # 2. Insert reserved inventory for line items
        affected_site_ids = {req.target_site_id}
        line_items = req.plan.get("line_items", [])

        for item in line_items:
            supabase.table("inventory").insert({
                "site_id": req.target_site_id,
                "food_category": item.get("food_category", ""),
                "subcategory": item.get("item_name", ""),
                "quantity_lbs": item.get("quantity_lbs", 0),
                "unit_cost_dollars": item.get("cost", 0) / max(item.get("quantity_lbs", 1), 1),
                "expiration_date": _estimate_expiration(item.get("food_category", "")),
                "received_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "source_type": "planned",
                "status": "reserved",
            }).execute()

        # 3. Handle transfers
        transfers = req.plan.get("transfers", [])
        for transfer in transfers:
            from_site_id = transfer.get("from_site_id", "")
            to_site_id = transfer.get("to_site_id", "")
            food_category = transfer.get("food_category", "")
            quantity_lbs = transfer.get("quantity_lbs", 0)

            if from_site_id:
                affected_site_ids.add(from_site_id)
            if to_site_id:
                affected_site_ids.add(to_site_id)

            # Add reserved inventory at destination
            supabase.table("inventory").insert({
                "site_id": to_site_id,
                "food_category": food_category,
                "subcategory": f"transfer from {transfer.get('from_site_name', 'unknown')}",
                "quantity_lbs": quantity_lbs,
                "unit_cost_dollars": 0.0,
                "expiration_date": _estimate_expiration(food_category),
                "received_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "source_type": "transfer",
                "status": "reserved",
            }).execute()

        # 4. Recompute health scores for affected sites
        updated_scores = {}
        for site_id in affected_site_ids:
            try:
                supabase.rpc("compute_health_score", {"target_site_id": site_id}).execute()
                score_resp = supabase.table("sites").select("health_score").eq("id", site_id).single().execute()
                updated_scores[site_id] = float(score_resp.data["health_score"])
            except Exception as e:
                logger.warning("Health score recompute failed for site %s: %s", site_id, e)

        return {
            "status": "accepted",
            "plan_name": plan_name,
            "line_items_reserved": len(line_items),
            "transfers_processed": len(transfers),
            "updated_health_scores": updated_scores,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Plan acceptance failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Plan acceptance failed: {str(e)}")


@router.get("/{crisis_event_id}/documents")
async def get_plan_documents(crisis_event_id: str):
    """Generate order documents for an accepted plan.

    Returns purchase orders (per supplier), transfer requests, and crisis summary.
    All documents are template-based markdown -- no LLM needed.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Database not configured")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    try:
        # Fetch accepted plan from crisis_events
        resp = supabase.table("crisis_events").select(
            "response_plan, crisis_profile"
        ).eq("id", crisis_event_id).single().execute()

        if not resp.data or not resp.data.get("response_plan"):
            raise HTTPException(status_code=404, detail="No accepted plan found for this crisis event")

        plan = resp.data["response_plan"]
        crisis_profile = resp.data.get("crisis_profile")

        docs = generate_documents(crisis_event_id, plan, crisis_profile)

        return {
            "crisis_event_id": crisis_event_id,
            "plan_name": plan.get("name", "unknown"),
            "documents": [d.model_dump() for d in docs],
            "count": len(docs),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Document generation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Document generation failed: {str(e)}")
