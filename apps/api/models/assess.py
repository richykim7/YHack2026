from pydantic import BaseModel


class CrisisProfile(BaseModel):
    """Extracted from SCOPE conversation. Input to ASSESS."""

    crisis_type: str  # e.g., "supply_disruption", "demand_surge", "infrastructure"
    affected_area: str  # e.g., "Greater Philadelphia"
    food_categories: list[str]  # subset of: protein, grains, dairy, produce, canned, beverages
    urgency: str  # "critical", "high", "moderate", "low"
    population_affected: int
    timeline_days: int  # planning horizon in days
    demand_delta_pct: float  # estimated demand increase (e.g., 30.0 = +30%)
    description: str  # original crisis description


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
