from pydantic import BaseModel

from models.crisis import CrisisProfile


class CategoryGap(BaseModel):
    """Gap for a single food category."""

    category: str
    supply_lbs: float
    demand_lbs: float
    gap_lbs: float  # negative = deficit
    coverage_ratio: float  # supply / demand (0.0 to 1.0+)


class GapAnalysis(BaseModel):
    """Output of local gap computation."""

    total_supply_lbs: float
    total_demand_lbs: float
    total_gap_lbs: float
    gaps_by_category: list[CategoryGap]
    expiration_risk_lbs: float
    site_health_scores: dict[str, float]  # site_id -> score
    ai_summary: str  # AI-generated 1-2 sentence summary


class HexRunResult(BaseModel):
    """Result of triggering a Hex project run."""

    run_id: str
    run_url: str
    status: str  # PENDING, RUNNING, COMPLETED, ERRORED, KILLED, TIMEOUT


class AgentCost(BaseModel):
    """Per-agent cost from Lava."""

    agent: str
    cost: float
    tokens: int
    requests: int


class AssessResponse(BaseModel):
    """Response from POST /api/assess."""

    gap_analysis: GapAnalysis
    hex_run: HexRunResult | None  # None if Hex unavailable
