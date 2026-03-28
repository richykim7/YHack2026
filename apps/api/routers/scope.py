from fastapi import APIRouter

from agents.scope_agent import run_scope_turn
from models.crisis import ScopeChatRequest, ScopeChatResponse

router = APIRouter(prefix="/api/scope", tags=["scope"])


@router.post("/chat", response_model=ScopeChatResponse)
async def scope_chat(request: ScopeChatRequest):
    """
    Multi-turn SCOPE conversation.
    Returns agent response + optional CrisisProfile when extraction is complete.
    """
    try:
        result = await run_scope_turn(request.session_id, request.message)
        return result
    except Exception as e:
        return ScopeChatResponse(
            response=f"An error occurred: {str(e)}. Please try again.",
            crisis_profile=None,
            is_complete=False,
        )
