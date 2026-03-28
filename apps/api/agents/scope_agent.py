"""SCOPE agent -- crisis intake specialist with multi-turn conversation.

Placeholder for Task 1 verification. Full implementation in Task 2.
"""

from langchain_core.tools import tool

from models.crisis import CrisisProfile


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
    """Placeholder -- full implementation in Task 2."""
    return {
        "response": "SCOPE agent not yet implemented.",
        "crisis_profile": None,
        "is_complete": False,
    }
