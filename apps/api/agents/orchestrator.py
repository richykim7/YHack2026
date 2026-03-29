"""Multi-model crisis profile orchestrator via Lava gateway.

THE SHOWCASE (per D-09/D-10): 3-step multi-model pipeline using 3+ distinct
models across 2+ providers, each with unique Lava cost tags, plus Serper web
search through Lava forward proxy.

Steps:
1. Web research via Serper/Lava forward proxy (3 parallel queries)
2. Crisis analysis via reasoning model (gemini-2.5-pro, agent:researcher)
3. Profile assembly via fast model from different provider (gpt-4.1-mini, agent:profiler)
"""

import asyncio
import json
import logging
import os
import time

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from agents.gateway import get_llm
from agents.pipeline import _emit
from models.events import (
    OrchestratorStartEvent,
    OrchestratorStepEvent,
    CrisisProfileReadyEvent,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Step 1: Web Research via Serper / Lava forward proxy
# ---------------------------------------------------------------------------

async def _research_crisis(post_content: str) -> str:
    """Deploy parallel Serper web searches via Lava forward proxy (per D-12).

    Searches for: news coverage, geographic impact, employment data, food bank demand.
    Returns concatenated text snippets for the reasoning model to analyze.
    """
    lava_token = os.environ.get("LAVA_API_TOKEN", "")
    if not lava_token:
        logger.warning("LAVA_API_TOKEN not set, returning minimal context")
        return f"Post content: {post_content}"

    import httpx

    serper_url = (
        "https://api.lava.so/v1/forward"
        "?u=https%3A%2F%2Fgoogle.serper.dev%2Fsearch"
    )

    queries = [
        "Philadelphia factory layoffs food insecurity impact 2026",
        "Kensington Philadelphia manufacturing closures community impact",
        "Greater Philadelphia food bank demand surge economic crisis",
    ]

    snippets = [f"Triggering post: {post_content}"]

    async with httpx.AsyncClient() as client:
        tasks = []
        for q in queries:
            tasks.append(
                client.post(
                    serper_url,
                    json={"q": q, "num": 3},
                    headers={
                        "Authorization": f"Bearer {lava_token}",
                        "Content-Type": "application/json",
                    },
                    timeout=10.0,
                )
            )

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning("Serper query %d failed: %s", i, result)
                continue
            try:
                data = result.json()
                for item in data.get("organic", [])[:3]:
                    title = item.get("title", "")
                    snippet = item.get("snippet", "")
                    snippets.append(f"- {title}: {snippet}")
            except Exception as e:
                logger.warning("Serper result %d parse failed: %s", i, e)

    return "\n".join(snippets)


# ---------------------------------------------------------------------------
# Step 2: Crisis Analysis (reasoning model via Lava)
# ---------------------------------------------------------------------------

ANALYSIS_PROMPT = """You are a crisis analysis expert. Based on the web research below, analyze this crisis and determine:

1. Crisis type (one of: layoffs, natural_disaster, partner_shutdown, other)
2. Exact geographic scope
3. Severity (1-5 scale, where 5 is catastrophic)
4. Expected timeline in days
5. Estimated demand increase percentage (how much food demand will rise)
6. Estimated affected population count
7. Key food categories likely impacted

Provide your analysis as a structured assessment. Be specific with numbers.

WEB RESEARCH CONTEXT:
{web_context}"""


async def _analyze_crisis(post_content: str, web_context: str) -> str:
    """Analyze crisis using reasoning model (gemini-2.5-pro via Lava, tagged agent:researcher).

    Per D-10: Uses a different model than the classifier to showcase multi-model routing.
    """
    llm = get_llm("researcher", temperature=0.2)
    messages = [
        SystemMessage(content=ANALYSIS_PROMPT.format(web_context=web_context)),
        HumanMessage(content=f"Analyze this crisis trigger: {post_content}"),
    ]
    response = await llm.ainvoke(messages)
    return response.content if isinstance(response.content, str) else str(response.content)


# ---------------------------------------------------------------------------
# Step 3: Profile Assembly (fast model from different provider via Lava)
# ---------------------------------------------------------------------------

@tool
def assemble_crisis_profile(
    crisis_type: str,
    geography: str,
    severity: int,
    timeline_days: int,
    demand_delta_pct: float,
    affected_population: int,
    notes: str,
) -> str:
    """Assemble a structured CrisisProfile from the crisis analysis.

    Args:
        crisis_type: One of 'layoffs', 'natural_disaster', 'partner_shutdown', 'other'
        geography: Affected geographic region
        severity: 1-5 scale (5 = catastrophic)
        timeline_days: Expected crisis duration in days
        demand_delta_pct: Estimated percent increase in food demand (e.g. 35 for 35%)
        affected_population: Number of people affected
        notes: Key findings from web research
    """
    return "Crisis profile assembled."


PROFILE_PROMPT = """You are a crisis profile assembler for a food bank coordination system.
Based on the analysis below, create a structured crisis profile by calling the assemble_crisis_profile tool.

Use realistic values based on the analysis. If the analysis mentions specific numbers, use those.
If not, use reasonable estimates for a manufacturing layoff crisis in a major US city:
- severity: typically 3-4 for localized economic crises
- timeline_days: typically 14-30 for layoff impacts
- demand_delta_pct: typically 25-40% for significant community impact
- affected_population: based on analysis context

CRISIS ANALYSIS:
{analysis}"""


async def _assemble_profile(analysis: str) -> dict:
    """Assemble CrisisProfile using fast model from different provider (gpt-4.1-mini via Lava).

    Per D-10: Uses OpenAI model (different provider from Google) to showcase
    Lava's cross-provider routing. Tagged agent:profiler for cost tracking.

    Returns dict matching CrisisProfile schema.
    """
    llm = get_llm("profiler", temperature=0.1)
    llm_with_tools = llm.bind_tools([assemble_crisis_profile], tool_choice="any")

    messages = [
        SystemMessage(content=PROFILE_PROMPT.format(analysis=analysis)),
        HumanMessage(content="Assemble the crisis profile now."),
    ]

    response = await llm_with_tools.ainvoke(messages)

    if response.tool_calls:
        args = response.tool_calls[0]["args"]
        return {
            "crisis_type": str(args.get("crisis_type", "layoffs")),
            "geography": str(args.get("geography", "Greater Philadelphia")),
            "severity": int(args.get("severity", 4)),
            "timeline_days": int(args.get("timeline_days", 14)),
            "demand_delta_pct": float(args.get("demand_delta_pct", 35)),
            "affected_population": int(args.get("affected_population", 15000)),
            "notes": str(args.get("notes", "")),
            "description": f"Auto-detected crisis: {str(args.get('notes', ''))}",
        }

    # Fallback: use safe demo defaults if tool calling fails
    logger.warning("Profile assembly tool calling failed, using defaults")
    return {
        "crisis_type": "layoffs",
        "geography": "Greater Philadelphia",
        "severity": 4,
        "timeline_days": 14,
        "demand_delta_pct": 35,
        "affected_population": 15000,
        "notes": "Fallback profile - tool calling failed",
        "description": "Auto-detected manufacturing crisis in North Philadelphia",
    }


# ---------------------------------------------------------------------------
# Main orchestration function
# ---------------------------------------------------------------------------

async def orchestrate_crisis_profile(queue: asyncio.Queue, triggering_post) -> dict:
    """Multi-model crisis profile assembly via Lava gateway (THE SHOWCASE per D-09/D-10).

    3 orchestration steps using 3+ distinct models across 2+ providers:
    1. Web research via Serper/Lava forward proxy (3 parallel queries)
    2. Crisis analysis via reasoning model (gemini-2.5-pro, agent:researcher)
    3. Profile assembly via fast model from different provider (gpt-4.1-mini, agent:profiler)

    Each step emits SSE events with model name visibility for the frontend.
    All model calls go through Lava with unique x-lava-tags for per-agent cost tracking.

    Args:
        queue: SSE event queue (same queue as monitor + pipeline per D-08)
        triggering_post: The MonitorPost that triggered crisis detection

    Returns:
        dict matching CrisisProfile schema, ready for run_pipeline()
    """
    await _emit(queue, OrchestratorStartEvent(
        message="Initiating multi-model crisis analysis via Lava gateway...",
        timestamp=time.time(),
    ))

    # Step 1: Parallel web research via Serper/Lava forward proxy
    await _emit(queue, OrchestratorStepEvent(
        step="web_research",
        model="serper",
        message="Deploying web crawlers to gather crisis context...",
        timestamp=time.time(),
    ))
    web_context = await _research_crisis(triggering_post.content)

    # Step 2: Crisis analysis with reasoning model (Google Gemini via Lava)
    await _emit(queue, OrchestratorStepEvent(
        step="crisis_analysis",
        model="gemini-2.5-pro",
        message="Analyzing crisis severity and geographic impact...",
        timestamp=time.time(),
    ))
    analysis = await _analyze_crisis(triggering_post.content, web_context)

    # Step 3: Profile assembly with fast model (OpenAI via Lava -- different provider!)
    await _emit(queue, OrchestratorStepEvent(
        step="profile_assembly",
        model="gpt-4.1-mini",
        message="Assembling structured crisis profile...",
        timestamp=time.time(),
    ))
    profile = await _assemble_profile(analysis)

    await _emit(queue, CrisisProfileReadyEvent(
        crisis_profile=profile,
        timestamp=time.time(),
    ))

    return profile
