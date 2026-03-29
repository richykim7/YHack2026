"""Monitor agent -- autonomous crisis feed scanner with LLM classification.

Scans a curated feed of simulated posts, classifies each via LLM tool calling,
and triggers the full pipeline when a crisis-relevant post is detected.
"""

import asyncio
import logging
import time

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from agents.gateway import get_llm
from agents.pipeline import get_event_queue, _emit, run_pipeline
from models.monitor import SIMULATED_POSTS, MonitorPost
from models.events import (
    MonitorPostEvent,
    MonitorClassificationEvent,
    CrisisDetectedEvent,
    ErrorEvent,
)

logger = logging.getLogger(__name__)


@tool
def classify_crisis_relevance(relevant: bool, confidence: float, reason: str) -> str:
    """Classify whether a social media post indicates a food security crisis.

    Args:
        relevant: True if the post describes a crisis that could affect food security
        confidence: 0.0 to 1.0 confidence in the classification
        reason: Brief explanation of the classification decision
    """
    return "Classification recorded."


CLASSIFY_SYSTEM_PROMPT = """You are a food security crisis monitor for Greater Philadelphia.
Analyze each social media post and classify whether it indicates a crisis that could affect food security.

Consider relevant: factory closures/layoffs affecting workers' ability to afford food, natural disasters disrupting supply chains, food bank/pantry closures, significant economic downturns in local communities.

Consider irrelevant: general news, sports, restaurants, events not related to food security.

You MUST call the classify_crisis_relevance tool with your assessment."""


async def classify_post(post: MonitorPost) -> dict:
    """Classify a single post via LLM with tool calling.

    Returns dict with {relevant: bool, confidence: float, reason: str}.
    """
    llm = get_llm("monitor")
    llm_with_tools = llm.bind_tools([classify_crisis_relevance], tool_choice="any")

    messages = [
        SystemMessage(content=CLASSIFY_SYSTEM_PROMPT),
        HumanMessage(content=f"[{post.source}] @{post.author}: {post.content}"),
    ]

    response = await llm_with_tools.ainvoke(messages)

    # Extract structured output from tool call (per scope_agent.py pattern)
    if response.tool_calls:
        args = response.tool_calls[0]["args"]
        return {
            "relevant": bool(args.get("relevant", False)),
            "confidence": float(args.get("confidence", 0.0)),
            "reason": str(args.get("reason", "")),
        }

    # Fallback if tool calling fails (shouldn't happen with tool_choice="any")
    return {"relevant": False, "confidence": 0.0, "reason": "Classification failed"}


async def run_monitor(session_id: str):
    """Monitor feed scan + classification + pipeline handoff.

    Uses same session queue throughout. Monitor events, then pipeline events
    all flow to the same SSE stream. Sub-second delay between posts.
    Stops immediately on crisis detection.
    """
    queue = get_event_queue(session_id)

    try:
        # Phase 1: Feed scan with LLM classification
        for post in SIMULATED_POSTS:
            # Emit the post (near-instant appearance)
            await _emit(queue, MonitorPostEvent(
                post=post.model_dump(),
                timestamp=time.time(),
            ))

            # Classify via LLM (every post hits the LLM)
            classification = await classify_post(post)

            await _emit(queue, MonitorClassificationEvent(
                post_id=post.id,
                classification=classification,
                timestamp=time.time(),
            ))

            # Check if crisis detected (stop immediately)
            if classification["relevant"] and classification["confidence"] >= 0.7:
                await _emit(queue, CrisisDetectedEvent(
                    post=post.model_dump(),
                    classification=classification,
                    timestamp=time.time(),
                ))

                # Placeholder crisis profile (Plan 02 will replace with orchestrator)
                crisis_profile = {
                    "crisis_type": "layoffs",
                    "geography": "Greater Philadelphia",
                    "severity": 4,
                    "timeline_days": 14,
                    "demand_delta_pct": 35,
                    "affected_population": 15000,
                    "notes": f"Auto-detected from monitor: {post.content}",
                    "description": post.content,
                }

                # Hand off to existing pipeline (same session, same queue)
                await run_pipeline(session_id, crisis_profile)
                return

            # Sub-second pacing between posts
            await asyncio.sleep(0.3)

        # No crisis detected in any post (shouldn't happen with curated posts)
        await _emit(queue, ErrorEvent(
            message="Monitor scan complete: no crisis detected",
            timestamp=time.time(),
        ))

    except Exception as e:
        logger.error("Monitor error for session %s: %s", session_id, e, exc_info=True)
        await _emit(queue, ErrorEvent(
            message=f"Monitor error: {str(e)}",
            timestamp=time.time(),
        ))
