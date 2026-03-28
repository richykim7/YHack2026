import logging

from fastapi import APIRouter, HTTPException

from models.crisis import CrisisProfile, SourceOption
from models.assess import GapAnalysis
from models.events import DiscoverRequest, DiscoverResponse
from agents.discover_agent import discover_sources

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["discover"])


@router.post("/discover", response_model=DiscoverResponse)
async def discover_endpoint(req: DiscoverRequest):
    """Standalone DISCOVER endpoint. Returns sourcing options from DB + web search."""
    try:
        gap = GapAnalysis(**req.gap_analysis)
        profile = CrisisProfile(**req.crisis_profile)
        sources = await discover_sources(gap, profile)
        source_dicts = [s.model_dump() for s in sources]
        db_count = sum(1 for s in sources if s.source_type == "database")
        web_count = sum(1 for s in sources if s.source_type == "web_search")
        return DiscoverResponse(sources=source_dicts, db_count=db_count, web_count=web_count)
    except Exception as e:
        logger.error("Discover endpoint error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
