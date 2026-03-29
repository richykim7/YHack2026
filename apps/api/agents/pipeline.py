import asyncio
import logging
import time
import uuid
from typing import Dict

from models.audit import AuditEntry
from models.crisis import CrisisProfile, SourceOption
from models.assess import GapAnalysis
from models.events import (
    AgentStartEvent,
    AgentEndEvent,
    AssessStartEvent,
    AssessCompleteEvent,
    HexAssessReadyEvent,
    DiscoverStartEvent,
    SourceFoundEvent,
    DiscoverCompleteEvent,
    OptimizeStartEvent,
    PlansReadyEvent,
    HexPlansReadyEvent,
    PipelineCompleteEvent,
    LavaUsageEvent,
    ErrorEvent,
)
from services.gap_analysis import compute_gap_locally
from services.hex_client import (
    HEX_ASSESS_PROJECT_ID,
    HEX_PLANS_PROJECT_ID,
    trigger_hex_run,
    trigger_plans_run,
)
from agents.discover_agent import discover_sources
from services.optimize import generate_plans

logger = logging.getLogger(__name__)

# Session -> Queue mapping for SSE event routing
_event_queues: Dict[str, asyncio.Queue] = {}


def get_event_queue(session_id: str) -> asyncio.Queue:
    if session_id not in _event_queues:
        _event_queues[session_id] = asyncio.Queue()
    return _event_queues[session_id]


def cleanup_queue(session_id: str):
    _event_queues.pop(session_id, None)


async def _emit(queue: asyncio.Queue, event) -> None:
    """Serialize and enqueue an SSE event."""
    await queue.put(event.model_dump())


async def _run_scope_stage(queue: asyncio.Queue, crisis_profile: CrisisProfile) -> None:
    """Stage 1: SCOPE -- already completed via chat. Emit confirmation."""
    await _emit(queue, AgentStartEvent(
        agent="scope",
        message="SCOPE analysis complete. Starting pipeline.",
        timestamp=time.time(),
    ))
    await _emit(queue, AgentEndEvent(
        agent="scope",
        message="Crisis profile confirmed.",
        timestamp=time.time(),
    ))


async def _run_assess_stage(queue: asyncio.Queue, profile: CrisisProfile) -> tuple[GapAnalysis, str]:
    """Stage 2: ASSESS -- local gap analysis + Hex trigger. Returns (gap, hex_assess_url)."""
    await _emit(queue, AssessStartEvent(timestamp=time.time()))

    # Local gap analysis (deterministic, instant)
    gap = await compute_gap_locally(profile)

    # AI summary (import inline to avoid circular)
    try:
        from routers.assess import generate_ai_summary
        gap.ai_summary = await generate_ai_summary(gap, profile)
    except Exception as e:
        logger.warning("AI summary failed in pipeline: %s", e)

    await _emit(queue, AssessCompleteEvent(
        gap_analysis=gap.model_dump(),
        timestamp=time.time(),
    ))

    # Hex ASSESS trigger (non-blocking)
    hex_assess_url = ""
    if HEX_ASSESS_PROJECT_ID:
        try:
            result = await trigger_hex_run(
                HEX_ASSESS_PROJECT_ID,
                {
                    "crisis_type": profile.crisis_type,
                    "geography": profile.geography,
                    "severity": profile.severity,
                    "timeline_days": profile.timeline_days,
                    "demand_delta_pct": profile.demand_delta_pct,
                    "affected_population": profile.affected_population,
                },
            )
            hex_assess_url = result["run_url"]
            await _emit(queue, HexAssessReadyEvent(
                run_url=hex_assess_url,
                timestamp=time.time(),
            ))
        except Exception as e:
            logger.warning("Hex ASSESS trigger failed: %s", e)

    return gap, hex_assess_url


async def _run_discover_stage(queue: asyncio.Queue, gap: GapAnalysis, profile: CrisisProfile) -> list[dict]:
    """Stage 3: DISCOVER -- find sourcing options via DB + Tavily."""
    await _emit(queue, DiscoverStartEvent(timestamp=time.time()))

    async def on_found(src: SourceOption) -> None:
        await _emit(queue, SourceFoundEvent(source=src.model_dump(), timestamp=time.time()))

    sources = await discover_sources(gap, profile, on_source_found=on_found)
    source_dicts = [s.model_dump() for s in sources]

    await _emit(queue, DiscoverCompleteEvent(
        sources=source_dicts,
        total_count=len(source_dicts),
        timestamp=time.time(),
    ))
    return source_dicts


