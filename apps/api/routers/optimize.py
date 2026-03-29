import logging

from fastapi import APIRouter, HTTPException

from models.crisis import CrisisProfile, SourceOption
from models.assess import GapAnalysis
from models.events import OptimizeRequest, OptimizeResponse
from services.optimize import generate_plans

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["optimize"])


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize_endpoint(req: OptimizeRequest):
    """Standalone OPTIMIZE endpoint. Returns 3 response plans."""
    try:
        gap = GapAnalysis(**req.gap_analysis)
        profile = CrisisProfile(**req.crisis_profile)
        source_objs = [SourceOption(**s) for s in req.sources]
        plans = generate_plans(gap, source_objs, profile)
        plan_dicts = [p.model_dump() for p in plans]
        return OptimizeResponse(plans=plan_dicts)
    except Exception as e:
        logger.error("Optimize endpoint error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
