from fastapi import APIRouter, BackgroundTasks

from agents.gateway import get_llm
from models.crisis import CrisisProfile
from models.assess import AssessResponse, GapAnalysis, HexRunResult
from services.gap_analysis import compute_gap_locally
from services.hex_client import HEX_ASSESS_PROJECT_ID, trigger_hex_run

router = APIRouter(prefix="/api/assess", tags=["assess"])


async def generate_ai_summary(gap: GapAnalysis, profile: CrisisProfile) -> str:
    """Generate 1-2 sentence AI summary of gap analysis. Per D-13.

    Uses Lava with agent:assess tag via gateway (ASSESS-04, COST-02).
    """
    try:
        llm = get_llm(agent_name="assess", temperature=0.3)

        deficits = [
            f"{g.category}: {abs(g.gap_lbs):.0f} lbs deficit"
            for g in gap.gaps_by_category
            if g.gap_lbs < 0
        ]
        adequate = [g.category for g in gap.gaps_by_category if g.gap_lbs >= 0]
        prompt = (
            f"Crisis: {profile.description}. "
            f"Deficits: {', '.join(deficits) if deficits else 'none'}. "
            f"Adequate categories: {', '.join(adequate) if adequate else 'none'}. "
            f"Total gap: {abs(gap.total_gap_lbs):.0f} lbs over {profile.timeline_days} days. "
            "Write a 1-2 sentence executive summary of the supply gap analysis "
            "for a food bank operator. Be specific about the worst shortfalls."
        )
        response = await llm.ainvoke(prompt)
        content = response.content
        return content if isinstance(content, str) else str(content)
    except Exception:
        # Fallback: generate a simple template summary if LLM fails
        deficits = [g for g in gap.gaps_by_category if g.gap_lbs < 0]
        if deficits:
            worst = min(deficits, key=lambda g: g.gap_lbs)
            return (
                f"Critical shortfall detected in {worst.category} "
                f"({abs(worst.gap_lbs):.0f} lbs deficit). "
                f"{len(deficits)} of 6 categories below projected demand."
            )
        return "All food categories have adequate supply for the projected demand period."


@router.post("", response_model=AssessResponse)
async def run_assess(profile: CrisisProfile, background_tasks: BackgroundTasks):
    """Run dual-path ASSESS: local computation + Hex trigger.

    Local gap analysis returns immediately. Hex runs in background.
    Implements ASSESS-01, ASSESS-02, ASSESS-03, ASSESS-04.
    """
    # 1. Local gap analysis (deterministic, ~100ms)
    gap = await compute_gap_locally(profile)

    # 2. AI summary (per D-13)
    gap.ai_summary = await generate_ai_summary(gap, profile)

    # 3. Trigger Hex ASSESS (non-blocking)
    hex_run: HexRunResult | None = None
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
            hex_run = HexRunResult(
                run_id=result["run_id"],
                run_url=result["run_url"],
                status="PENDING",
            )
            # Background poll -- do not block response
            # The SSE endpoint (Phase 2) will emit hex_run_started/hex_run_completed
        except Exception:
            hex_run = None  # Hex unavailable, fallback to local (per D-02)

    return AssessResponse(gap_analysis=gap, hex_run=hex_run)
