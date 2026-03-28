from pydantic import BaseModel


class CrisisProfile(BaseModel):
    """Unified crisis profile. Single source of truth for the entire pipeline.
    Extracted by SCOPE agent, consumed by ASSESS, DISCOVER, OPTIMIZE."""

    crisis_type: str  # 'layoffs', 'natural_disaster', 'partner_shutdown', 'other'
    geography: str
    severity: int  # 1-5
    timeline_days: int
    demand_delta_pct: float
    affected_population: int
    notes: str
    food_categories: list[str] = []  # SCOPE may not extract this
    description: str = ""  # can be filled from notes or chat


class ScopeChatRequest(BaseModel):
    session_id: str
    message: str


class ScopeChatResponse(BaseModel):
    response: str
    crisis_profile: CrisisProfile | None = None
    is_complete: bool = False


class SourceOption(BaseModel):
    """A potential sourcing option from DB or web search."""

    id: str  # unique identifier (uuid or slug)
    supplier_name: str
    food_category: str  # matches FoodCategory
    item_name: str
    quantity_available_lbs: float
    unit_cost_per_lb: float
    lead_time_days: int
    reliability_score: float  # 0.0-1.0 from supplier table or estimated
    source_type: str  # "database" | "web_search"
    notes: str = ""


class PlanLineItem(BaseModel):
    """A single sourcing action within a response plan."""

    source_id: str  # references SourceOption.id
    supplier_name: str
    food_category: str
    item_name: str
    quantity_lbs: float  # how much to order
    cost: float  # quantity_lbs * unit_cost_per_lb
    lead_time_days: int


class ResponsePlan(BaseModel):
    """One of 3 optimized response plans."""

    name: str  # "fastest" | "cheapest" | "best_nutrition"
    strategy: str  # 1-sentence description of optimization target
    line_items: list[PlanLineItem]
    total_cost: float
    coverage_pct: float  # percentage of gap covered (0-100)
    max_lead_time_days: int  # longest lead time across all line items
    estimated_people_served: int


class LavaCostBreakdown(BaseModel):
    """Aggregated Lava costs for the full pipeline run."""

    total_cost: float
    by_agent: list[dict]  # [{agent: str, cost: float, tokens: int, requests: int}]
    model_tier: str  # "sonnet" etc.
