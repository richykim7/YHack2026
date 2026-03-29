"""Follow-up endpoint — returns Hex Threads URL for iframe embedding.

Hex Threads iframe is allowed (frame-ancestors: *). The frontend embeds
the Threads UI directly in the Follow-up tab and links from the chat.

Note: MCP client code exists in services/hex_threads.py for when Hex
fixes their server-side bug. Currently all MCP tool calls return
"internal server error" regardless of the operation.
"""

import os
import logging

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/crisis", tags=["crisis"])
logger = logging.getLogger(__name__)

HEX_WORKSPACE_ID = os.getenv(
    "HEX_WORKSPACE_ID", "019d332d-fb08-7115-8160-d2aee00146ea"
)
HEX_THREADS_URL = f"https://app.hex.tech/{HEX_WORKSPACE_ID}/threads"


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
    """Return Hex Threads URL for the follow-up question.

    The frontend embeds Hex Threads in an iframe (Follow-up tab) and
    shows an inline link in the chat sidebar.
    """
    context_parts = []
    if request.crisis_type:
        context_parts.append(f"{request.crisis_type} crisis")
    if request.geography:
        context_parts.append(f"in {request.geography}")
    if request.affected_population:
        context_parts.append(f"affecting ~{request.affected_population:,} people")

    crisis_summary = ", ".join(context_parts) if context_parts else "the current crisis"

    answer = (
        f"I've opened Hex Threads in the Follow-up tab where you can explore "
        f"data about {crisis_summary}. Hex's AI analyst will query the CrisisGrid "
        f"database and generate charts for your question."
    )

    logger.info("Followup: question=%r, context=%s", request.question[:80], crisis_summary)

    return FollowupResponse(
        answer=answer,
        thread_url=HEX_THREADS_URL,
        thread_id=None,
    )