async def _run_optimize_stage(queue: asyncio.Queue, gap: GapAnalysis, sources: list[dict], profile: CrisisProfile) -> tuple[list[dict], str]:
    """Stage 4: OPTIMIZE -- generate 3 response plans + trigger Hex Plans. Returns (plan_dicts, hex_plans_url)."""
    await _emit(queue, OptimizeStartEvent(timestamp=time.time()))

    source_objs = [SourceOption(**s) for s in sources]
    plans = generate_plans(gap, source_objs, profile)
    plan_dicts = [p.model_dump() for p in plans]

    await _emit(queue, PlansReadyEvent(
        plans=plan_dicts,
        timestamp=time.time(),
    ))

    # Hex Plans trigger (non-blocking -- skip on failure per D-14)
    hex_plans_url = ""
    if HEX_PLANS_PROJECT_ID and plan_dicts:
        try:
            result = await trigger_plans_run(plan_dicts, profile.model_dump())
            hex_plans_url = result.get("run_url", "")
            await _emit(queue, HexPlansReadyEvent(run_url=hex_plans_url, timestamp=time.time()))
        except Exception as e:
            logger.warning("Hex Plans trigger failed: %s", e)

    return plan_dicts, hex_plans_url


def _audit(agent: str, action: str, start_time: float, **kwargs) -> dict:
    """Create an audit log entry dict."""
    entry = AuditEntry(
        timestamp=time.time(),
        agent=agent,
        action=action,
        duration_ms=int((time.time() - start_time) * 1000),
        **kwargs,
    )
    return entry.model_dump()


async def run_pipeline(session_id: str, crisis_profile: dict):
    """
    Full pipeline orchestration: SCOPE -> ASSESS -> DISCOVER -> OPTIMIZE.

    Called as a BackgroundTask from POST /api/crisis/launch.
    Emits typed SSE events to the session queue at each stage transition.
    """
    queue = get_event_queue(session_id)
    pipeline_run_id = str(uuid.uuid4())[:8]
    pipeline_start = time.time()
    audit_log: list[dict] = []

    # Reset per-agent cost tracking for this pipeline run
    try:
        from routers.lava import reset_agent_costs
        reset_agent_costs()
    except Exception:
        pass

    try:
        # Parse crisis profile from dict
        profile = CrisisProfile(**crisis_profile)

        # Stage 1: SCOPE (confirmation only -- already ran via chat)
        scope_start = time.time()
        await _run_scope_stage(queue, profile)
        audit_log.append(_audit("scope", "complete", scope_start, output_summary="Crisis profile confirmed"))

        # Stage 2: ASSESS (local gap analysis + Hex)
        assess_start = time.time()
        gap, hex_assess_url = await _run_assess_stage(queue, profile)
        audit_log.append(_audit("assess", "complete", assess_start, output_summary=f"{len(gap.gaps_by_category)} categories analyzed, {gap.expiration_risk_lbs:.0f} lbs at risk"))

        # Stage 3: DISCOVER (find sourcing options)
        discover_start = time.time()
        sources = await _run_discover_stage(queue, gap, profile)
        audit_log.append(_audit("discover", "complete", discover_start, output_summary=f"{len(sources)} sources found"))

        # Stage 4: OPTIMIZE (generate response plans)
        optimize_start = time.time()
        plans, hex_plans_url = await _run_optimize_stage(queue, gap, sources, profile)
        audit_log.append(_audit("optimize", "complete", optimize_start, output_summary=f"{len(plans)} plans generated"))

        # Emit Lava usage costs (non-blocking, best-effort)
        try:
            from routers.lava import fetch_lava_costs_data
            costs_data = await fetch_lava_costs_data(limit=50)
            if costs_data.get("costs"):
                await _emit(queue, LavaUsageEvent(
                    costs=costs_data,
                    timestamp=time.time(),
                    pipeline_run_id=pipeline_run_id,
                ))
        except Exception as e:
            logger.warning("Lava costs fetch failed: %s", e)

        # Store full pipeline results in crisis_events
        try:
            import os
            from supabase import create_client as _create_client
            _sb_url = os.environ.get("SUPABASE_URL", "")
            _sb_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
            if _sb_url and _sb_key:
                _sb = _create_client(_sb_url, _sb_key)
                pipeline_duration_ms = int((time.time() - pipeline_start) * 1000)

                # Upsert crisis event with pipeline results
                _sb.table("crisis_events").upsert({
                    "id": session_id if len(session_id) == 36 else pipeline_run_id + "-0000-0000-0000-000000000000",
                    "crisis_profile": crisis_profile,
                    "gap_analysis": gap.model_dump(),
                    "discovered_sources": sources,
                    "all_plans": plans,
                    "audit_log": audit_log,
                    "pipeline_duration_ms": pipeline_duration_ms,
                    "pipeline_run_id": pipeline_run_id,
                    "hex_assess_url": hex_assess_url if hex_assess_url else "",
                    "hex_plans_url": hex_plans_url if hex_plans_url else "",
                }, on_conflict="id").execute()
                logger.info("Pipeline results stored in crisis_events (run_id=%s)", pipeline_run_id)
        except Exception as e:
            logger.warning("Failed to store pipeline results in crisis_events: %s", e)

        # Pipeline complete
        total_duration_ms = int((time.time() - pipeline_start) * 1000)
        await _emit(queue, PipelineCompleteEvent(timestamp=time.time(), pipeline_run_id=pipeline_run_id, pipeline_duration_ms=total_duration_ms))

    except Exception as e:
        logger.error("Pipeline error for session %s: %s", session_id, e, exc_info=True)
        await _emit(queue, ErrorEvent(
            message=f"Pipeline error: {str(e)}",
            timestamp=time.time(),
        ))
