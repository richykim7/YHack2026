"""SCOPE agent -- crisis intake specialist with multi-turn conversation.

Implements multi-turn crisis intake with ChatAnthropic tool calling.
Extracts CrisisProfile when sufficient information is gathered.
Routes LLM calls through configurable Lava/OpenRouter/direct gateway.
"""

import logging

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool

from agents.gateway import get_llm
from db.conversations import (
    ensure_session,
    load_history,
    save_crisis_profile,
    save_message,
)
from models.crisis import CrisisProfile

logger = logging.getLogger(__name__)

SCOPE_SYSTEM_PROMPT = """You are a crisis intake specialist for a food bank network in Greater Philadelphia.
Your job is to quickly characterize a community crisis so the response team can act.

You must determine: crisis type, geographic scope, severity (1-5), expected timeline,
estimated demand increase %, and affected population.

If the operator's description is clear enough, call extract_crisis_profile immediately
with reasonable defaults for any missing fields. Only ask a clarifying question if
critical information (like location or crisis type) is truly ambiguous. Limit yourself
to 1-2 clarifying questions maximum.

Be concise and professional. This is an ops-center, not customer service."""


@tool
def extract_crisis_profile(
    crisis_type: str,
    geography: str,
    severity: int,
    timeline_days: int,
    demand_delta_pct: float,
    affected_population: int,
    notes: str,
) -> str:
    """Extract a structured crisis profile from the conversation.
    Call this when you have enough information to characterize the crisis.

    Args:
        crisis_type: One of 'layoffs', 'natural_disaster', 'partner_shutdown', 'other'
        geography: Affected region or zip codes
        severity: 1-5 scale
        timeline_days: Expected duration of crisis
        demand_delta_pct: Estimated percent increase in food demand
        affected_population: Number of people affected
        notes: Additional context
    """
    return "Crisis profile extracted successfully."


async def run_scope_turn(session_id: str, user_message: str) -> dict:
    """Run a single turn of the SCOPE conversation.

    1. Ensures session exists in Supabase
    2. Loads conversation history
    3. Invokes ChatAnthropic with tool binding
    4. Checks for extract_crisis_profile tool call
    5. Persists messages and extracted profile

    Returns dict with response, crisis_profile (if extracted), is_complete.
    """
    try:
        # Ensure session exists
        await ensure_session(session_id)

        # Get LLM with agent:scope tag for Lava cost tracking
        llm = get_llm(agent_name="scope")
        llm_with_tools = llm.bind_tools([extract_crisis_profile])

        # Load conversation history from Supabase
        history = await load_history(session_id)

        # Build messages list
        messages = [SystemMessage(content=SCOPE_SYSTEM_PROMPT)]
        messages.extend(history)
        messages.append(HumanMessage(content=user_message))

        # Save user message to Supabase
        await save_message(session_id, "human", user_message)

        # Invoke LLM
        response = await llm_with_tools.ainvoke(messages)

        # Check for tool calls (CrisisProfile extraction)
        crisis_profile = None
        is_complete = False
        response_text = response.content if isinstance(response.content, str) else ""

        if response.tool_calls:
            for tc in response.tool_calls:
                if tc["name"] == "extract_crisis_profile":
                    crisis_profile = CrisisProfile(**tc["args"])
                    is_complete = True
                    # Content may be empty on tool calls (Pitfall 4)
                    if not response_text:
                        response_text = (
                            "I've analyzed your crisis description. "
                            "Here's what I found:"
                        )
                    # Persist crisis profile to Supabase
                    await save_crisis_profile(
                        session_id, crisis_profile.model_dump()
                    )

        # Save AI response to Supabase
        await save_message(session_id, "ai", response_text)

        return {
            "response": response_text,
            "crisis_profile": crisis_profile,
            "is_complete": is_complete,
        }

    except Exception as e:
        logger.error("SCOPE agent error for session %s: %s", session_id, e)
        return {
            "response": (
                "I'm having trouble connecting to the AI service. "
                "Please try again."
            ),
            "crisis_profile": None,
            "is_complete": False,
        }
