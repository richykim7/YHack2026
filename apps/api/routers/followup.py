"""Follow-up endpoint — proxies data questions to Hex Threads via MCP.

Uses HexThreadsClient to create a Thread, poll for completion, and return
the AI-generated answer inline. Falls back to a URL-only response if
OAuth tokens are not configured.
"""

import logging

from fastapi import APIRouter
from pydantic import BaseModel

from services.hex_threads import HexThreadsClient

router = APIRouter(prefix="/api/crisis", tags=["crisis"])
logger = logging.getLogger(__name__)

# Singleton client — reuses token storage across requests
_hex_client = HexThreadsClient()


class FollowupRequest(BaseModel):
    question: str
    crisis_type: str = ""
    geography: str = ""
    affected_population: int = 0
    timeline_days: int = 0
    demand_delta_pct: float = 0


class FollowupResponse(BaseModel):
    answer: str
    thread_url: str
    thread_id: str | None = None


@router.post("/followup", response_model=FollowupResponse)
async def crisis_followup(request: FollowupRequest):
    """Proxy follow-up questions to Hex Threads via MCP.

    If OAuth tokens are available, creates a real Hex Thread and returns
    the AI-generated answer. Otherwise returns a fallback message.
    """
    # Build crisis context string
    context_parts = []
    if request.crisis_type:
        context_parts.append(f"{request.crisis_type} crisis")
    if request.geography:
        context_parts.append(f"in {request.geography}")
    if request.affected_population:
        context_parts.append(f"affecting ~{request.affected_population:,} people")
    if request.demand_delta_pct:
        context_parts.append(f"{request.demand_delta_pct}% demand increase")
    crisis_context = ", ".join(context_parts) if context_parts else ""

    # Check if we have OAuth tokens
    if not await _hex_client.is_authenticated():
        logger.warning("Hex OAuth tokens not found — returning fallback response")
        return FollowupResponse(
            answer=(
                "Hex Threads is not yet configured. "
                "Run 'python scripts/hex_oauth_setup.py' to authenticate."
            ),
            thread_url="",
            thread_id=None,
        )

    # Call Hex Threads via MCP
    try:
        result = await _hex_client.ask(
            question=request.question,
            crisis_context=crisis_context,
        )
        return FollowupResponse(
            answer=result["answer"],
            thread_url=result.get("thread_url", ""),
            thread_id=result.get("thread_id"),
        )
    except Exception as e:
        logger.error("Hex Threads MCP error: %s", e, exc_info=True)
        return FollowupResponse(
            answer=f"Error connecting to Hex Threads: {e}",
            thread_url="",
            thread_id=None,
        )
